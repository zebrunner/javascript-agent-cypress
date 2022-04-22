const Mocha = require('mocha');
const ZebrunnerApiClient = require('./zebr-api-client.js')
const {workerEvents} = require('./constants')
const {getFailedScreenshot, logToFile, getObjectAsString} = require('./utils');
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
  EVENT_HOOK_BEGIN,
  EVENT_HOOK_END,
} = Mocha.Runner.constants;

var zebrunnerApiClient;
var runStartPromise;
var finishTestPromises = []
var startTestPromisesMap = new Map();
process.on('message', (message) => {
  const { event } = message;
  switch (event) {
    case workerEvents.WORKER_INIT:
      this.suiteRegistered = false;
      this.configResolver = new ConfigResolver(message.config);
      this.logger = new LogUtil(this.configResolver);
      zebrunnerApiClient = new ZebrunnerApiClient(message.config, this.configResolver, this.logger);
      break;
    case EVENT_RUN_BEGIN:
      this.logger.info(path.basename(__filename), 'ZEBRUNNER REPORTER STARTED')
      break;
    case EVENT_RUN_END:
      this.logger.info(path.basename(__filename), 'ZEBRUNNER REPORTER FINISHED')
      break;
    case EVENT_SUITE_BEGIN:
      // as of now only the first (root) suite will be registered as a new run in zebrunner
      if(message.suite.title) {
        this.logger.info(path.basename(__filename), 'suite started. name: ' + message.suite.title)
        if(!this.suiteRegistered) {
          this.logger.info(path.basename(__filename), 'first suite registered!')
          runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite);
          this.suiteRegistered = true
        }
      }
      break;
    case EVENT_SUITE_END:
      if(message.suite.title) {
        this.logger.info(path.basename(__filename), 'suite finished. name: ' + message.suite.title)
      }
      break;
    case EVENT_TEST_BEGIN:
      startTestPromisesMap.set(message.test.uniqueId,
        runStartPromise.then(() => {
          this.logger.info(path.basename(__filename), `--- TEST STARTED ${message.test.title} ---`)
          return zebrunnerApiClient.startTest(message.test).then(() => {
            var messages = [];
            messages.push('ORIGINAL TEST DEFINITION (NOT LIVE LOGS):')
            message.test.body.split(/\r\n|\n\r|\n|\r/).forEach( (m) => {
              messages.push(m);
            });
            zebrunnerApiClient.sendLogs(message.test, 'INFO', messages);            

            zebrunnerApiClient.startTestSession(message.test);

            zebrunnerApiClient.sendRunLabels();
          })
        }))
      break;
    case EVENT_TEST_PASS:
      finishTestPromises.push(startTestPromisesMap.get(message.test.uniqueId).then(() => {
        var promises = []
        promises.push(zebrunnerApiClient.finishTestSession(message.test))
        promises.push(zebrunnerApiClient.finishTest(message.test, 'PASSED', null))
        return Promise.all(promises).then(() => {
          this.logger.info(path.basename(__filename), `--- TEST PASSED ${message.test.title} ---`)
        })
      }))
      break;
    case EVENT_TEST_FAIL:
      finishTestPromises.push(startTestPromisesMap.get(message.test.uniqueId).then(() => {
        var promises = []
        promises.push(zebrunnerApiClient.sendLogs(message.test, 'ERROR', [`Failure message: ${message.err.message}`]))
        promises.push(getFailedScreenshot(message.test.screenshotFileBaseName, message.test.retries).then(screenshots => {
          if(screenshots.length > 0) {
            var promises = []
            screenshots.forEach(screenshot => {
              promises.push(zebrunnerApiClient.sendScreenshot(message.test, screenshot))
            })
            return Promise.all(promises)
          } else {
            return new Promise(resolve => {resolve()});
          }
        }))  
        promises.push(zebrunnerApiClient.finishTestSession(message.test))
        promises.push(zebrunnerApiClient.finishTest(message.test, 'FAILED', message.err.message))
        return Promise.all(promises).then(() => {
          this.logger.info(path.basename(__filename), `--- TEST FAILED ${message.test.title} ---`)
        })
      }))
      break;

    // custom events: set browser
    case workerEvents.SET_BROWSER:

      this.logger.info(path.basename(__filename), `register browser was handled with browser ${message.browser.browser.name}`)
      zebrunnerApiClient.registerBrowser(message.browser);
      break;

    // custom events: exit process
    case workerEvents.PARENT_PROCESS_END:
      var promises = []
      promises.push(zebrunnerApiClient.parseResultsAndSendVideo())

      // additional logic for parallelized runs
      promises.push(Promise.all(finishTestPromises).then(() => {
        this.logger.debug(path.basename(__filename), 'all finish test promises are successfuly done')
        return zebrunnerApiClient.getRunSummary().then((res) => {
          var anyInProgress = res.data.data.inProgressAmount !== 0
          if(!anyInProgress) {
            return zebrunnerApiClient.registerTestRunFinish();
          } else {
            return new Promise(resolve => {resolve()});
          }
        })
      }).catch(err => {
        this.logger.debug(path.basename(__filename), `finish test promises are done with error ${err}`)
        return zebrunnerApiClient.getRunSummary().then((res) => {
          var anyInProgress = res.data.data.inProgressAmount !== 0
          if(!anyInProgress) {
            return zebrunnerApiClient.registerTestRunFinish();
          } else {
            return new Promise(resolve => {resolve()});
          }
        })
      })
      )

      Promise.all(promises)
      .then(() => {
        this.logger.info(path.basename(__filename), 'worker process finish was handled. exiting child process')
        process.exit(0)
      })
      .catch((err) => {
        this.logger.info(path.basename(__filename), `error in end run promises ${err}`)
        process.exit(1)
      })
      break;
    default:
      break;
  }
});