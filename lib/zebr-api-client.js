const fs = require('fs')
const FormData = require('form-data');
const { HttpClient, jsonHeaders, imageHeaders, multipartDataHeaders } = require("./api-client-axios.js");
const { urls, getRefreshToken, getTestRunStart, getTestRunEnd, getTestStart, getTestEnd, getTestSessionStart, getTestSessionEnd, getTestRunLabels } = require("./request-builder.js");
const path = require('path');
const { platforms } = require('./constants.js');
require('dotenv').config()
var { getFilesizeInBytes, writeJsonToFile, mapJsonReplacer } = require("./utils");
const { splitFullVideoIntoParts } = require('./video-splitter')

class ZebrunnerApiClient {

  constructor(reporterConfig, configResolver, logger) {
    this.reporterConfig = reporterConfig
    this.configResolver = configResolver
    this.httpClient = new HttpClient(configResolver, logger)
    this.logger = logger

    this.accessToken
    this.runId
    this.testsMap = new Map();
    this.storedTestsMap = new Map();

    this.currentBrowser
    this.currentBrowserSearched = false

  }

  registerBrowser(browser) {
    this.currentBrowser = browser
    // this.logger.info(path.basename(__filename), `cur browser was set ${getObjectAsString(this.currentBrowser)}`)
  }

  getCurrentBrowser() {
    return new Promise((resolve) => {
      if (!this.currentBrowserSearched && !this.currentBrowser) {
        this.currentBrowserSearched = true
        // max time waiting for browser version is 3 sec (15 x 200ms)
        let attempts = 15
        const waitForBrowser = async () => {
          this.logger.info(path.basename(__filename), `waiting for this.currentBrowser is defined`)
          while (!this.currentBrowser && (attempts-- > 0))
            await new Promise(resolve => setTimeout(resolve, 200));
          this.logger.info(path.basename(__filename), `waiting for this.currentBrowser is finished`)
          resolve(this.currentBrowser);
        }
        waitForBrowser()
      } else {
        resolve(this.currentBrowser);
      }
    })
  }

  async refreshToken() {
    if (!this.accessToken) {
      const res = await this.httpClient.callPost(urls.URL_REFRESH, getRefreshToken(this.configResolver.getReportingServerAccessToken()), jsonHeaders.headers, true)
      const token = res.data.authTokenType + ' ' + res.data.authToken
      this.accessToken = token;
    }
    return this.accessToken;
  }

  async getHeadersWithAuth(basicHeaders) {
    const authToken = await this.refreshToken()
    if (authToken) {
      let authHeaders = basicHeaders.headers
      authHeaders['Authorization'] = authToken
      return authHeaders
    }
  }

  async registerTestRunStart(suite, testRunUuid) {
    const headers = await this.getHeadersWithAuth(jsonHeaders);
    if (headers) {
      const testRunStartBody = getTestRunStart(suite, this.reporterConfig, testRunUuid)
      return this.httpClient.callPost(urls.URL_REGISTER_RUN.replace('${project}', this.getProjectKey()), testRunStartBody, headers).then((res) => {
        this.runId = res.data.id
        this.logger.info(path.basename(__filename), `Run id was registered: ${this.runId}`)
      })
    }
  }

  async registerTestRunFinish() {
    if (this.runId) {
      const finishPromisesArr = Array.from(this.testsMap.values()).map(i => i.promiseFinish)
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      return Promise.all(finishPromisesArr).then(() => {
        // logToFile('all tests were finished hence making the run finish call')
        return this.httpClient.callPut(urls.URL_FINISH_RUN.concat(this.runId), getTestRunEnd(), headers);
      })
    }
  }

  async startTest(test) {
    if (this.runId) {
      console.log('startTest api call:');
      const url = urls.URL_START_TEST.replace('${testRunId}', this.runId);
      const testStartBody = getTestStart(test)
      const headers = await this.getHeadersWithAuth(jsonHeaders);

      const testStartResponse = await this.httpClient.callPost(url, testStartBody, headers);

      this.testsMap.set(test.uniqueId, {
        promiseStart: testStartResponse,
        videoFilePath: test.videoFilePath
      });
      this.storedTestsMap.set(test.uniqueId, {
        videoFilePath: test.videoFilePath,
      });
      this.testsMap.get(test.uniqueId).zbrTestId = testStartResponse.data.id;
      this.storedTestsMap.get(test.uniqueId).zbrTestId = testStartResponse.data.id;
      console.log('zbrTestsData.txt', JSON.stringify({ testsData: this.storedTestsMap, runId: this.runId }, mapJsonReplacer));
      fs.writeFile('../zbrTestsData.txt', JSON.stringify({ testsData: this.storedTestsMap, runId: this.runId }, mapJsonReplacer), (err) => {
        if (err) {
          return console.log(err);
        };
      });
      this.logger.info(path.basename(__filename), `Test '${test.fullTitle}' was registered by id ${testStartResponse.data.id}`)
      return testStartResponse;
    }
  }

