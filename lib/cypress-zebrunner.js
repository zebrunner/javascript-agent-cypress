const Mocha = require('mocha');
const { fork } = require('child_process');
const { workerEvents } = require('./constants');
const { parseSuiteStartObject, parseSuiteEndObject, parseTestInfo, testParse } = require('./object-transformer');

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_BEGIN,
  EVENT_TEST_PENDING,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_TEST_END,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
} = Mocha.Runner.constants;

const { startZbrIPC } = require('./ipc/server');
const { EVENTS } = require('./ipc/events');

let cypressConfigSearched = false;
let cypressConfig;

// this reporter outputs test results, indenting two spaces per suite
class ZbrReporter extends Mocha.reporters.Base {
  constructor(runner, config) {
    super(runner);
    this.runner = runner;
    this.currentTest = null;
    this.isCurrentTestReverted = null;

    if (!ZbrReporter.worker) {
      this.worker = fork(`${__dirname}/process-worker.js`, [], {
        detached: true,
      });
      this.worker.send({ event: workerEvents.WORKER_INIT, config });

      const processConfigEvent = (cyConfig) => {
        cypressConfig = cyConfig;
      };
      const registerBrowserEvent = (browser) => {
        this.worker.send({
          event: workerEvents.SET_BROWSER,
          browser,
        });
      };
      const attachTestLabelsEvent = (labels) => {
        this.worker.send({
          event: workerEvents.ATTACH_TEST_LABELS,
          test: this.currentTest,
          labels,
        });
      };
      const attachLaunchLabelsEvent = (labels) => {
        this.worker.send({
          event: workerEvents.ATTACH_LAUNCH_LABELS,
          labels,
        });
      };
      const revertTestRegistrationEvent = () => {
        this.worker.send({
          event: workerEvents.REVERT_TEST_REGISTRATION,
          test: { ...this.currentTest, isReverted: this.isCurrentTestReverted },
        });
        this.isCurrentTestReverted = true;
      };
      const attachLaunchArtifactReferenceEvent = (artifactReference) => {
        this.worker.send({
          event: workerEvents.ATTACH_LAUNCH_ARTIFACT_REFERENCE,
          artifactReference,
        });
      };
      const attachTestArtifactReferenceEvent = (artifactReference) => {
        this.worker.send({
          event: workerEvents.ATTACH_TEST_ARTIFACT_REFERENCE,
          test: this.currentTest,
          artifactReference,
        });
      };
      const attachLaunchArtifactEvent = (artifact) => {
        this.worker.send({
          event: workerEvents.ATTACH_LAUNCH_ARTIFACT,
          artifact,
        });
      };
      const attachTestArtifactEvent = (artifact) => {
        this.worker.send({
          event: workerEvents.ATTACH_TEST_ARTIFACT,
          test: this.currentTest,
          artifact,
        });
      };
      const addTestCases = (testCase) =>
        this.worker.send({ event: workerEvents.ADD_TEST_CASES, test: this.currentTest, testCase });

      startZbrIPC(
        (server) => {
          server.on(EVENTS.CONFIG, processConfigEvent);
          server.on(EVENTS.REG_BROWSER, registerBrowserEvent);
          server.on(EVENTS.ATTACH_TEST_LABELS, attachTestLabelsEvent);
          server.on(EVENTS.ATTACH_LAUNCH_LABELS, attachLaunchLabelsEvent);
          server.on(EVENTS.REVERT_TEST_REGISTRATION, revertTestRegistrationEvent);
          server.on(EVENTS.ATTACH_TEST_ARTIFACT_REFERENCE, attachTestArtifactReferenceEvent);
          server.on(EVENTS.ATTACH_LAUNCH_ARTIFACT_REFERENCE, attachLaunchArtifactReferenceEvent);
          server.on(EVENTS.ATTACH_TEST_ARTIFACT, attachTestArtifactEvent);
          server.on(EVENTS.ATTACH_LAUNCH_ARTIFACT, attachLaunchArtifactEvent);
          server.on(EVENTS.ADD_TEST_CASES, addTestCases);
        },
        (server) => {
          server.off(EVENTS.CONFIG, '*');
          server.off(EVENTS.REG_BROWSER, '*');
          server.off(EVENTS.ATTACH_TEST_LABELS, '*');
          server.off(EVENTS.ATTACH_LAUNCH_LABELS, '*');
          server.off(EVENTS.REVERT_TEST_REGISTRATION, '*');
          server.off(EVENTS.ATTACH_TEST_ARTIFACT_REFERENCE, '*');
          server.off(EVENTS.ATTACH_LAUNCH_ARTIFACT_REFERENCE, '*');
          server.off(EVENTS.ATTACH_TEST_ARTIFACT, '*');
          server.off(EVENTS.ATTACH_LAUNCH_ARTIFACT, '*');
          server.off(EVENTS.ADD_TEST_CASES, '*');
        },
      );

      ZbrReporter.worker = this.worker;
    } else {
      this.worker = ZbrReporter.worker;
    }

    this.runner
      .once(EVENT_RUN_BEGIN, () => {
        this.worker.send({
          event: EVENT_RUN_BEGIN,
          config,
        });
      })
      .on(EVENT_SUITE_BEGIN, (suite) => {
        this.worker.send({
          event: EVENT_SUITE_BEGIN,
          suite: parseSuiteStartObject(suite, this.runner.suite.file),
        });
      })
      .on(EVENT_SUITE_END, (suite) => {
        if (suite.title === '') {
          const parsedTests = testParse(suite.suites, []);
          const preparedSuiteObj = {
            suiteTitle: suite.suites[0].title,
            suiteFileName: suite.file
              .split('/')
              .filter((e) => e !== 'cypress' && e !== 'e2e' && e !== 'component')
              .join('/'),
            videoFolder: cypressConfig.videosFolder,
            tests: parsedTests,
          };
          this.worker.send({
            event: EVENT_SUITE_END,
            suite: parseSuiteEndObject(suite),
            suiteTestsDurations: preparedSuiteObj,
          });
        }
      })
      .on(EVENT_TEST_BEGIN, (test) => {
        this.currentTest = parseTestInfo(cypressConfig, test, this.runner.suite.file);
        getCypressConfig().then(() => {
          this.worker.send({
            event: EVENT_TEST_BEGIN,
            test: parseTestInfo(cypressConfig, test, this.runner.suite.file),
          });
        });
      })
      .on(EVENT_TEST_PENDING, (test) => {
        getCypressConfig().then(() => {
          this.worker.send({
            event: EVENT_TEST_PENDING,
            test: parseTestInfo(cypressConfig, test, this.runner.suite.file),
          });
        });
      })
      .on(EVENT_TEST_PASS, (test) => {
        getCypressConfig().then(() => {
          this.worker.send({
            event: EVENT_TEST_PASS,
            test: parseTestInfo(cypressConfig, test, this.runner.suite.file),
          });
        });
      })
      .on(EVENT_TEST_FAIL, (test, err) => {
        getCypressConfig().then(() => {
          this.worker.send({
            event: EVENT_TEST_FAIL,
            test: parseTestInfo(cypressConfig, test, this.runner.suite.file),
            err,
          });
        });
      })
      .on(EVENT_TEST_END, (test, err) => {
        getCypressConfig().then(() => {
          this.worker.send({
            event: EVENT_TEST_END,
            test: {
              ...parseTestInfo(cypressConfig, test, this.runner.suite.file),
              isReverted: this.isCurrentTestReverted,
            },
            err,
          });
        });
        this.currentTest = null;
      })
      .once(EVENT_RUN_END, async () => {
        this.worker.send({
          event: EVENT_RUN_END,
        });
      });
  }
}

