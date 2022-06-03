const Mocha = require('mocha');
const ZebrunnerApiClient = require('./zebr-api-client.js')
const { workerEvents } = require('./constants')
const { getFailedScreenshot, sleep } = require('./utils');
const path = require('path');
const { ConfigResolver } = require('./config-resolver.js');
const LogUtil = require('./log-util').LogUtil;

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_BEGIN,
  EVENT_TEST_PASS,
  EVENT_TEST_FAIL,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
} = Mocha.Runner.constants;

let zebrunnerApiClient;
let contextExchangesPromise;
let runStartPromise;
let finishTestPromises = []
let startTestPromisesMap = new Map();
process.on('message', async (message) => {
  const { event } = message;
  switch (event) {
    case workerEvents.WORKER_INIT: {
      this.suiteRegistered = false;
      this.configResolver = new ConfigResolver(message.config);
      this.logger = new LogUtil(this.configResolver);
      zebrunnerApiClient = new ZebrunnerApiClient(message.config, this.configResolver, this.logger);
      break;
    }
    case EVENT_RUN_BEGIN: {
      this.logger.info(path.basename(__filename), 'ZEBRUNNER REPORTER STARTED')
      break;
    }

    case EVENT_SUITE_BEGIN: {
      // as of now only the first (root) suite will be registered as a new run in zebrunner
      if (message.suite.title) {
        this.logger.info(path.basename(__filename), 'suite started. name: ' + message.suite.title)
        if (!this.suiteRegistered) {
          this.logger.info(path.basename(__filename), 'first suite registered!')
          if (process.env.REPORTING_RUN_CONTEXT) {
            contextExchangesPromise = zebrunnerApiClient.contextExchanges(JSON.parse(process.env.REPORTING_RUN_CONTEXT))
              .then((data) => {
                runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite, data.data.testRunUuid);
              })
          } else {
            runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite);
          }
          this.suiteRegistered = true
        }
      }
      break;
    }
    case EVENT_SUITE_END: {
      if (message.suite.title) {
        this.logger.info(path.basename(__filename), 'suite finished. name: ' + message.suite.title)
      }
      break;
    }

    case EVENT_TEST_BEGIN: {
      if (process.env.REPORTING_RUN_CONTEXT) {
        startTestPromisesMap.set(message.test.uniqueId,
          contextExchangesPromise.then(() => {
            return runStartPromise.then(() => {
              this.logger.info(path.basename(__filename), `--- TEST STARTED ${message.test.title} ---`)
              return zebrunnerApiClient.startTest(message.test).then(() => {
                const parsedTestLogs = message.test.body
                  .split('\n')
                  .map((el) => el.trim())
                  .filter(el => el !== '() => {' && el !== '}' && el);
                const testLogs = ['ORIGINAL TEST DEFINITION (NOT LIVE LOGS):', ...parsedTestLogs];

                return Promise.all([
                  zebrunnerApiClient.sendLogs(message.test, 'INFO', testLogs),
                  zebrunnerApiClient.startTestSession(message.test),
                  zebrunnerApiClient.sendRunLabels(),
                ])
              })
            })
          }))
      } else {
        startTestPromisesMap.set(message.test.uniqueId,
          runStartPromise.then(() => {
            this.logger.info(path.basename(__filename), `--- TEST STARTED ${message.test.title} ---`)
            return zebrunnerApiClient.startTest(message.test).then(() => {

              const parsedTestLogs = message.test.body
                .split('\n')
                .map((el) => el.trim())
                .filter(el => el !== '() => {' && el !== '}' && el);
              const testLogs = ['ORIGINAL TEST DEFINITION (NOT LIVE LOGS):', ...parsedTestLogs];

              return Promise.all([
                zebrunnerApiClient.sendLogs(message.test, 'INFO', testLogs),
                zebrunnerApiClient.startTestSession(message.test),
                zebrunnerApiClient.sendRunLabels(),
              ])

            })
          }));
      }
      break;
    }
    case EVENT_TEST_PASS: {
      finishTestPromises.push(startTestPromisesMap.get(message.test.uniqueId).then(() => {
        const promises = []
        promises.push(zebrunnerApiClient.finishTestSession(message.test))
        promises.push(zebrunnerApiClient.finishTest(message.test, 'PASSED', null))
        return Promise.all(promises).then(() => {
          this.logger.info(path.basename(__filename), `--- TEST PASSED ${message.test.title} ---`)
        })
      }))
      break;
    }
    case EVENT_TEST_FAIL: {
      finishTestPromises.push(startTestPromisesMap.get(message.test.uniqueId).then(() => {
        const promises = []
        promises.push(zebrunnerApiClient.sendLogs(message.test, 'ERROR', [`Failure message: ${message.err.message}`]))
        promises.push(getFailedScreenshot(message.test.screenshotFileBaseName, message.test.retries).then(screenshots => {
          if (screenshots.length > 0) {
            const promises = []
            screenshots.forEach(screenshot => {
              promises.push(zebrunnerApiClient.sendScreenshot(message.test, screenshot))
            })
            return Promise.all(promises)
          } else {
            return Promise.resolve();
          }
        }))
        promises.push(zebrunnerApiClient.finishTestSession(message.test))
        promises.push(zebrunnerApiClient.finishTest(message.test, 'FAILED', message.err.message))
        return Promise.all(promises).then(() => {
          this.logger.info(path.basename(__filename), `--- TEST FAILED ${message.test.title} ---`)
        })
      }))
      break;
    }
    // custom events: set browser
    case workerEvents.SET_BROWSER: {
      this.logger.info(path.basename(__filename), `register browser was handled with browser ${message.browser.browser.name}`)
      zebrunnerApiClient.registerBrowser(message.browser);
      break;
    }
    // custom events: exit process
    case workerEvents.PARENT_PROCESS_END: {
      // const promises = []
      // promises.push(zebrunnerApiClient.parseResultsAndSendVideo())

      // // additional logic for parallelized runs
      // promises.push(Promise.all(finishTestPromises).then(() => {
      //   this.logger.debug(path.basename(__filename), 'all finish test promises are successfuly done')
      //   return zebrunnerApiClient.getRunSummary().then((res) => {
      //     var anyInProgress = res.data.data.inProgressAmount !== 0
      //     if (!anyInProgress) {
      //       return zebrunnerApiClient.registerTestRunFinish();
      //     } else {
      //       return new Promise(resolve => { resolve() });
      //     }
      //   })
      // }).catch(err => {
      //   this.logger.debug(path.basename(__filename), `finish test promises are done with error ${err}`)
      //   return zebrunnerApiClient.getRunSummary().then((res) => {
      //     var anyInProgress = res.data.data.inProgressAmount !== 0
      //     if (!anyInProgress) {
      //       return zebrunnerApiClient.registerTestRunFinish();
      //     } else {
      //       return new Promise(resolve => { resolve() });
      //     }
      //   })
      // })
      // )

      // Promise.all(promises)
      //   .then(async () => {
      //     this.logger.info(path.basename(__filename), 'worker process finish was handled. exiting child process')
      //     // tmp: sleeping for 1 sec to make sure all http calls are finished properly
      //     await sleep(1000);
      //     process.exit(0)
      //   })
      //   .catch(async (err) => {
      //     this.logger.info(path.basename(__filename), `error in end run promises ${err}`)
      //     // tmp: sleeping for 1 sec to make sure all http calls are finished properly
      //     await sleep(1000);
      //     process.exit(1)
      //   })
      break;
    }

    case EVENT_RUN_END: {
      this.logger.info(path.basename(__filename), 'ZEBRUNNER REPORTER FINISHED')
      const promises = []
      promises.push(zebrunnerApiClient.parseResultsAndSendVideo())
      // additional logic for parallelized runs
      promises.push(Promise.all(finishTestPromises).then(() => {
        this.logger.debug(path.basename(__filename), 'all finish test promises are successfsuly done')
        return zebrunnerApiClient.getRunSummary().then((res) => {
          const anyInProgress = res.data.data.inProgressAmount !== 0
          if (!anyInProgress) {
            return zebrunnerApiClient.registerTestRunFinish();
          } else {
            return Promise.resolve();
          }
        })
      }).catch(err => {
        this.logger.debug(path.basename(__filename), `finish test promises are done with error ${err}`)
        return zebrunnerApiClient.getRunSummary().then((res) => {
          var anyInProgress = res.data.data.inProgressAmount !== 0
          if (!anyInProgress) {
            return zebrunnerApiClient.registerTestRunFinish();
          } else {
            return Promise.resolve();
          }
        })
      })
      )

      Promise.all(promises)
        .then(async () => {
          this.logger.info(path.basename(__filename), 'worker process finish was handled. exiting child process')
          // tmp: sleeping for 1 sec to make sure all http calls are finished properly
          await sleep(1000);
          process.exit(0)
        })
        .catch(async (err) => {
          this.logger.info(path.basename(__filename), `error in end run promises ${err}`)
          // tmp: sleeping for 1 sec to make sure all http calls are finished properly
          await sleep(1000);
          process.exit(1)
        })
      break;
    }
    default:
      break;
  }
});