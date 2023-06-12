const Mocha = require('mocha');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ZebrunnerApiClient = require('./zebr-api-client');
const { workerEvents } = require('./constants');
const { getFailedScreenshot } = require('./utils');
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
let currentTest = null;
const finishTestPromises = [];
const startTestPromisesMap = new Map();
const suiteTestsDurationsMap = new Map();
const testsSessionsMap = new Map();
const artifactsFinishPromises = [];

function startTest(message) {
  const sessionId = uuidv4();
  testsSessionsMap.set(message.test.uniqueId, sessionId);

  currentTest = message.test;

  const startTestPromise = () => runStartPromise
    .then(() => zebrunnerApiClient.startTest(message.test)
      .then(() => {
        zebrunnerApiClient.startTestSession(message.test, sessionId)
          .then(() => {
            const parsedTestLogs = message.test.body
              .split('\n')
              .map((el) => el.trim())
              .filter((el) => el !== '() => {' && el !== '}' && el);
            const testLogs = ['TEST BODY: ', ...parsedTestLogs];

            return Promise.all([
              zebrunnerApiClient.sendLogs(message.test, testLogs, 'INFO'),
              // TODO: check and fix labeling
              zebrunnerApiClient.sendRunLabels(),
            ]);
          }).catch((error) => {
            console.log('startTestSession error: ', error);
          });
      }));

  startTestPromisesMap.set(message.test.uniqueId, startTestPromise());
}

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
      // IMPORTANT: don't delete as it is used by CyServer to truncate video recording
      console.log(`ZEBRUNNER_RUN_BEGIN ${uuidv4()}`);
      this.logger.info(path.basename(__filename), 'ZEBRUNNER REPORTER STARTED');
      break;
    }

    case EVENT_SUITE_BEGIN: {
      console.log(`EVENT_SUITE_BEGIN ${new Date().toLocaleTimeString()}`);
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

          runStartPromise.then(async () => {
            await zebrunnerApiClient.saveTcmConfigs();
          });

          this.suiteRegistered = true;
        }
      }
      break;
    }

    case EVENT_SUITE_END: {
      console.log(`EVENT_SUITE_END ${new Date().toLocaleTimeString()}`);
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
      console.log(`EVENT_TEST_BEGIN: ${message.test.status} ${new Date().toLocaleTimeString()} ${message.test.title}`);
      if (!startTestPromisesMap.get(message.test.uniqueId)) {
        // Use case when EVENT_TEST_BEGIN comes after EVENT_TEST_END for fast tests
        startTest(message);
      }

      // TODO: investigate 'Tell mocha this is a skipped test so it also shows correctly in Cypress'
      // if (!(message.test?.body?.includes('skip()') && message.test?.body?.includes('Tell mocha this is a skipped test so it also shows correctly in Cypress'))) {
      //   if (process.env.REPORTING_RUN_CONTEXT && !process.env.ZEBRUNNER_RUN_ID) {
      //     // TODO: seems outdated, check and remove
      //     // console.log('Start test context exchange is fired');
      //     startTestPromisesMap.set(message.test.uniqueId, contextExchangesPromise.then(() => startTest()));
      //   } else {
      //     // console.log('Start test is fired');
      //     startTestPromisesMap.set(message.test.uniqueId, startTest());
      //   }
      // }
      break;
    }
    case EVENT_TEST_PENDING: {
      // console.log(`EVENT_TEST_PENDING: ${message.test.title} ${new Date().toLocaleTimeString()}`);
      break;
    }
    case EVENT_TEST_PASS: {
      // console.log(`EVENT_TEST_PASS: ${message.test.title} ${new Date().toLocaleTimeString()}`);
      break;
    }
    case EVENT_TEST_FAIL: {
      // console.log(`EVENT_TEST_FAIL: ${message.test.title} ${new Date().toLocaleTimeString()}`);
      break;
    }
    case EVENT_TEST_END: {
      if (!startTestPromisesMap.get(message.test.uniqueId)) {
        console.log('No started test on EVENT_TEST_END!');
        startTest(message);
      }

      const sessionId = testsSessionsMap.get(message.test.uniqueId);

      // IMPORTANT: don't delete as it is used by CyServer to stop video recording
      console.log(`ZEBRUNNER_TEST_END ${sessionId} ${message.test.status} ${new Date().toLocaleTimeString()} ${message.test.title}`);

      if (startTestPromisesMap.get(message.test.uniqueId)) {
        console.log('Test is present in startTestPromisesMap');
        finishTestPromises.push(startTestPromisesMap.get(message.test.uniqueId).then(async () => {
          await Promise.all(artifactsFinishPromises);

          console.log('111');
          const promises = [];
          if (message.test.status.toLowerCase() === 'failed') {
            console.log('222');
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
          console.log('333');
          promises.push(zebrunnerApiClient.updateTcmTestCases(message.test, message.test.status.toUpperCase()));
          promises.push(zebrunnerApiClient.finishTestSession(message.test));
          promises.push(zebrunnerApiClient.finishTest(message.test, message.test.status.toUpperCase(), message.test?.err));

          console.log('444');
          return Promise.all(promises).then(() => {
            console.log('555');
            this.logger.info(path.basename(__filename), `--- TEST ENDED ${message.test.title} ---`);

            currentTest = null;
          }).catch((err) => {
            console.log('666');
            console.log(`Failed to send '${message.test.status.toLowerCase()}' test data, err: `, err);
          });
        }));
      } else {
        console.log('777');
        console.error(`Test with id ${message.test.uniqueId} not found`);
      }
      break;
    }

    case workerEvents.SET_BROWSER: {
      this.logger.info(path.basename(__filename), `register browser was handled with browser ${message.browser.browser.name}`);
      zebrunnerApiClient.registerBrowser(message.browser);
      break;
    }

    case workerEvents.ATTACH_TEST_LABELS: {
      const requestBody = {
        items: message.labels?.values?.map((value) => ({ key: message.labels.key, value })),
      };

      zebrunnerApiClient.sendTestLabels(currentTest, requestBody);
      break;
    }

    case workerEvents.ATTACH_LAUNCH_LABELS: {
      const requestBody = {
        items: message.labels?.values?.map((value) => ({ key: message.labels.key, value })),
      };

      zebrunnerApiClient.sendLaunchLabels(requestBody);
      break;
    }

    case workerEvents.ADD_TEST_CASES: {
      const test = currentTest;

      if (test) {
        artifactsFinishPromises.push(startTestPromisesMap.get(test.uniqueId).then(() => {
          zebrunnerApiClient.addTestCases(test, message.testCase);
        }));
      }
      break;
    }

    case EVENT_RUN_END: {
      console.log('ZEBRUNNER_RUN_END');
      break;
    }
    default:
      break;
  }
});
