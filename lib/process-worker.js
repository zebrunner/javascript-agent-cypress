const Mocha = require('mocha');
const ZebrunnerApiClient = require('./zebr-api-client.js')
const {workerEvents} = require('./constants')
const {getFailedScreenshot, logToFile} = require('./utils')

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
      this.suitesCount = 0;
      break;
    case EVENT_RUN_BEGIN:
      console.log('ZEBRUNNER REPORTER STARTED');
      break;
    case EVENT_RUN_END:
      console.log('ZEBRUNNER REPORTER FINISHED');
      zebrunnerApiClient.storeResultsToFile()
      break;
    case EVENT_SUITE_BEGIN:
      if(message.suite.title) {
        this.suitesCount ++
        console.log('suite started. name: ' + message.suite.title)
      } else {
        break;
      }
      // as of now only the first (root) suite will be registered as a new run in zebrunner
      if(message.suite.title && !this.suiteRegistered) {
        console.log(`first suite registered!`)
        runStartPromise = zebrunnerApiClient.registerTestRunStart(message.suite);
        this.suiteRegistered = true
      }
      break;
    case EVENT_SUITE_END:
      if(message.suite.title) {
        this.suitesCount --
        console.log('suite finished. name: ' + message.suite.title)
      } else {
        break;
      }
      if(message.suite.title && this.suitesCount === 0) {
        this.finishRunPromise = zebrunnerApiClient.registerTestRunFinish()
      }
      break;
    case EVENT_TEST_BEGIN:
      console.log(`TEST ID: ${message.test.id}; TEST PARENT ID: ${message.test.parentId}, TEST UNIQUE ID: ${message.test.testUniqueId}`)
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

      const postScreen = async() => {
        let screenshot = await getFailedScreenshot(message.test.title)
        // console.log('screen was found')
        if(screenshot) {
          await zebrunnerApiClient.sendScreenshot(message.test, screenshot)
        }
      }
      postScreen()

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
      if(this.finishRunPromise) {
        promises.push(this.finishRunPromise)
      }
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