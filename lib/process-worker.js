const Mocha = require('mocha');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const glob = require('glob');
const ZebrunnerApiClient = require('./zebr-api-client');
const { workerEvents } = require('./constants');
const { getFailedScreenshot, executeShell } = require('./utils');
const { ConfigResolver } = require('./config-resolver');
const { LogUtil } = require('./log-util');

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_BEGIN,
  EVENT_TEST_PENDING,
  EVENT_TEST_PASS,
  EVENT_TEST_FAIL,
  EVENT_TEST_END,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
} = Mocha.Runner.constants;

let zebrunnerApiClient;
let contextExchangesPromise;
let runStartPromise = process.env.ZEBRUNNER_RUN_ID ? new Promise((resolve) => resolve()) : null;
const finishTestPromises = [];
const startTestPromisesMap = new Map();
const suiteTestsDurationsMap = new Map();
const testsSessionsMap = new Map();
// const testSuitesFileContentMap = new Map();

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
      this.logger.info(path.basename(__filename), 'ZEBRUNNER REPORTER STARTED');
      break;
    }

    case EVENT_SUITE_BEGIN: {
      console.log('EVENT_SUITE_BEGIN');
      console.log(new Date(Date.now()).toString());
      console.log('message', message);
      // as of now only the first (root) suite will be registered as a new run in zebrunner
      if (message.suite.title && !process.env.ZEBRUNNER_RUN_ID) {
        this.logger.info(path.basename(__filename), `suite started. name: ${message.suite.title}`);
        if (!this.suiteRegistered) {
          this.logger.info(path.basename(__filename), 'first suite registered!');
          if (process.env.REPORTING_RUN_CONTEXT) {
            contextExchangesPromise = zebrunnerApiClient.contextExchanges(JSON.parse(process.env.REPORTING_RUN_CONTEXT))
              .then((data) => {
                runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite, data.data.testRunUuid);
              });
          } else {
            runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite);
          }
          this.suiteRegistered = true;
        }
      }
      break;
    }

    case EVENT_SUITE_END: {
      console.log('EVENT_SUITE_END');
      console.log(new Date(Date.now()).toString());
      console.log('message', message);
      if (message.suite.title) {
        this.logger.info(path.basename(__filename), `suite finished. name: ${message.suite.title}`);
      }
      // video splitting info gathering logic
      // Exactly this event needed for video split info gathering because only here we have tests wallClockDuration data.
      if (message.suiteTestsDurations) {
        const suiteInfo = {
          suiteTitle: message.suiteTestsDurations.suiteTitle,
          suiteFileName: message.suiteTestsDurations.suiteFileName,
          videoFolder: message.suiteTestsDurations.videoFolder,
        };
        suiteTestsDurationsMap.set(suiteInfo, message.suiteTestsDurations.tests);
        // zebrunnerApiClient.setTestsData(`zebSuiteTestsData${process.env.HOSTNAME || ''}`, JSON.stringify(suiteTestsDurationsMap, mapJsonReplacer));
      }
      break;
    }

    case EVENT_TEST_BEGIN: {
      console.log('EVENT_TEST_BEGIN');
      console.log(new Date(Date.now()).toString());
      console.log('message', message);
      const startTest = () => runStartPromise
        .then(() => zebrunnerApiClient.startTest(message.test)
          .then(() => {
            const sessionId = uuidv4();
            testsSessionsMap.set(message.test.uniqueId, sessionId);
            zebrunnerApiClient.startTestSession(message.test, sessionId)
              .then(() => {
                console.log('Start capturing artifacts sessionId', sessionId);
                const startRecPath = '/opt/cypress/start-capture-artifacts.sh';
                const start_rec_command = `${startRecPath} ${sessionId} >> /tmp/video.log 2>&1`;
                glob(startRecPath, {}, (err, files) => {
                  if (files.length) {
                    (0, executeShell)(start_rec_command, 'Start capturing artifacts');
                  }
                });

                const parsedTestLogs = message.test.body
                  .split('\n')
                  .map((el) => el.trim())
                  .filter((el) => el !== '() => {' && el !== '}' && el);
                const testLogs = ['ORIGINAL TEST DEFINITION (NOT LIVE LOGS):', ...parsedTestLogs];

                return Promise.all([
                  zebrunnerApiClient.sendLogs(message.test, testLogs, 'INFO'),
                  zebrunnerApiClient.sendRunLabels(),
                ]);
              }).catch((error) => {
                console.log('startTestSession error: ', error);
              });
          }));

      if (!(message.test?.body?.includes('skip()') && message.test?.body?.includes('Tell mocha this is a skipped test so it also shows correctly in Cypress'))) {
        if (process.env.REPORTING_RUN_CONTEXT && !process.env.ZEBRUNNER_RUN_ID) {
          console.log('Start test context exchange is fired');
          startTestPromisesMap.set(message.test.uniqueId, contextExchangesPromise.then(() => startTest()));
          console.log(`VD variant: ${startTestPromisesMap.get(message.test.uniqueId)}`);
        } else {
          console.log('Start test is fired');
          startTestPromisesMap.set(message.test.uniqueId, startTest());
          console.log(`SBJr variant: ${startTestPromisesMap.get(message.test.uniqueId)}`);
        }
      }
      break;
    }
    case EVENT_TEST_PENDING: {
      console.log('EVENT_TEST_PENDING');
      console.log(new Date(Date.now()).toString());
      console.log('message', message);
      break;
    }
    case EVENT_TEST_PASS: {
      console.log('EVENT_TEST_PASS');
      console.log(new Date(Date.now()).toString());
      console.log('message', message);
      break;
    }
    case EVENT_TEST_FAIL: {
      console.log('EVENT_TEST_FAIL');
      console.log(new Date(Date.now()).toString());
      console.log('message', message);
      break;
    }
    case EVENT_TEST_END: {
      console.log('EVENT_TEST_END');
      console.log(new Date(Date.now()).toString());
      console.log('message', message);
      console.log(`EVENT_TEST_END test promise(${message.test.uniqueId}): ${startTestPromisesMap.get(message.test.uniqueId)}`);
      // const suiteFilePath = path.join(__dirname, '..', message.test.testFileName);
      const sessionId = testsSessionsMap.get(message.test.uniqueId);

      if (sessionId) {
        console.log('Stop capturing artifacts sessionId', sessionId);
        const stopRecPath = '/opt/cypress/stop-capture-artifacts.sh';
        const stop_rec_command = `${stopRecPath} ${sessionId}`;
        glob(stopRecPath, {}, (err, files) => {
          if (files.length) {
            (0, executeShell)(stop_rec_command, 'Stop capturing artifacts', sessionId);
          }
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (message.test.status.toLowerCase() === 'pending') {
        zebrunnerApiClient.deleteTest(message.test).then(() => {
          console.log('Pending test deleted');
        });
      } else if (startTestPromisesMap.get(message.test.uniqueId)) {
        console.log(`Test promise(${message.test.uniqueId}): ${startTestPromisesMap.get(message.test.uniqueId)}`);
        if (sessionId) {
          const uploadPath = '/opt/cypress/upload-artifacts.sh';
          const upload_vid_command = `${uploadPath} ${sessionId}`;
          glob(uploadPath, {}, (err, files) => {
            if (files.length) {
              (0, executeShell)(upload_vid_command, 'Video upload', sessionId);
            }
          });
        }

        finishTestPromises.push(startTestPromisesMap.get(message.test.uniqueId).then(() => {
          const promises = [];
          if (message.test.status.toLowerCase() === 'failed') {
            promises.push(zebrunnerApiClient.sendLogs(message.test, [`Failure message: ${message.test?.err}`], 'ERROR'));
            promises.push(getFailedScreenshot(message.test.screenshotFileBaseName, message.test.retries).then((screenshots) => {
              if (screenshots.length > 0) {
                const screenshotsPromises = [];
                screenshots.forEach((screenshot) => {
                  screenshotsPromises.push(zebrunnerApiClient.sendScreenshot(message.test, screenshot));
                });
                return Promise.all(screenshotsPromises);
              }

              return Promise.resolve();
            }));
          }
          promises.push(zebrunnerApiClient.finishTestSession(message.test));
          promises.push(zebrunnerApiClient.finishTest(message.test, message.test.status.toUpperCase(), message.test?.err));

          return Promise.all(promises).then(() => {
            this.logger.info(path.basename(__filename), `--- TEST ENDED ${message.test.title} ---`);
          }).catch((err) => {
            console.log(`Failed to send '${message.test.status.toLowerCase()}' test data, err: `, err);
          });
        }));
      } else {
        console.error(`Test with id ${message.test.uniqueId} not found`);
      }
      break;
    }
    // custom events: set browser
    case workerEvents.SET_BROWSER: {
      this.logger.info(path.basename(__filename), `register browser was handled with browser ${message.browser.browser.name}`);
      zebrunnerApiClient.registerBrowser(message.browser);
      break;
    }

    case EVENT_RUN_END: {
      console.log('ZEBRUNNER REPORTER FINISHED');
      console.log(new Date(Date.now()).toString());
      console.log('message', message);
      break;
    }
    default:
      break;
  }
});