  async finishTest(test, status, reason) {
    if (this.testsMap.get(test.uniqueId)) {
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      const testInfo = this.testsMap.get(test.uniqueId).promiseStart;
      if (!testInfo) {
        throw new Error(`Test with id ${test.id} not found`);
      }
      const zbrTestId = this.testsMap.get(test.uniqueId).zbrTestId;
      if (!zbrTestId) {
        throw new Error(`Test with id ${test.id} not found as registered`);
      }

      let testEnd = getTestEnd(status)
      if (reason) {
        testEnd.reason = reason;
        this.testsMap.get(test.uniqueId).state = 'failed'
      }
      const url = urls.URL_FINISH_TEST.replace('${testRunId}', this.runId).replace('${testId}', zbrTestId);
      const response = await this.httpClient.callPut(url, testEnd, headers);
      this.logger.info(path.basename(__filename), `Test with ID ${zbrTestId} was finished with status ${status}`)
      this.testsMap.get(test.uniqueId).promiseFinish = response;
      return response;
    }
  }

  async startTestSession(test) {
    if (this.testsMap.get(test.uniqueId)) {
      this.testsMap.get(test.uniqueId).promiseStartSession = new Promise(resolve => {
        return this.getHeadersWithAuth(jsonHeaders).then((headers) => {
          return this.getCurrentBrowser().then(currentBrowser => {
            let testSession = getTestSessionStart(this.testsMap.get(test.uniqueId).zbrTestId);
            const defaultCapabilities = {
              'platformName': platforms[process.platform],
              'browserName': (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.name : 'n/a',
              'browserVersion': (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.version : 'n/a'
            }
            testSession.capabilities = defaultCapabilities
            testSession.desiredCapabilities = defaultCapabilities
            let url = urls.URL_START_SESSION.replace('${testRunId}', this.runId);
            resolve(this.httpClient.callPost(url, testSession, headers).then((res) => {
              this.testsMap.get(test.uniqueId).zbrSessionId = res.data.id
              this.storedTestsMap.get(test.uniqueId).zbrSessionId = res.data.id
              fs.writeFile('../zbrTestsData.txt', JSON.stringify({ testsData: this.storedTestsMap, runId: this.runId }, mapJsonReplacer), (err) => {
                if (err) {
                  return console.log(err);
                };
              });
              this.logger.info(path.basename(__filename), `Session with id ${res.data.id} was registered for test '${test.fullTitle}'`)
            }))
          })
        })
      })
    }
  }

  async finishTestSession(test) {
    if (this.testsMap.get(test.uniqueId)) {
      return this.getHeadersWithAuth(jsonHeaders).then(headers => {
        return this.testsMap.get(test.uniqueId).promiseStartSession.then(() => {
          let testSession = getTestSessionEnd(this.testsMap.get(test.uniqueId).zbrTestId)
          let url = urls.URL_UPDATE_SESSION
            .replace('${testRunId}', this.runId)
            .replace('${testSessionId}', this.testsMap.get(test.uniqueId).zbrSessionId);
          return this.httpClient.callPut(url, testSession, headers);
        })
      })
    }
  }

  async sendLogs(test, level = 'INFO', messages) {
    if (this.testsMap.get(test.uniqueId)) {
      const testId = this.testsMap.get(test.uniqueId).zbrTestId;

      const readyLogs = messages.map((m, index) => ({
        testId: testId,
        message: m,
        level: level,
        timestamp: Date.now() + index
      }));

      const url = urls.URL_SEND_LOGS.replace('${testRunId}', this.runId)
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      return this.httpClient.callPost(url, readyLogs, headers, true).then(() => {
        this.logger.info(path.basename(__filename), `logs were sent for test ${testId}`)
      })
    }
  }

  async sendRunLabels() {
    if (this.runId) {
      const url = urls.URL_SET_RUN_LABELS.replace('${testRunId}', this.runId)
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      const runLabels = getTestRunLabels(this.reporterConfig.reporterOptions);

      this.httpClient.callPut(url, runLabels, headers)
    }
  }

  sendScreenshot(test, imgPath) {
    if (this.testsMap.get(test.uniqueId)) {
      // todo: attach header x-zbr-screenshot-captured-at
      const url = urls.URL_SEND_SCREENSHOT.replace('${testRunId}', this.runId).replace('${testId}', this.testsMap.get(test.uniqueId).zbrTestId)
      const headers = this.getHeadersWithAuth(imageHeaders);
      const httpClient = this.httpClient;
      if (imgPath?.length < 255) {
        return fs.readFile(imgPath, function (err, data) {
          if (err) {
            console.log('sendScreenshot err', err);
            throw err;
          }
          console.log('sendScreenshot success', url, data);
          return httpClient.callPost(url, data, headers, true)
        });
      } else return new Promise(resolve => { resolve() });
    }
  }

  sendVideo(videoFilePath, runId, zbrSessionId) {
    try {
      if (fs.existsSync(videoFilePath)) {
        const url = urls.URL_SEND_SESSION_ARTIFACTS.replace('${testRunId}', runId).replace('${testSessionId}', zbrSessionId);
        const headers = this.getHeadersWithAuth(multipartDataHeaders)
        const formData = new FormData();
        formData.append('video', fs.createReadStream(videoFilePath));
        headers['Content-Type'] = formData.getHeaders()['content-type']
        headers['x-zbr-video-content-length'] = getFilesizeInBytes(videoFilePath)

        return this.httpClient.callPost(url, formData, headers, true)
      }
    } catch (err) {
      console.error(err)
      return new Promise(resolve => { resolve() });
    }
  }

  async parseResultsAndSendVideo(suiteTestsDurationsMap) {
    var promises = [];
    if (suiteTestsDurationsMap) {
      await splitFullVideoIntoParts(suiteTestsDurationsMap, this.logger);

      suiteTestsDurationsMap.forEach(tests => {
        tests.forEach(test => {
          if (test.videoFilePath) {
            //video is sent to all tests. check test.state === 'failed' for only failed tests
            this.testsMap.get(test.uniqueId).videoFilePath = test.videoFilePath;
            this.logger.info(path.basename(__filename), 'video will be pushed');
            this.logger.debug(path.basename(__filename), `video path: ${test.videoFilePath}`);
            promises.push(this.sendVideo(test.videoFilePath, this.runId, this.testsMap.get(test.uniqueId).zbrSessionId));
          } else {
            this.logger.info(path.basename(__filename), 'video will not be pushed. video not exists');
            this.logger.debug(path.basename(__filename), `unexisted video path: ${test.videoFilePath}`);
          }
        })
      })
    } else if (suiteTestsDurationsMap === null) {
      this.logger.info(path.basename(__filename), `cant split and send video. there are no tests in suite`);
    } else {
      this.logger.info(path.basename(__filename), `cant split and send video. video is disabled`);
    }

    if (promises.length > 0) {
      return Promise.all(promises);
    } else {
      return new Promise(resolve => { resolve() })
    }
  }

  async getRunSummary() {
    if (this.runId) {
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      const res = await this.httpClient.callGet(urls.URL_GET_PROJECT.replace('${projectKey}', this.getProjectKey()), headers);
      const projectId = res.data.data.id;
      return await this.httpClient.callGet(urls.URL_GET_RUN_SUMMARY.replace('${testRunId}', this.runId).replace('${projectId}', projectId), headers);
    }
  }

  storeResultsToFile() {
    const results = new Object()
    results['runId'] = this.runId
    results['testsMap'] = Array.from(this.testsMap.entries())
    writeJsonToFile('cypress/zbr-report', 'zbr-results.json', results);
  }

  getProjectKey() {
    return (this.configResolver.getReportingProjectKey()) ? this.configResolver.getReportingProjectKey() : 'DEF';
  }

  async contextExchanges(payload) {
    const headers = await this.getHeadersWithAuth(jsonHeaders);
    return this.httpClient.callPost(urls.URL_RUN_CONTEXT_EXCHANGE, payload, headers)
  }
}

module.exports = ZebrunnerApiClient