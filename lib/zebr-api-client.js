const fs = require('fs');
const path = require('path');
const {
  HttpClient,
  jsonHeaders,
  imageHeaders,
} = require('./api-client-axios');
const {
  urls,
  getRefreshToken,
  getTestRunStart,
  getTestRunEnd,
  getTestStart,
  getTestEnd,
  getTestSessionStart,
  getTestSessionEnd,
  getTestRunLabels,
  getUpdateTcmConfigs,
  getUpsertTestCases,
} = require('./request-builder');
const { platforms, testStatuses } = require('./constants');
require('dotenv').config();
const { writeJsonToFile, isEmptyObject, isBlankString } = require('./utils');

class ZebrunnerApiClient {
  constructor(reporterConfig, configResolver, logger) {
    this.reporterConfig = reporterConfig;
    this.configResolver = configResolver;
    this.httpClient = new HttpClient(configResolver, logger);
    this.logger = logger;

    this.accessToken = null;
    this.runId = process.env.ZEBRUNNER_RUN_ID ? +process.env.ZEBRUNNER_RUN_ID : null;
    this.testsMap = new Map();
    this.storedTestsMap = new Map();
    this.currentBrowser = null;
    this.currentBrowserSearched = false;
  }

  registerBrowser(browser) {
    this.currentBrowser = browser;
    // this.logger.info(path.basename(__filename), `cur browser was set ${getObjectAsString(this.currentBrowser)}`)
  }

  getCurrentBrowser() {
    return new Promise((resolve) => {
      if (!this.currentBrowserSearched && !this.currentBrowser) {
        this.currentBrowserSearched = true;
        // max time waiting for browser version is 3 sec (15 x 200ms)
        let attempts = 15;
        const waitForBrowser = async () => {
          this.logger.info(path.basename(__filename), 'waiting for this.currentBrowser is defined');
          while (!this.currentBrowser && (attempts-- > 0)) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          this.logger.info(path.basename(__filename), 'waiting for this.currentBrowser is finished');
          resolve(this.currentBrowser);
        };
        waitForBrowser();
      } else {
        resolve(this.currentBrowser);
      }
    });
  }

  async refreshToken() {
    if (!this.accessToken) {
      const res = await this.httpClient.callPost(urls.URL_REFRESH, getRefreshToken(this.configResolver.getReportingServerAccessToken()), jsonHeaders.headers, true);
      const token = `${res.data.authTokenType} ${res.data.authToken}`;
      this.accessToken = token;
    }
    return this.accessToken;
  }

  async getHeadersWithAuth(basicHeaders) {
    const authToken = await this.refreshToken();
    if (authToken) {
      const authHeaders = basicHeaders.headers;
      authHeaders.Authorization = authToken;
      return authHeaders;
    }
  }

  async registerTestRunStart(suite, testRunUuid) {
    const headers = await this.getHeadersWithAuth(jsonHeaders);
    if (headers) {
      const testRunStartBody = getTestRunStart(suite, this.reporterConfig, testRunUuid);
      return this.httpClient.callPost(urls.URL_REGISTER_RUN.replace('${project}', this.getProjectKey()), testRunStartBody, headers).then((res) => {
        this.runId = res?.data?.id;
        fs.writeFile(`${__dirname}/zbrTestsData${process.env.HOSTNAME || ''}.txt`, JSON.stringify({ runId: this.runId }), (err) => {
          if (err) {
            return console.log(err);
          }
        });
        this.logger.info(path.basename(__filename), `Run id was registered: ${this.runId}`);
      });
    }
  }

  async registerTestRunFinish() {
    if (this.runId) {
      const finishPromisesArr = Array.from(this.testsMap.values()).map((i) => i.promiseFinish);
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      return Promise.all(finishPromisesArr).then(() => (
        // logToFile('all tests were finished hence making the run finish call')
        this.httpClient.callPut(urls.URL_FINISH_RUN.concat(this.runId), getTestRunEnd(), headers)
      ));
    }
  }

  async startTest(test) {
    if (this.runId) {
      const url = urls.URL_START_TEST.replace('${testRunId}', this.runId);
      const testStartBody = getTestStart(test);
      const headers = await this.getHeadersWithAuth(jsonHeaders);

      const testStartResponse = await this.httpClient.callPost(url, testStartBody, headers);

      this.testsMap.set(test.uniqueId, {
        promiseStart: testStartResponse,
        videoFilePath: test.videoFilePath,
        testCases: [],
      });
      this.storedTestsMap.set(test.uniqueId, {
        videoFilePath: test.videoFilePath,
      });
      this.testsMap.get(test.uniqueId).zbrTestId = testStartResponse.data.id;
      this.storedTestsMap.get(test.uniqueId).zbrTestId = testStartResponse.data.id;
      this.logger.info(path.basename(__filename), `Test '${test.fullTitle}' was registered by id ${testStartResponse.data.id}`);
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
      const { zbrTestId } = this.testsMap.get(test.uniqueId);
      if (!zbrTestId) {
        throw new Error(`Test with id ${test.id} not found as registered`);
      }

      const testEnd = getTestEnd(status);
      if (reason) {
        testEnd.reason = reason;
        this.testsMap.get(test.uniqueId).state = 'failed';
      }
      const url = urls.URL_FINISH_TEST.replace('${testRunId}', this.runId).replace('${testId}', zbrTestId);
      const response = await this.httpClient.callPut(url, testEnd, headers);
      this.logger.info(path.basename(__filename), `Test with ID ${zbrTestId} was finished with status ${status}`);
      this.testsMap.get(test.uniqueId).promiseFinish = response;
      return response;
    }
  }

