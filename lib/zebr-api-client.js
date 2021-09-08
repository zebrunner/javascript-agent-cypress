const fs = require('fs')
const FormData = require('form-data');
const {HttpClient, jsonHeaders, imageHeaders, multipartDataHeaders} = require("./api-client-axios.js");
const {urls, getRefreshToken, getTestRunStart, getTestRunEnd, getTestStart, getTestEnd, getTestSessionStart, getTestSessionEnd, getTestRunLabels, getTestsSearch} = require("./request-builder.js");
var {getZebrunnerPlatform, getFilesizeInBytes, writeJsonToFile, logToFile, getObjectAsString} = require("./utils");
var {ConfigResolver} = require("./config-resolver");

class ZebrunnerApiClient {
  
  constructor(reporterConfig) {
    this.reporterConfig = reporterConfig
    this.configResolver = new ConfigResolver(reporterConfig)
    this.httpClient = new HttpClient(this.configResolver)
    
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

  async refreshToken() {
    if(!this.accessToken) {
      const res = await this.httpClient.callPost(urls.URL_REFRESH, getRefreshToken(this.configResolver.getReportingServerAccessToken()), jsonHeaders.headers, false, true)
      const token = res.data.authTokenType + ' ' + res.data.authToken
      this.accessToken = token;
    }
    return this.accessToken;
  }

  async getHeadersWithAuth(basicHeaders) {
    var authToken = await this.refreshToken()
    if(authToken) {
      var authHeaders = basicHeaders.headers
      authHeaders['Authorization'] = authToken
      return authHeaders
    }
  }

  async registerTestRunStart(suite) {
    var headers = await this.getHeadersWithAuth(jsonHeaders);
    if(headers) {
      var project = (this.configResolver.getReportingProjectKey()) ? this.configResolver.getReportingProjectKey() : 'DEF';
      var testRunStartBody = getTestRunStart(suite, this.reporterConfig)
      return this.httpClient.callPost(urls.URL_REGISTER_RUN.replace('${project}', project), testRunStartBody, headers).then((res) => {
        this.runId = res.data.id
        console.log("Run id was registered: " + this.runId)
      })
    }
  }

  async registerTestRunFinish() {
    if(this.runId) {
      var finishPromissesArr = Array.from(this.testsMap.values()).map(i => i.promiseFinish)
      var headers = await this.getHeadersWithAuth(jsonHeaders);
      return Promise.all(finishPromissesArr).then(() => {
        // logToFile('all tests were finished hence making the run finish call')
        return this.httpClient.callPut(urls.URL_FINISH_RUN.concat(this.runId), getTestRunEnd(), headers);
      })
    }
  }

  async startTest(test) {
    if(this.runId) {
      let url = urls.URL_START_TEST.replace('${testRunId}', this.runId);
      let testStartBody = getTestStart(test)
    
      var headers = await this.getHeadersWithAuth(jsonHeaders);
      let call = this.httpClient.callPost(url, testStartBody, headers).then((res) => {
        this.testsMap.get(test.uniqueId).zbrTestId = res.data.id
        console.log(`Test '${test.fullTitle}' was registered by id ${res.data.id}`)
      })
      this.testsMap.set(test.uniqueId, {
        promiseStart: call,
        videoFilePath: test.videoFilePath
      })
      return call;
    }
  }

  async finishTest(test, status, reason) {
    if(this.testsMap.get(test.uniqueId)) {
      this.testsMap.get(test.uniqueId).promiseFinish = new Promise(resolve => {
        this.getHeadersWithAuth(jsonHeaders).then(headers => {
          let startTestPromise = this.testsMap.get(test.uniqueId).promiseStart
          if(!startTestPromise) {
            return Promise.reject(`Test with id ${test.id} not found`)
          }
    
          return startTestPromise.then(() => {
            let zbrTestId = this.testsMap.get(test.uniqueId).zbrTestId
            if(!zbrTestId) {
              return Promise.reject(`Test with id ${test.id} not found as registered`)
            }
    
            let testEnd = getTestEnd(status)
            if(reason) {
              testEnd.reason = reason;
              this.testsMap.get(test.uniqueId).state = 'failed'
            }
    
            let url = urls.URL_FINISH_TEST.replace('${testRunId}', this.runId).replace('${testId}', zbrTestId)
            resolve(this.httpClient.callPut(url, testEnd, headers).then(() => {
              console.log(`Test with ID ${zbrTestId} was finished with status ${status}`)
            }))
          })
        })
       
      })
      return this.testsMap.get(test.uniqueId).promiseFinish;
    }
  }

  async startTestSession(test) {
    if(this.testsMap.get(test.uniqueId)) {
      this.testsMap.get(test.uniqueId).promiseStartSession = new Promise(resolve => {
        return this.getHeadersWithAuth(jsonHeaders).then((headers) => {
          return this.getCurrentBrowser().then(currentBrowser => {
            let testSession = getTestSessionStart(this.testsMap.get(test.uniqueId).zbrTestId)
            let defaultCapabilities = {    
              'platformName': this.zbrPlatform,
              'browserName': (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.name : 'n/a',
              'browserVersion': (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.version : 'n/a'
            }
            testSession.capabilities = defaultCapabilities
            testSession.desiredCapabilities = defaultCapabilities
            let url = urls.URL_START_SESSION.replace('${testRunId}', this.runId);
            resolve(this.httpClient.callPost(url, testSession, headers).then((res) => {
              this.testsMap.get(test.uniqueId).zbrSessionId = res.data.id
              console.log(`Session with id ${res.data.id} was registered for test '${test.fullTitle}'`)
            }))
          })
        })
      })
    }
  }

  async finishTestSession(test) {
    if(this.testsMap.get(test.uniqueId)) {
      return this.getHeadersWithAuth(jsonHeaders).then(headers => {
        return this.testsMap.get(test.uniqueId).promiseStartSession.then(() => {
            let testSession = getTestSessionEnd(this.testsMap.get(test.uniqueId).zbrTestId)
            let url = urls.URL_UPDATE_SESSION.replace('${testRunId}', this.runId).replace('${testSessionId}', this.testsMap.get(test.uniqueId).zbrSessionId);
            return this.httpClient.callPut(url, testSession, headers);
          })
        })
    }
  }

  async sendLogs(test, level = 'INFO', messages) {
    if(this.testsMap.get(test.uniqueId)) {
      var testId = this.testsMap.get(test.uniqueId).zbrTestId;
      // building test source in json format for saving as test logs
      var logs = [];
      messages.forEach( (m, index) => {
        logs.push(JSON.stringify({ testId: testId, message: m, level: level, timestamp: Date.now() + index}));
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
      var headers = await this.getHeadersWithAuth(jsonHeaders);
      return this.httpClient.callPost(url, logsAggr, headers).then(() => {
        console.log(`logs were sent for test ${testId}`)
      })
    }
  }

  async sendRunLabels() {
    if(this.runId) {
      let url = urls.URL_SET_RUN_LABELS.replace('${testRunId}', this.runId)
      var headers = await this.getHeadersWithAuth(jsonHeaders);
      let runLabels = getTestRunLabels(this.reporterConfig.reporterOptions)
      this.httpClient.callPut(url, runLabels, headers)  
    }
  }

  sendScreenshot(test, imgPath) {
    if(this.testsMap.get(test.uniqueId)) {
      // todo: attach header x-zbr-screenshot-captured-at
      let url = urls.URL_SEND_SCREENSHOT.replace('${testRunId}', this.runId).replace('${testId}', this.testsMap.get(test.uniqueId).zbrTestId)
      var headers = this.getHeadersWithAuth(imageHeaders);

      var httpClient = this.httpClient
      return fs.readFile(imgPath, function(err, data) {
        if (err) throw err;
        return httpClient.callPost(url, data, headers, false, true)
      });
    }
  }

  sendVideo(videoFilePath, runId, zbrSessionId) {
    try {
      if (fs.existsSync(videoFilePath)) {
        var url = urls.URL_SEND_SESSION_ARTIFACTS.replace('${testRunId}', runId).replace('${testSessionId}', zbrSessionId);
        var headers = this.getHeadersWithAuth(multipartDataHeaders)
          
        const formData = new FormData();
        formData.append('video', fs.createReadStream(videoFilePath));
        headers['Content-Type'] = formData.getHeaders()['content-type']
        headers['x-zbr-video-content-length'] = getFilesizeInBytes(videoFilePath)
        return this.httpClient.callPost(url, formData, headers)
      }
    } catch(err) {
      console.error(err)
      return new Promise(resolve => {resolve()})
    }
  }

  parseResultsAndSendVideo() {
    var promises = []
    this.testsMap.forEach((value) => {
      if(value.videoFilePath && value.state === 'failed') {
        console.log('video will be pushed')
        promises.push(this.sendVideo(value.videoFilePath, this.runId, value.zbrSessionId));
      }
    })
    if(promises.length > 0)
    {
      return Promise.all(promises);
    }
    else {
      return new Promise(resolve => {resolve()})
    }
  }

  async searchTests() {
    var headers = await this.getHeadersWithAuth(jsonHeaders);
    return this.httpClient.callPost(urls.URL_SEARCH_TESTS, getTestsSearch(this.runId), headers);
  }
  
  storeResultsToFile() {
    const results = new Object()
    results['runId'] = this.runId
    results['testsMap'] = Array.from(this.testsMap.entries())
    writeJsonToFile('cypress/zbr-report', 'zbr-results.json', results);
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
