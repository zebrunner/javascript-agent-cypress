'use strict';

const ZebrunnerApiClient = require('./zebr-api-client.js')
const {getFailedScreenshot, getObjectAsString} = require('./utils')

const Cypress = require('cypress');
const Mocha = require('mocha');

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_BEGIN,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END
} = Mocha.Runner.constants;

const { startZbrIPC } = require('./ipc/server');
const { EVENTS } = require('./ipc/events');

// this reporter outputs test results, indenting two spaces per suite
class ZbrReporter {
  constructor(runner, config) {
  // const stats = runner.stats;

    this.zebrunnerApiClient = new ZebrunnerApiClient(config);
    this.suiteRegistered = false;
    this.suitesCount = 0;

    const processConfigEvent = (cypressConfig) => {
    // console.log(`config event was triggered ${cypressConfig}`)
    };
    const registerBrowserEvent = (browser) => {
      console.log(`register browser was handled with browser ${browser.browser.name}`)
      this.zebrunnerApiClient.registerBrowser(browser);
    };

    startZbrIPC(
      (server) => {
        server.on(EVENTS.CONFIG, processConfigEvent);
        server.on(EVENTS.REG_BROWSER, registerBrowserEvent)
      },
      (server) => {
        server.off(EVENTS.CONFIG, '*');
        server.off(EVENTS.REG_BROWSER, '*');
      },
    );

    var runStartPromise

    runner
      .once(EVENT_RUN_BEGIN, () => {
        console.log('ZEBRUNNER REPORTER STARTED');
      })
      .on(EVENT_SUITE_BEGIN, (suite) => {
        console.log('suite started. name: ' + suite.title)
        if(suite.title) {
          this.suitesCount ++
        }
        // as of now only the first (root) suite will be registered as a new run in zebrunner
        if(suite.title && !this.suiteRegistered) {
          runStartPromise = this.zebrunnerApiClient.registerTestRunStart(suite);
          this.suiteRegistered = true
        }
      })
      .on(EVENT_SUITE_END, (suite) => {
        console.log('suite finished. name: ' + suite.title)
        if(suite.title) {
          this.suitesCount --
        }
        if(suite.title && this.suitesCount === 0) {
          this.zebrunnerApiClient.registerTestRunFinish()
        }
      })
      .on(EVENT_TEST_BEGIN, test => {
        runStartPromise.then(() => {
          this.zebrunnerApiClient.startTest(test).then(() => {
            var messages = [];
            messages.push('ORIGINAL TEST DEFINITION (NOT LIVE LOGS):')
            test.body.split(/\r\n|\n\r|\n|\r/).forEach( (m) => {
              messages.push(m);
            });
            this.zebrunnerApiClient.sendLogs(test, messages);            

            this.zebrunnerApiClient.startTestSession(test);

            this.zebrunnerApiClient.sendRunLabels();
          })
        })
      })
      .on(EVENT_TEST_PASS, test => {
        this.zebrunnerApiClient.finishTestSession(test)
        this.zebrunnerApiClient.finishTest(test, 'PASSED', null)
      })
      .on(EVENT_TEST_FAIL, (test, err) => {
        this.zebrunnerApiClient.sendLogs(test, [`Failure message: ${err.message}`])

        const postScreen = async() => {
          let screenshot = await getFailedScreenshot(test.title)
          // console.log('screen was found')
          if(screenshot) {
            await this.zebrunnerApiClient.sendScreenshot(test, screenshot)
          }
        }
        postScreen()

        this.zebrunnerApiClient.finishTestSession(test)
        this.zebrunnerApiClient.finishTest(test, 'FAILED', err.message)
      })
      .once(EVENT_RUN_END, () => {
        console.log('ZEBRUNNER REPORTER FINISHED');
        this.zebrunnerApiClient.storeResultsToFile()
      });
  } 

}

module.exports = ZbrReporter;