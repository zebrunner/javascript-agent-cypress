const fs = require('fs')
const FormData = require('form-data');
const {HttpClient, jsonHeaders, imageHeaders, multipartDataHeaders} = require("./api-client-axios.js");
const {urls, getRefreshToken, getTestRunStart, getTestRunEnd, getTestStart, getTestEnd, getTestSessionStart, getTestSessionEnd, getTestRunLabels} = require("./request-builder.js");
var {getZebrunnerPlatform, uuidv4, logObject, getObjectAsString, sleep, getVideoFilePath, getFilesizeInBytes, writeJsonToFile} = require("./utils");
var {ConfigResolver} = require("./config-resolver");

class ZebrunnerApiClient {
  
  constructor(reporterConfig) {
    this.reporterConfig = reporterConfig
    this.configResolver = new ConfigResolver(reporterConfig)
    this.httpClient = new HttpClient(this.configResolver.getReportingServerHostname())
    
    this.accessToken
    this.runId
    this.testsMap = new Map();
    
    this.currentBrowser
    this.currentBrowserSearched = false
    
    this.zbrPlatform = getZebrunnerPlatform();
  }

  registerBrowser = (browser) => {
    this.currentBrowser = browser
    // console.log(`cur browser was set ${getObjectAsString(this.currentBrowser)}`)
  }

  getCurrentBrowser() {
    return new Promise((resolve, reject) => {
      if(!this.currentBrowserSearched && !this.currentBrowser) {
        this.currentBrowserSearched = true
        // max time waiting for browser version is 3 sec (15 x 200ms)
        var attempts = 15
        const waitForBrowser = async()  => {
          console.log("waiting for this.currentBrowser is defined");
          while(!this.currentBrowser && (attempts-- > 0))
              await new Promise(resolve => setTimeout(resolve, 200));
          console.log("waiting for this.currentBrowser is finished");
          resolve(this.currentBrowser);
        }
        waitForBrowser()
      } else {
        resolve(this.currentBrowser);
      }
    })
  }

  refreshToken = async() => {
    if(!this.accessToken) {
      const res = await this.httpClient.callPost(urls.URL_REFRESH, getRefreshToken(this.configResolver.getReportingServerAccessToken()), jsonHeaders.headers)
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

  getMultipardDataHeadersWithAuth = async() => {
    var authToken = await this.refreshToken()
    if(authToken) {
      var authHeaders = multipartDataHeaders.headers
      authHeaders['Authorization'] = authToken
      return authHeaders
    }
  }

  registerTestRunStart = async(suite) => {
    var headers = await this.getJsonHeadersWithAuth();
    if(headers) {
      var project = (this.configResolver.getReportingProjectKey()) ? this.configResolver.getReportingProjectKey() : 'DEF';
      var testRunStartBody = getTestRunStart(suite, this.reporterConfig)
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
      // await new Promise(resolve => setTimeout(resolve, 1000));

      let url = urls.URL_START_TEST.replace('${testRunId}', this.runId);
      let testStartBody = getTestStart(test)
    
      var headers = await this.getJsonHeadersWithAuth();
      let call = this.httpClient.callPost(url, testStartBody, headers).then((res) => {
        this.testsMap.get(test.id).zbrTestId = res.data.id
        console.log(`Test '${test.fullTitle()}' was registered by id ${res.data.id}`)
      })
      this.testsMap.set(test.id, {
        promiseStart: call
      })
      return call;
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
      var headers = await this.getJsonHeadersWithAuth();
      var currentBrowser = await this.getCurrentBrowser()
      let testSession = getTestSessionStart(this.testsMap.get(test.id).zbrTestId)
      let defaultCapabilities = {    
        'platformName': this.zbrPlatform,
        'browserName': (currentBrowser && currentBrowser) ? currentBrowser.browser.name : 'n/a',
        'browserVersion': (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.version : 'n/a'
      }
      testSession.capabilities = defaultCapabilities
      testSession.desiredCapabilities = defaultCapabilities
      let url = urls.URL_START_SESSION.replace('${testRunId}', this.runId);
      let call = this.httpClient.callPost(url, testSession, headers).then((res) => {
        this.testsMap.get(test.id).zbrSessionId = res.data.id
        console.log(`Session with id ${res.data.id} was registered for test '${test.fullTitle()}'`)
      })
      this.testsMap.get(test.id).promiseStartSession = call
    }
  }

  finishTestSession = async(test) => {
    if(this.testsMap.get(test.id)) {
      var headers = await this.getJsonHeadersWithAuth();

      let startSessionPromise = this.testsMap.get(test.id).promiseStartSession
      if(!startSessionPromise) {
        var attempts = 5
        const waitForSessionStartPromise = async()  => {
          console.log("waiting for promiseStartSession has started");
          while(!this.testsMap.get(test.id).promiseStartSession && (attempts-- > 0))
              await new Promise(resolve => setTimeout(resolve, 200));
          console.log("waiting for promiseStartSession is finished");
        }
        waitForSessionStartPromise()
      }

      if(startSessionPromise) {
        startSessionPromise.then(() => {
          let testSession = getTestSessionEnd(this.testsMap.get(test.id).zbrTestId)
          var currentBrowser = this.getCurrentBrowser()
          if(currentBrowser && currentBrowser.browser){
            let defaultCapabilities = {    
              'platformName': this.zbrPlatform,
              'browserName': currentBrowser.browser.name,
              'browserVersion': currentBrowser.browser.version
            }
            testSession.capabilities = defaultCapabilities
            testSession.desiredCapabilities = defaultCapabilities
          }
          let url = urls.URL_UPDATE_SESSION.replace('${testRunId}', this.runId).replace('${testSessionId}', this.testsMap.get(test.id).zbrSessionId);
          this.httpClient.callPut(url, testSession, headers).then((res) => {})
        })
      }
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

  sendRunLabels = async() => {
    if(this.runId) {
      let url = urls.URL_SET_RUN_LABELS.replace('${testRunId}', this.runId)
      var headers = await this.getJsonHeadersWithAuth();
      let runLabels = getTestRunLabels(this.reporterConfig.reporterOptions)
      this.httpClient.callPut(url, runLabels, headers)  
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

  sendVideo = async(videoFilePath, runId, zbrSessionId) => {
    let url = urls.URL_SEND_SESSION_ARTIFACTS.replace('${testRunId}', runId).replace('${testSessionId}', zbrSessionId);
    var headers = await this.getMultipardDataHeadersWithAuth();

    var httpClient = this.httpClient
    const formData = new FormData();
    formData.append('video', fs.createReadStream(videoFilePath));
    headers['Content-Type'] = formData.getHeaders()['content-type']
    headers['x-zbr-video-content-length'] = getFilesizeInBytes(videoFilePath)
    httpClient.callPost(url, formData, headers)
  }

  storeResultsToFile(){
    const results = new Object()
    results['runId'] = this.runId
    results['testsMap'] = Array.from(this.testsMap.entries())
    writeJsonToFile('zbr-report', 'zbr-results.json', results);
  }
}

// new ZebrunnerApiClient({
// "reporterOptions": {
//     "reportingServerHostname": "https://",
//     "reportingServerAccessToken": "",
//     "reportingProjectKey": "DEMO"
//   }
// }).somemethod

module.exports = ZebrunnerApiClient
