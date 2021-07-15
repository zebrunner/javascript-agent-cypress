'use strict';

const ZebrunnerApiClient = require('./zebr-api-client.js')
const getFailedScreenshot = require('./utils').getFailedScreenshot
const getObjectAsString = require("./utils").getObjectAsString

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

    const processConfigEvent = (cypressConfig) => {
    // console.log(`config event was triggered ${cypressConfig}`)
    };
    const setOwnerEvent = (owner) => {
      // console.log(`set owner event was handled with owner ${owner.owner}`)
      this.zebrunnerApiClient.setCurrentTestOwner(owner);
    };
    const registerBrowserEvent = (browser) => {
      // console.log(`register browser was handled with browser ${browser}`)
      this.zebrunnerApiClient.registerBrowser(browser);
    };

    startZbrIPC(
      (server) => {
        server.on(EVENTS.CONFIG, processConfigEvent);
        server.on(EVENTS.SET_OWNER, setOwnerEvent);
        server.on(EVENTS.REG_BROWSER, registerBrowserEvent)
      },
      (server) => {
        server.off(EVENTS.CONFIG, '*');
        server.off(EVENTS.SET_OWNER, '*');
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
          runStartPromise = this.zebrunnerApiClient.registerTestRunStart(suite);
        }
      })
      .on(EVENT_SUITE_END, (suite) => {
        console.log('suite finished. name: ' + suite.title)
        if(suite.title) {
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
      });
  } 

}

module.exports = ZbrReporter;