process.on('exit', () => {
  console.log('----- Cypress running is done -----');
  sendEndProcessEvent();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('----- Caught interrupt signal -----');
  sendEndProcessEvent();
  process.exit(1);
});

// workaround for ctrl+C handling on Win platform
if (process.platform === 'win32') {
  // eslint-disable-next-line global-require
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('SIGINT', () => {
    console.log('----- Caught interrupt signal (Windows) -----');
    sendEndProcessEvent();
  });
}

function sendEndProcessEvent() {
  if (ZbrReporter.worker) {
    ZbrReporter.worker.send({
      event: workerEvents.PARENT_PROCESS_END,
    });
  }
}

function getCypressConfig() {
  return new Promise((resolve) => {
    if (!cypressConfig && !cypressConfigSearched) {
      cypressConfigSearched = true;
      // max time waiting for cypress config is 3 sec (15 x 200ms)
      let attempts = 15;
      const waitForCfg = async () => {
        console.log('waiting for cypressConfig is defined');
        while (!cypressConfig && attempts-- > 0) await new Promise((resolve) => setTimeout(resolve, 200));
        console.log('waiting for cypressConfig is finished');
        resolve(cypressConfig);
      };
      waitForCfg();
    } else {
      resolve(undefined);
    }
  });
}

module.exports = ZbrReporter;
