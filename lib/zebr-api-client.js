const fs = require('fs')
const FormData = require('form-data');
const { HttpClient, jsonHeaders, imageHeaders, multipartDataHeaders } = require("./api-client-axios.js");
const { urls, getRefreshToken, getTestRunStart, getTestRunEnd, getTestStart, getTestEnd, getTestSessionStart, getTestSessionEnd, getTestRunLabels } = require("./request-builder.js");
const path = require('path');
const { platforms } = require('./constants.js');
require('dotenv').config()
var { getZebrunnerPlatform, getFilesizeInBytes, writeJsonToFile, logToFile, getObjectAsString } = require("./utils");
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const { getVideoDurationInSeconds } = require('get-video-duration')

class ZebrunnerApiClient {

  constructor(reporterConfig, configResolver, logger) {
    this.reporterConfig = reporterConfig
    this.configResolver = configResolver
    this.httpClient = new HttpClient(configResolver, logger)
    this.logger = logger

    this.accessToken
    this.runId
    this.testsMap = new Map();

    this.currentBrowser
    this.currentBrowserSearched = false

  }

  registerBrowser = (browser) => {
    this.currentBrowser = browser
    // this.logger.info(path.basename(__filename), `cur browser was set ${getObjectAsString(this.currentBrowser)}`)
  }

  getCurrentBrowser() {
    return new Promise((resolve, reject) => {
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
      const url = urls.URL_START_TEST.replace('${testRunId}', this.runId);
      const testStartBody = getTestStart(test)
      const headers = await this.getHeadersWithAuth(jsonHeaders);

      const testStartResponse = await this.httpClient.callPost(url, testStartBody, headers);

      this.testsMap.set(test.uniqueId, {
        promiseStart: testStartResponse,
        videoFilePath: test.videoFilePath
      });
      this.testsMap.get(test.uniqueId).zbrTestId = testStartResponse.data.id
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
      const httpClient = this.httpClient
      return fs.readFile(imgPath, function (err, data) {
        if (err) throw err;
        return httpClient.callPost(url, data, headers, true)
      });
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
      return new Promise(resolve => { resolve() })
    }
  }

  //эту функцию я доработал
  //теперь сюда приходит вся моя собранная информация по длительности тестов и прочая нужная информация(которую можно сильно урезать, она там излишняя)
  async parseResultsAndSendVideo(suiteTestsDurationsMap) {
    //эта информация - мапа и передаётся в мою функцию со всей логикой по нарезке
    await this.splitFullVideoIntoParts(suiteTestsDurationsMap)
    //после нарезки в мапу this.testsMaps передаются новые пути к нарезанным видео, вместо путей к одному целому видео
    suiteTestsDurationsMap.forEach(tests => {
      tests.forEach(test => {
        this.testsMap.get(test.uniqueId).videoFilePath = test.videoFilePath
      })
    })

    var promises = []
    this.testsMap.forEach((value) => {
      //тут закаментил и видосы прикрепляются ко всем тестам(прошедшим и упавшим)
      if (value.videoFilePath /* && value.state === 'failed' */) {
        this.logger.info(path.basename(__filename), 'video will be pushed')
        this.logger.debug(path.basename(__filename), `video path: ${value.videoFilePath}`)
        promises.push(this.sendVideo(value.videoFilePath, this.runId, value.zbrSessionId));
      }
    })
    if (promises.length > 0) {
      return Promise.all(promises);
    }
    else {
      return new Promise(resolve => { resolve() })
    }
  }

  //функция берёт всю собранную информацию по тестам и их длительностям
  //из этой информации высчитываются все данные нужные для нарезки целого видео на части
  //все данные передаются в функцию нарезки this.ffmpegSplit
  async splitFullVideoIntoParts(suiteTestsDurationsMap) {
    for (let suiteInfo of suiteTestsDurationsMap.entries()) {
      let fullVideoFilePath = this.getVideoDirPath() + this.getVideoName(suiteInfo[0].suiteFileName)
      let testsTimeSummary = 0

      for (let i = suiteInfo[1].length - 1; i >= 0; i--) {
        await getVideoDurationInSeconds(fullVideoFilePath).then(async (videoDuration) => {
          videoDuration *= 1000; //seconds to milliseconds
          let testDuration = suiteInfo[1][i].duration
          testsTimeSummary += testDuration
          let testStartingTime = videoDuration - testsTimeSummary
          let splitedVideoFilePath = this.getVideoDirPath() + this.formatVideoName(suiteInfo[1][i].title, suiteInfo[0].suiteFileName)
          await this.ffmpegSplit(fullVideoFilePath, testStartingTime, testDuration, splitedVideoFilePath)
          suiteInfo[1][i].videoFilePath = splitedVideoFilePath
        })
      }
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


  //берёт путь к папке с видео из мапы this.testsMap
  getVideoDirPath() {
    let videoFilePath = String(this.testsMap.values().next().value.videoFilePath)
    let lastSlashIndex = videoFilePath.lastIndexOf('/')

    return videoFilePath.slice(0, lastSlashIndex + 1)
  }

  //имя спека 
  getSpecName(suiteFileName) {
    let lastSlashIndex = String(suiteFileName).lastIndexOf('/')
    return String(suiteFileName).slice(lastSlashIndex + 1, String(suiteFileName).length)
  }

  //имя видео
  getVideoName(suiteFileName) {
    return this.getSpecName(suiteFileName) + '.mp4'
  }

  //делает из имени спека и имени теста название видео
  formatVideoName(testTitle, suiteFileName) {
    return testTitle.replace(/[^A-Za-z0-9]/g, '_') + '-' + this.getSpecName(suiteFileName).replace(/[^A-Za-z0-9]/g, '_') + '.mp4';
  }

  //процесс который нарезает видео на части
  ffmpegSplit(videoFilePath, testStartingTime, testDuration, newSplitedVideoFullPath) {
    return new Promise(resolve => {
      ffmpeg()
        .input(videoFilePath)
        .inputOptions([`-ss ${testStartingTime}ms`])
        .outputOptions([`-t ${testDuration}ms`])
        .output(newSplitedVideoFullPath)
        .on('end', () => {
          console.log('ffmpeg log: Video splited.')
          resolve()
        })
        .on('error', (error) => {
          console.log('ffmpeg error: ' + error)
          resolve()
        })
        .run()
    })
  }

}

module.exports = ZebrunnerApiClient