  async deleteTest(test) {
    let attempts = 0;
    const interval = setInterval(async () => {
      if (this.testsMap.get(test.uniqueId) && this.testsMap.get(test.uniqueId)?.zbrTestId) {
        clearInterval(interval);
        const headers = await this.getHeadersWithAuth(jsonHeaders);
        const { zbrTestId } = this.testsMap.get(test.uniqueId);
        const url = urls.URL_FINISH_TEST.replace('${testRunId}', this.runId).replace('${testId}', zbrTestId);
        return this.httpClient.callDelete(url, headers);
      } if (attempts > 10) {
        clearInterval(interval);
      } else {
        attempts += 1;
      }
    }, 1000);
  }

  async startTestSession(test, sessionId) {
    if (this.testsMap.get(test.uniqueId)) {
      this.testsMap.get(test.uniqueId).promiseStartSession = new Promise((resolve) => (
        this.getHeadersWithAuth(jsonHeaders).then((headers) => (
          this.getCurrentBrowser().then((currentBrowser) => {
            const testSession = { ...getTestSessionStart(this.testsMap.get(test.uniqueId).zbrTestId), sessionId };
            const defaultCapabilities = {
              platformName: platforms[process.platform],
              browserName: (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.name : 'n/a',
              browserVersion: (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.version : 'n/a',
              provider: 'ZEBRUNNER',
              vncLink: process.env.ZEBRUNNER_TASK_ID ? `/ws/vnc/${process.env.ZEBRUNNER_TASK_ID}` : undefined,
            };

            testSession.capabilities = defaultCapabilities;
            testSession.desiredCapabilities = defaultCapabilities;
            const url = urls.URL_START_SESSION.replace('${testRunId}', this.runId);
            resolve(this.httpClient.callPost(url, testSession, headers).then(async (res) => {
              if (this.testsMap.get(test.uniqueId) && res?.data?.id) {
                this.testsMap.get(test.uniqueId).zbrSessionId = res.data.id;
                this.storedTestsMap.get(test.uniqueId).zbrSessionId = res.data.id;
              }
              this.logger.info(path.basename(__filename), `Session with id ${res?.data?.id} was registered for test '${test.fullTitle}'`);
            }));
          })))));
    }
  }

  async finishTestSession(test) {
    if (this.testsMap.get(test.uniqueId)) {
      return this.getHeadersWithAuth(jsonHeaders).then((headers) => (
        this.testsMap.get(test.uniqueId).promiseStartSession.then(() => {
          const testSession = getTestSessionEnd(this.testsMap.get(test.uniqueId).zbrTestId);
          const url = urls.URL_UPDATE_SESSION
            .replace('${testRunId}', this.runId)
            .replace('${testSessionId}', this.testsMap.get(test.uniqueId).zbrSessionId);
          return this.httpClient.callPut(url, testSession, headers);
        })));
    }
  }

  async sendLogs(test, messages, level = 'INFO') {
    if (this.testsMap.get(test.uniqueId)) {
      const testId = this.testsMap.get(test.uniqueId).zbrTestId;

      const readyLogs = messages.map((m, index) => ({
        testId,
        message: m,
        level,
        timestamp: Date.now() + index,
      }));

      const url = urls.URL_SEND_LOGS.replace('${testRunId}', this.runId);
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      return this.httpClient.callPost(url, readyLogs, headers, true).then(() => {
        this.logger.info(path.basename(__filename), `logs were sent for test ${testId}`);
      });
    }
  }

  async sendRunLabels() {
    if (this.runId) {
      const url = urls.URL_ATTACH_TEST_RUN_LABELS.replace('${testRunId}', this.runId);
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      const runLabels = getTestRunLabels(this.reporterConfig.reporterOptions);

      if (runLabels.items.length !== 0) {
        this.httpClient.callPut(url, runLabels, headers);
      }
    }
  }

  sendScreenshot(test, imgPath) {
    if (this.testsMap.get(test.uniqueId)) {
      // todo: attach header x-zbr-screenshot-captured-at
      const url = urls.URL_SEND_SCREENSHOT.replace('${testRunId}', this.runId).replace('${testId}', this.testsMap.get(test.uniqueId).zbrTestId);
      const headers = this.getHeadersWithAuth(imageHeaders);
      const { httpClient } = this;
      if (imgPath?.length < 255) {
        return fs.readFile(imgPath, (err, data) => {
          if (err) {
            throw err;
          }
          return httpClient.callPost(url, data, headers, true);
        });
      }
      return new Promise((resolve) => { resolve(); });
    }
  }

  // TODO: merge sendLaunchLabels and sendRunLabels
  async sendLaunchLabels(requestBody) { // same as sendRunLabels, but receive custom labels from custom cy method attachZbrLaunchLabel
    if (this.runId) {
      const url = urls.URL_ATTACH_TEST_RUN_LABELS.replace('${testRunId}', this.runId);
      const headers = await this.getHeadersWithAuth(jsonHeaders);

      this.httpClient.callPut(url, requestBody, headers);
    }
  }

  async sendTestLabels(test, requestBody) {
    if (this.runId) {
      const url = urls.URL_ATTACH_TEST_LABELS.replace('${testRunId}', this.runId).replace('${testId}', this.testsMap.get(test.uniqueId)?.zbrTestId);
      const headers = await this.getHeadersWithAuth(jsonHeaders);

      this.httpClient.callPut(url, requestBody, headers);
    }
  }

  /** Update provided TCM configuration and should be called right after launch is created  */
  async saveTcmConfigs() {
    const updateTcmConfigsBody = getUpdateTcmConfigs(this.reporterConfig);

    if (this.runId && !isEmptyObject(updateTcmConfigsBody)) {
      const url = urls.URL_UPDATE_TCM_CONFIGS.replace('${testRunId}', this.runId);
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      return this.httpClient.callPatch(url, updateTcmConfigsBody, headers);
    }
  }

  /** Add TCM test cases to specified test execution */
  addTestCases(test, testCase) {
    if (this.testsMap.get(test.uniqueId)) {
      const { zbrTestId } = this.testsMap.get(test.uniqueId);

      if (zbrTestId) {
        // filter test case with the same tcm type and id if it is already present in the array and add its updated version
        this.testsMap.get(test.uniqueId).testCases = this.testsMap.get(test.uniqueId).testCases
          .filter((existingTestCase) => existingTestCase.tcmType !== testCase.tcmType || existingTestCase.testCaseId !== testCase.testCaseId);
        this.testsMap.get(test.uniqueId).testCases.push(testCase);
      }
    }
  }

  /** Get default status for TCM test case if it is provided */
  getDefaultTestCaseStatus(testStatus) {
    if (testStatus === testStatuses.PASSED) {
      return this.configResolver.getReportingTcmTestCaseStatusOnPass();
    }

    if (testStatus === testStatuses.FAILED) {
      return this.configResolver.getReportingTcmTestCaseStatusOnFail();
    }
  }

  /** Set default status for TCM test case if there is no actual provided */
  // eslint-disable-next-line class-methods-use-this
  setDefaultStatusIfActualNotProvided(testCases, defaultTestCaseStatus) {
    if (!isBlankString(defaultTestCaseStatus)) {
      return testCases.map((_testCase) => {
        const testCase = { ..._testCase };

        if (!testCase.resultStatus) {
          testCase.resultStatus = defaultTestCaseStatus;
        }

        return testCase;
      });
    }

    return testCases;
  }

  /** Upsert TCM test cases with actual status of test execution */
  async upsertTestTestCases(zbrTestId, testCases) {
    if (this.runId && zbrTestId) {
      const url = urls.URL_UPSERT_TEST_TEST_CASES.replace('${testRunId}', this.runId).replace('${testId}', zbrTestId);
      const upsertTestCasesBody = getUpsertTestCases(testCases);
      const headers = await this.getHeadersWithAuth(jsonHeaders);
      return this.httpClient.callPost(url, upsertTestCasesBody, headers);
    }
  }

  /** Get TCM test case status and update TCM runs according to received information */
  async updateTcmTestCases(test, status) {
    if (this.testsMap.get(test.uniqueId)) {
      const { zbrTestId, testCases } = this.testsMap.get(test.uniqueId);

      if (testCases.length !== 0) {
        const defaultTestCaseStatus = this.getDefaultTestCaseStatus(status);
        const updatedTestCases = this.setDefaultStatusIfActualNotProvided(
          testCases,
          defaultTestCaseStatus,
        );
        return this.upsertTestTestCases(zbrTestId, updatedTestCases);
      }
    }
  }

  storeResultsToFile() {
    const results = {};
    results.runId = this.runId;
    results.testsMap = Array.from(this.testsMap.entries());
    writeJsonToFile('cypress/zbr-report', 'zbr-results.json', results);
  }

  getProjectKey() {
    return (this.configResolver.getReportingProjectKey()) ? this.configResolver.getReportingProjectKey() : 'DEF';
  }

  async contextExchanges(payload) {
    const headers = await this.getHeadersWithAuth(jsonHeaders);
    return this.httpClient.callPost(urls.URL_RUN_CONTEXT_EXCHANGE, payload, headers);
  }
}

module.exports = ZebrunnerApiClient;
