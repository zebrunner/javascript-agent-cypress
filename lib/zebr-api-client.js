const fs = require('fs')
const {HttpClient, jsonHeaders, imageHeaders} = require("./api-client-axios.js");
const {urls, getRefreshToken, getTestRunStart, getTestRunEnd, getTestStart, getTestEnd, getTestSessionStart, getTestSessionEnd} = require("./request-builder.js");
var {getZebrunnerPlatform, uuidv4, logObject, getObjectAsString, sleep} = require("./utils");

class ZebrunnerApiClient {
  
  constructor(reporterConfig) {
    this.reporterConfig = reporterConfig
    this.httpClient = new HttpClient(reporterConfig.reporterOptions.zbr_service_url)
    
    this.accessToken
    this.runId
    this.testsMap = new Map();
    
    this.currentTestOwner
    this.currentBrowser
    
    this.zbrPlatform = getZebrunnerPlatform();
  }

  setCurrentTestOwner = (owner) => {
    this.currentTestOwner = owner
    // console.log(`ZBR API CLIENT set owner event was handled with owner ${getObjectAsString(owner)}`)
  }
  
  registerBrowser = (browser) => {
    this.currentBrowser = browser
    // console.log(`cur browser was set ${getObjectAsString(browser)}`)
  }

  refreshToken = async() => {
    if(!this.accessToken) {
      const res = await this.httpClient.callPost(urls.URL_REFRESH, getRefreshToken(this.reporterConfig.reporterOptions.zbr_token), jsonHeaders.headers)
      const token = res.data.authTokenType + ' ' + res.data.authToken
      this.accessToken = token;
    }
    return this.accessToken;
  }

  getJsonHeadersWithAuth = async() => {
    var authToken = await this.refreshToken()
    if(authToken) {
      var authHeaders = jsonHeaders.headers
      authHeaders['Authorization'] = authToken
      return authHeaders
    }
  }

  getImageHeadersWithAuth = async() => {
    var authToken = await this.refreshToken()
    if(authToken) {
      var authHeaders = imageHeaders.headers
      authHeaders['Authorization'] = authToken
      return authHeaders
    }
  }

  registerTestRunStart = async(suite) => {
    var headers = await this.getJsonHeadersWithAuth();
    if(headers) {
      var project = (this.reporterConfig.reporterOptions.zbr_project) ? this.reporterConfig.reporterOptions.zbr_project : 'DEF';
      var testRunStartBody = getTestRunStart(suite)
      if (this.reporterConfig.reporterOptions.zbr_environment) {
        testRunStartBody.config = {
              'environment': this.reporterConfig.reporterOptions.zbr_environment
          }
      }
      return this.httpClient.callPost(urls.URL_REGISTER_RUN.replace('${project}', project), testRunStartBody, headers).then((res) => {
        this.runId = res.data.id
        console.log("Run id was registered: " + this.runId)
      })
    }
  }

  registerTestRunFinish = async() => {
    if(this.runId) {
      var finishPromissesArr = Array.from(this.testsMap.values()).map(i => i.promiseFinish)
      var headers = await this.getJsonHeadersWithAuth();
      Promise.all(finishPromissesArr).then(() => {
        this.httpClient.callPut(urls.URL_FINISH_RUN.concat(this.runId), getTestRunEnd(), headers).then(() => {
          console.log(`Run with id ${this.runId} was finished`)
        })
      })
    }
  }

  startTest = async(test) => {
    if(this.runId) {
      // todo: investigate better solutions
      // waiting for 500 ms before test start in order to recieve test metadata if any
      await new Promise(resolve => setTimeout(resolve, 500));

      let url = urls.URL_START_TEST.replace('${testRunId}', this.runId);
      let testStartBody = getTestStart(test)

      if(this.currentTestOwner) {
          console.log(`Test owner ${this.currentTestOwner.owner} was set for the test ${test.title}`)
          testStartBody.maintainer = this.currentTestOwner.owner
      }
    
      var headers = await this.getJsonHeadersWithAuth();
      let call = this.httpClient.callPost(url, testStartBody, headers).then((res) => {
        this.testsMap.get(test.id).zbrTestId = res.data.id
        console.log(`Test '${test.fullTitle()}' was registered by id ${res.data.id}`)

        // cleaning up current test owner
        this.setCurrentTestOwner(undefined)
      })
      this.testsMap.set(test.id, {
        promiseStart: call
      })
      // return call;
    }
  }

