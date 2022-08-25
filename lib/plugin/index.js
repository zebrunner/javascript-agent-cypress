const ipc = require('node-ipc');
const { connectToZbrIPC } = require('./../ipc/client');
const { EVENTS } = require('./../ipc/events');
const fs = require('fs');
const { mapJsonReviver, getFilesizeInBytes } = require('../utils');
const { splitFullVideoIntoParts } = require('../video-splitter');
const { HttpClient, jsonHeaders, multipartDataHeaders } = require('../api-client-axios.js');
const { ConfigResolver } = require('../config-resolver');
const FormData = require('form-data');
const LogUtil = require('../log-util').LogUtil;
const { urls, getRefreshToken } = require('../request-builder');
const path = require('path');

let afterRunEventInProgress = false;

const registerZbrPlugin = (on, config) => {
  console.log('zbr plugin execution was started');

  const ipcConnectionAlias = `zbr-${process.ppid}`;
  const connectPromise = connectToZbrIPC(config);

  on('task', {
    zbr_registerBrowser(browser) {
      connectPromise.then(() => {
        ipc.of[ipcConnectionAlias].emit(EVENTS.REG_BROWSER, browser);
      })
      return null;
    },
  });

  on('after:run', async (results) => {
    return new Promise(resolve => setTimeout(resolve, process.env.ZBR_RUN_END_TIMEOUT || 10000)).then(async () => {
    console.log('--- after:run event:');
    console.log('results: ', results);
    // console.log('results.runs: ', results.runs);
    // console.log('results.runs[0].tests: ', results.runs[0].tests);
  //   if (afterRunEventInProgress) { return; }
    // afterRunEventInProgress = true;
    const configResolver = new ConfigResolver(results.config);
    const logger = new LogUtil(configResolver);
    const httpClient = new HttpClient(configResolver, logger);
    let accessToken;

    const refreshToken = async () => {
      if (!accessToken) {
        const res = await httpClient.callPost(urls.URL_REFRESH, getRefreshToken(configResolver.getReportingServerAccessToken()), jsonHeaders.headers, true)
        const token = res.data.authTokenType + ' ' + res.data.authToken
        accessToken = token;
      }
      return accessToken;
    }

    const getHeadersWithAuth = async (basicHeaders) => {
      const authToken = await refreshToken();
      if (authToken) {
        let authHeaders = basicHeaders.headers;
        authHeaders['Authorization'] = authToken;
        return authHeaders;
      }
    }

    const getProjectKey = () => {
      return (configResolver.getReportingProjectKey()) ? configResolver.getReportingProjectKey() : 'DEF';
    }

    const getAllStoredTestsData = async () => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      return httpClient.callGet(urls.URL_ZE_TESTS_DATA_SAVE, headers);
    }

    const safelyParseJSON = (json) => {
      let parsed;
      try {
        parsed = JSON.parse(json, mapJsonReviver);
      } catch (e) {
        console.log('JSON parse error', e);
      }

      return parsed;
    }

    const response = await getAllStoredTestsData();
    const runId = response.data?.items?.find((item) => item.key === `runId${process.env.HOSTNAME || ''}`)?.value;
    const testsDataString = response.data?.items?.find((item) => item.key === `${runId}${process.env.HOSTNAME || ''}`)?.value;
    const testsData = testsDataString && safelyParseJSON(testsDataString);
    const durationsData = response.data?.items?.find((item) => item.key === `zebSuiteTestsData${process.env.HOSTNAME || ''}`)?.value;
    const testsDurationData = durationsData && safelyParseJSON(durationsData);

    const sendVideo = async (videoFilePath, runId, zbrSessionId) => {
      try {
        if (fs.existsSync(videoFilePath)) {
          const url = urls.URL_SEND_SESSION_ARTIFACTS.replace('${testRunId}', runId).replace('${testSessionId}', zbrSessionId);
          console.log('sendVideo url', url);
          const headers = await getHeadersWithAuth(multipartDataHeaders);
          const formData = new FormData();
          formData.append('video', fs.createReadStream(videoFilePath));
          headers['Content-Type'] = formData.getHeaders()['content-type'];
          headers['x-zbr-video-content-length'] = getFilesizeInBytes(videoFilePath);

          return httpClient.callPost(url, formData, headers, true);
        }
      } catch (err) {
        console.error(err);
        return new Promise(resolve => { resolve() });
      }
    }

    const setTestStatus = async (test) => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      const zbrTestId = test.zbrTestId;
      const url = urls.URL_FINISH_TEST.replace('${testRunId}', runId).replace('${testId}', zbrTestId);
      const testEnd = {
        result: test.state.toUpperCase(),
        endedAt: new Date(),
      };
      return httpClient.callPut(url, testEnd, headers);
    }

    const deletePendingTest = async (test) => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      const zbrTestId = test.zbrTestId;
      const url = urls.URL_FINISH_TEST.replace('${testRunId}', runId).replace('${testId}', zbrTestId);
      return httpClient.callDelete(url, headers);
    }

    // const startTestSession = (test) => {
    //   const headers = await getHeadersWithAuth(jsonHeaders);

    //     return getCurrentBrowser().then(currentBrowser => {
    //       let testSession = getTestSessionStart(testsData.get(test.uniqueId).zbrTestId);
    //       const defaultCapabilities = {
    //         'platformName': platforms[process.platform],
    //         'browserName': (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.name : 'n/a',
    //         'browserVersion': (currentBrowser && currentBrowser.browser) ? currentBrowser.browser.version : 'n/a'
    //       }
    //       testSession.capabilities = defaultCapabilities
    //       testSession.desiredCapabilities = defaultCapabilities
    //       let url = urls.URL_START_SESSION.replace('${testRunId}', this.runId);
    //       resolve(this.httpClient.callPost(url, testSession, headers).then(async (res) => {
    //         testsData.get(test.uniqueId).zbrSessionId = res.data.id
    //       }))
    //     })
    // }

    let promises = [];
    let testsToDelete = [];
    let testsToUpdate = [];
    if (testsDurationData) {
      await splitFullVideoIntoParts(testsDurationData, logger);
      testsDurationData?.forEach(tests => {
        tests.forEach(async (test) => {
          console.log('test: ', test);
          console.log('testsData test: ', testsData.get(test.uniqueId));
          if (test.videoFilePath && testsData?.get(test.uniqueId)) {
            if (test.state === 'pending') {
              testsToDelete.push(deletePendingTest({...test, ...testsData.get(test.uniqueId)}));
            }
            //video is sent to all tests. check test.state === 'failed' for only failed tests
            testsData.get(test.uniqueId).videoFilePath = test.videoFilePath;
            promises.push({
              id: testsData.get(test.uniqueId).zbrTestId,
              value: new Promise((resolve, reject) => {
                sendVideo(test.videoFilePath, runId, testsData.get(test.uniqueId).zbrSessionId)
                  .then((result) => {
                    console.log('result', result);
                    return resolve();
                  })
                  .catch((err) => {
                    console.log('err', err);
                    return reject();
                  })
              })
            });
          } else {
            logger.info(path.basename(__filename), 'video will not be pushed. video not exists');
            logger.debug(path.basename(__filename), `unexisted video path: ${test.videoFilePath}`);
          }
        })
      })
    }

    // set status for not deleted tests:
    // const setTestsStatus = () => {
    //   return new Promise((resolve, reject) => {
    //     return Promise.all(testsToUpdate).then((results) => {
    //       resolve();
    //     });
    //   })
    // }

    // delete pending test:
    // const deleteTests = () => {
    //   return new Promise((resolve, reject) => {
    //     return Promise.all(testsToDelete).then((results) => {
    //       return resolve();
    //     });
    //   })
    // }

    // get tests after delete
    const getTests = async () => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      const res = await httpClient.callGet(urls.URL_GET_PROJECT.replace('${projectKey}', getProjectKey()), headers);
      const projectId = res.data.data.id;
      const url = urls.URL_GET_TESTS.replace('${projectId}', projectId);
      const requestBody = {
        page: 1,
        pageSize: 10000,
        testRunId: runId,
      }
      return httpClient.callPost(url, requestBody, headers);
    }

    // finish test run:
    const registerTestRunFinish = async () => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      return httpClient.callPut(urls.URL_FINISH_RUN.concat(runId), { endedAt: new Date( Date.now() - (process.env.ZBR_RUN_END_TIMEOUT || 10000 ))}, headers);
    }

    await Promise.all(testsToDelete);
    const registeredTestsResponse = await getTests();
    const { data: { results: tests = [] } } = registeredTestsResponse;
    const registeredPendingTests = tests.filter((test) => test.status === 'PENDING').map((test) => test.id);
    testsData.forEach((value, key) => {
      if (registeredPendingTests.includes(value.zbrTestId)) {
        testsToUpdate.push(setTestStatus(value));
      }
    });
    console.log('testsToUpdate.length', testsToUpdate.length);
    if (testsToUpdate.length) {
      await Promise.all(testsToUpdate);
    }
    await registerTestRunFinish();
    const reportedTests = tests.map((test) => test.id);
    console.log('reportedTests', reportedTests);
    console.log('promises', promises);
    const videoArtifactPromises = promises.filter((item) => reportedTests.includes(item.id)).map((item) => item.value);
    console.log('video artifacts length', videoArtifactPromises.length);
    if (videoArtifactPromises.length > 0) {
      console.log('Video is sending');
      return await new Promise((resolve, reject) => {
        return Promise.all(videoArtifactPromises).then((results) => {
          console.log(results);
          console.log('Completed');
          // afterRunEventInProgress = false;
          return resolve();
        });
      });
    }
  })
  })
};

module.exports = registerZbrPlugin;