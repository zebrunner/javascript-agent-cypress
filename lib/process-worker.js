const Mocha = require('mocha');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const v8 = require('v8');
const ZebrunnerApiClient = require('./zebr-api-client');
const { workerEvents } = require('./constants');
const { getFailedScreenshot, writeToFile } = require('./utils');
const { ConfigResolver } = require('./config-resolver');
const { LogUtil } = require('./log-util');
const FormData = require('form-data');
const fs = require('fs');

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
const middlewareFinishPromises = [];

const until = (predFn) => {
  const poll = (resolve) => (predFn() ? resolve() : setTimeout(() => poll(resolve), 100));

  return new Promise(poll);
};

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
          if (process.env.LAUNCH_UUID) {
            runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite, process.env.LAUNCH_UUID);

            // } else if (process.env.REPORTING_RUN_CONTEXT) {
            //   contextExchangesPromise = zebrunnerApiClient.contextExchanges(JSON.parse(process.env.REPORTING_RUN_CONTEXT))
            //     .then((data) => {
            //       runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite, data.testRunUuid);
            //     });
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
      // console.log(`EVENT_TEST_BEGIN: ${message.test.status} ${new Date().toLocaleTimeString()} ${message.test.title}`);

      const sessionId = uuidv4();
      testsSessionsMap.set(message.test.uniqueId, sessionId);

      console.log(`ZEBRUNNER_TEST_BEGIN ${sessionId} ${new Date().toLocaleTimeString()} ${message.test.title}`);

      const startTestPromise = () =>
        runStartPromise.then(() =>
          zebrunnerApiClient.startTest(message.test).then(() => {
            zebrunnerApiClient
              .startTestSession(message.test, sessionId)
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
              })
              .catch((error) => {
                console.log('startTestSession error: ', error);
              });
          }),
        );

      // TODO: investigate if this block helps do not show Pending tests that will be removed in Zebrunner when they are In Progress
      if (
        !(
          message.test?.body?.includes('skip()') &&
          message.test?.body?.includes('Tell mocha this is a skipped test so it also shows correctly in Cypress')
        )
      ) {
        if (process.env.REPORTING_RUN_CONTEXT && !process.env.ZEBRUNNER_RUN_ID) {
          // console.log('Start test context exchange is fired');
          startTestPromisesMap.set(
            message.test.uniqueId,
            contextExchangesPromise.then(() => startTestPromise()),
          );
        } else {
          // console.log('Start test is fired');
          startTestPromisesMap.set(message.test.uniqueId, startTestPromise());
        }
      }
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
      // const stats = v8.getHeapStatistics();
      // const totalHeapSizeGb = (stats.total_heap_size / 1024 / 1024 / 1024).toFixed(2);
      // console.log('totalHeapSizeGb: ', totalHeapSizeGb);
      // console.log('full heapStatistics: ', stats);

      if (!startTestPromisesMap.get(message.test.uniqueId)) {
        console.log(`Test skipped by Cypress (cypress-cucumber-preprocessor): ${message.test.title}`);
        break;
      }

      if (message.test.isReverted) {
        console.log(`Test skipped since test registration in Zebrunner was reverted: ${message.test.title}`);
        break;
      }

      const sessionId = testsSessionsMap.get(message.test.uniqueId);

      // IMPORTANT: don't delete as it is used by CyServer to stop video recording
      console.log(
        `ZEBRUNNER_TEST_END ${sessionId} ${message.test.status} ${new Date().toLocaleTimeString()} ${
          message.test.title
        }`,
      );

      if (message.test.status.toLowerCase() === 'pending') {
        finishTestPromises.push(zebrunnerApiClient.deleteTest(message.test));
      } else if (startTestPromisesMap.get(message.test.uniqueId)) {
        finishTestPromises.push(
          startTestPromisesMap.get(message.test.uniqueId).then(async () => {
            await Promise.all(middlewareFinishPromises);

            const promises = [];
            if (message.test.status.toLowerCase() === 'failed') {
              promises.push(
                zebrunnerApiClient.sendLogs(message.test, [`Failure message: ${message.test?.err}`], 'ERROR'),
              );
              promises.push(
                getFailedScreenshot(message.test.screenshotFileBaseName, message.test.retries).then((screenshots) => {
                  if (screenshots.length > 0) {
                    const screenshotsPromises = [];
                    screenshots.forEach((screenshot) => {
                      screenshotsPromises.push(zebrunnerApiClient.sendScreenshot(message.test, screenshot));
                    });
                    return Promise.all(screenshotsPromises);
                  }

                  return Promise.resolve();
                }),
              );
            }
            promises.push(zebrunnerApiClient.updateTcmTestCases(message.test, message.test.status.toUpperCase()));
            promises.push(zebrunnerApiClient.finishTestSession(message.test));
            promises.push(
              zebrunnerApiClient.finishTest(message.test, message.test.status.toUpperCase(), message.test?.err),
            );

            return Promise.all(promises)
              .then(() => {
                this.logger.info(path.basename(__filename), `--- TEST ENDED ${message.test.title} ---`);
              })
              .catch((err) => {
                console.log(`Failed to send '${message.test.status.toLowerCase()}' test data, err: `, err);
              });
          }),
        );
      } else {
        console.error(`Test with id ${message.test.uniqueId} not found`);
      }
      break;
    }

    case workerEvents.SET_BROWSER: {
      this.logger.info(
        path.basename(__filename),
        `register browser was handled with browser ${message.browser.browser.name}`,
      );
      zebrunnerApiClient.registerBrowser(message.browser);
      break;
    }

    case workerEvents.ATTACH_TEST_LABELS: {
      const { test } = message;
      if (!test) {
        break;
      }

      await until(() => !!startTestPromisesMap.get(test.uniqueId));

      const requestBody = {
        items: message.labels?.values?.map((value) => ({ key: message.labels.key, value })),
      };

      middlewareFinishPromises.push(
        startTestPromisesMap.get(test.uniqueId).then(() => {
          zebrunnerApiClient.sendTestLabels(test, requestBody);
        }),
      );

      break;
    }

    case workerEvents.ATTACH_LAUNCH_LABELS: {
      const requestBody = {
        items: message.labels?.values?.map((value) => ({ key: message.labels.key, value })),
      };

      zebrunnerApiClient.sendLaunchLabels(requestBody);

      break;
    }

    case workerEvents.ATTACH_TEST_ARTIFACT_REFERENCE: {
      const { test, artifactReference } = message;
      if (!test) {
        break;
      }

      await until(() => !!startTestPromisesMap.get(test.uniqueId));

      const requestBody = { items: [artifactReference] };
      middlewareFinishPromises.push(
        startTestPromisesMap.get(test.uniqueId).then(() => {
          zebrunnerApiClient.sendTestArtifactReference(test, requestBody);
        }),
      );

      break;
    }

    case workerEvents.ATTACH_LAUNCH_ARTIFACT_REFERENCE: {
      const { artifactReference } = message;

      const requestBody = {
        items: [artifactReference],
      };

      zebrunnerApiClient.sendLaunchArtifactReference(requestBody);

      break;
    }

    case workerEvents.REVERT_TEST_REGISTRATION: {
      const { test } = message;
      if (test?.isReverted || !test) {
        break;
      }

      await until(() => !!startTestPromisesMap.get(test.uniqueId));

      middlewareFinishPromises.push(
        startTestPromisesMap.get(test.uniqueId).then(() => {
          zebrunnerApiClient.revertTestRegistration(test);
        }),
      );

      break;
    }

    case workerEvents.ADD_TEST_CASES: {
      const { test } = message;
      if (!test) {
        break;
      }

      await until(() => !!startTestPromisesMap.get(test.uniqueId));

      middlewareFinishPromises.push(
        startTestPromisesMap.get(test.uniqueId).then(() => {
          zebrunnerApiClient.addTestCases(test, message.testCase);
        }),
      );

      break;
    }

    case workerEvents.ATTACH_LAUNCH_ARTIFACT: {
      const { artifact } = message;
      const { pathOrBuffer, name, timestamp } = artifact;

      if (!Buffer.isBuffer(pathOrBuffer) && !fs.existsSync(pathOrBuffer)) {
        console.log(
          `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`,
        );
        break;
      }

      if (name && !name.trim().length) {
        console.log(`fileName must not be a blank string. Provided value is '${name}'`);
        break;
      }

      const formData = new FormData();
      const isBuffer = Buffer.isBuffer(pathOrBuffer);
      formData.append(
        'file',
        isBuffer ? pathOrBuffer : fs.createReadStream(pathOrBuffer),
        name ? name : isBuffer ? `file_${new Date(timestamp).toISOString()}` : null,
      );

      await zebrunnerApiClient.uploadLaunchArtifact(formData.getHeaders()['content-type'], formData);

      break;
    }

    case workerEvents.ATTACH_TEST_ARTIFACT: {
      const { test, artifact } = message;
      if (!test) {
        break;
      }

      await until(() => !!startTestPromisesMap.get(test.uniqueId));

      const { pathOrBuffer, name, timestamp } = artifact;

      if (!Buffer.isBuffer(pathOrBuffer) && !fs.existsSync(pathOrBuffer)) {
        console.error(
          `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`,
        );
        break;
      }

      if (name && !name.trim().length) {
        console.error(`fileName must not be a blank string. Provided value is '${name}'`);
        break;
      }

      const formData = new FormData();
      const isBuffer = Buffer.isBuffer(pathOrBuffer);
      formData.append(
        'file',
        isBuffer ? pathOrBuffer : fs.createReadStream(pathOrBuffer),
        name ? name : isBuffer ? `file_${new Date(timestamp).toISOString()}` : null,
      );

      middlewareFinishPromises.push(
        startTestPromisesMap.get(test.uniqueId).then(() => {
          zebrunnerApiClient.uploadTestArtifact(formData.getHeaders()['content-type'], formData, test);
        }),
      );

      break;
    }

    case EVENT_RUN_END: {
      await Promise.all(finishTestPromises);

      if (process.env.ZEBRUNNER_RUN_ID) {
        writeToFile('./', `.${process.env.ZEBRUNNER_RUN_ID}`, `ZEBRUNNER_RUN_END: ${process.env.ZEBRUNNER_RUN_ID}`);
      }
      break;
    }
    default:
      break;
  }
});