  finishTest = async(test, status, reason) => {
    if(this.testsMap.get(test.id)) {
      var headers = await this.getJsonHeadersWithAuth();

      let startTestPromise = this.testsMap.get(test.id).promiseStart
      if(!startTestPromise) {
        return Promise.reject(`Test with id ${test.id} not found`)
      }

      startTestPromise.then(() => {
        let zbrTestId = this.testsMap.get(test.id).zbrTestId
        if(!zbrTestId) {
          return Promise.reject(`Test with id ${test.id} not found as registered`)
        }

        let testEnd = getTestEnd(status)
        if(reason) {
          testEnd.reason = reason
        }

        let url = urls.URL_FINISH_TEST.replace('${testRunId}', this.runId).replace('${testId}', zbrTestId)
        const call = this.httpClient.callPut(url, testEnd, headers).then(() => {
          console.log(`Test with ID ${zbrTestId} was finished with status ${status}`)
        })
        this.testsMap.get(test.id).promiseFinish = call
      })
    }
  }

  startTestSession = async(test) => {
    if(this.testsMap.get(test.id)) {
      let testSession = getTestSessionStart(this.testsMap.get(test.id).zbrTestId)
      let defaultCapabilities = {    
        'platformName': this.zbrPlatform,
        'browserName': (this.currentBrowser && this.currentBrowser.browser) ? this.currentBrowser.browser.name : 'n/a',
        'browserVersion': (this.currentBrowser && this.currentBrowser.browser) ? this.currentBrowser.browser.version : 'n/a'
      }
      testSession.capabilities = defaultCapabilities
      testSession.desiredCapabilities = defaultCapabilities
      let url = urls.URL_START_SESSION.replace('${testRunId}', this.runId);
      var headers = await this.getJsonHeadersWithAuth();
      this.httpClient.callPost(url, testSession, headers).then((res) => {
        this.testsMap.get(test.id).zbrSessionId = res.data.id
      })
    }
  }

  finishTestSession = async(test) => {
    if(this.testsMap.get(test.id)) {
      let testSession = getTestSessionEnd(this.testsMap.get(test.id).zbrTestId)
      if(this.currentBrowser && this.currentBrowser.browser){
        let defaultCapabilities = {    
          'platformName': this.zbrPlatform,
          'browserName': this.currentBrowser.browser.name,
          'browserVersion': this.currentBrowser.browser.version
        }
        testSession.capabilities = defaultCapabilities
        testSession.desiredCapabilities = defaultCapabilities
      }
      let url = urls.URL_UPDATE_SESSION.replace('${testRunId}', this.runId).replace('${testSessionId}', this.testsMap.get(test.id).zbrSessionId);
      var headers = await this.getJsonHeadersWithAuth();
      this.httpClient.callPut(url, testSession, headers).then((res) => {
      })
    }
  }

  sendLogs = async(test, messages) => {
    if(this.testsMap.get(test.id)) {
      var testId = this.testsMap.get(test.id).zbrTestId;
      // building test source in json format for saving as test logs
      var logs = [];
      messages.forEach( (m, index) => {
        logs.push(JSON.stringify({ testId: testId, message: m, level: 'INFO', timestamp: Date.now() + index}));
      })

      var logsAggr = '['
      logs.forEach( (l, index, array) => {
        logsAggr = logsAggr.concat(l);
        if (index != array.length - 1) {
          logsAggr = logsAggr.concat(',');
        }
      });
      logsAggr = logsAggr.concat(']');

      let url = urls.URL_SEND_LOGS.replace('${testRunId}', this.runId)
      var headers = await this.getJsonHeadersWithAuth();
      this.httpClient.callPost(url, logsAggr, headers)  
    }
  }

  sendScreenshot = async(test, imgPath) => {
    if(this.testsMap.get(test.id)) {
      // todo: attach header x-zbr-screenshot-captured-at
      let url = urls.URL_SEND_SCREENSHOT.replace('${testRunId}', this.runId).replace('${testId}', this.testsMap.get(test.id).zbrTestId)
      var headers = await this.getImageHeadersWithAuth();

      var httpClient = this.httpClient
      await fs.readFile(imgPath, function(err, data) {
        if (err) throw err;
        httpClient.callPost(url, data, headers)
      });
    }
  }

}

// new ZebrunnerApiClient({
// "reporterOptions": {
//     "zbr_service_url": "https://",
//     "zbr_token": "",
//     "zbr_project": "DEMO"
//   }
// }).somemethod

module.exports = ZebrunnerApiClient
