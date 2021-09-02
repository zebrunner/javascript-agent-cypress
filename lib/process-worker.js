const Mocha = require('mocha');
const ZebrunnerApiClient = require('./zebr-api-client.js')
const {workerEvents} = require('./constants')
const {getFailedScreenshot, logToFile, getObjectAsString} = require('./utils')

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
process.on('message', (message) => {
  const { event } = message;
  switch (event) {
    case workerEvents.WORKER_INIT:
      zebrunnerApiClient = new ZebrunnerApiClient(message.config);
      this.suiteRegistered = false;
      break;
    case EVENT_RUN_BEGIN:
      console.log('ZEBRUNNER REPORTER STARTED');
      break;
    case EVENT_RUN_END:
      console.log('ZEBRUNNER REPORTER FINISHED');
      zebrunnerApiClient.storeResultsToFile()
      break;
    case EVENT_SUITE_BEGIN:
      // as of now only the first (root) suite will be registered as a new run in zebrunner
      if(message.suite.title) {
        console.log('suite started. name: ' + message.suite.title)
        if(!this.suiteRegistered) {
          console.log(`first suite registered!`)
          runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite);
          this.suiteRegistered = true
        }
      }
      break;
    case EVENT_SUITE_END:
      if(message.suite.title) {
        console.log('suite finished. name: ' + message.suite.title)
      }
      break;
    case EVENT_TEST_BEGIN:
      runStartPromise.then(() => {
        zebrunnerApiClient.startTest(message.test).then(() => {
          var messages = [];
          messages.push('ORIGINAL TEST DEFINITION (NOT LIVE LOGS):')
          message.test.body.split(/\r\n|\n\r|\n|\r/).forEach( (m) => {
            messages.push(m);
          });
          zebrunnerApiClient.sendLogs(message.test, 'INFO', messages);            

          zebrunnerApiClient.startTestSession(message.test);

          zebrunnerApiClient.sendRunLabels();
        })
      })
      break;
    case EVENT_TEST_PASS:
      zebrunnerApiClient.finishTestSession(message.test).then(() => {
        zebrunnerApiClient.finishTest(message.test, 'PASSED', null)
      })
      break;
    case EVENT_TEST_FAIL:
      zebrunnerApiClient.sendLogs(message.test, 'ERROR', [`Failure message: ${message.err.message}`])

      getFailedScreenshot(message.test.title).then(screenshot => {
        zebrunnerApiClient.sendScreenshot(message.test, screenshot)
      })      

      zebrunnerApiClient.finishTestSession(message.test).then(() => {
        zebrunnerApiClient.finishTest(message.test, 'FAILED', message.err.message)
      })
      break;

    // custom events: set browser
    case workerEvents.SET_BROWSER:
      console.log(`register browser was handled with browser ${message.browser.browser.name}`)
      zebrunnerApiClient.registerBrowser(message.browser);
      break;

    // custom events: exit process
    case workerEvents.PARENT_PROCESS_END:
      var promises = []
      promises.push(zebrunnerApiClient.parseResultsAndSendVideo())

      // additional logic for parallelized runs
      promises.push(zebrunnerApiClient.getAllTestsFinishedPromise().then(() => {
        return zebrunnerApiClient.searchTests().then((res) => {
          var anyInProgress = false
          res.data.results.forEach(test => {
            if(test.status === 'IN_PROGRESS') {
              anyInProgress = true;
            }
          })
          logToFile(`anyInProgress: ${anyInProgress}`)
          if(!anyInProgress) {
            return zebrunnerApiClient.registerTestRunFinish();
          } else {
            return new Promise(resolve => {resolve()});
          }
        })
      }))

      Promise.all(promises)
      .then(() => {
        logToFile('worker process finish was handled')
        process.exit(0)
      })
      .catch((err) => {
        logToFile(`error in end run promises ${err}`)
        process.exit(1)
      })
      break;
    default:
      break;
  }
});