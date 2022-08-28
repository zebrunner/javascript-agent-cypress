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

    let promises = [];
    if (testsDurationData) {
      await splitFullVideoIntoParts(testsDurationData, logger);
      testsDurationData?.forEach(tests => {
        tests.forEach(async (test) => {
          console.log('test: ', test);
          console.log('testsData test: ', testsData.get(test.uniqueId));
          if (test.videoFilePath && testsData?.get(test.uniqueId)) {
            //video is sent to all tests. check test.state === 'failed' for only failed tests
            testsData.get(test.uniqueId).videoFilePath = test.videoFilePath;
            promises.push(new Promise((resolve, reject) => {
                sendVideo(test.videoFilePath, runId, testsData.get(test.uniqueId).zbrSessionId)
                  .then((result) => {
                    console.log('result', result);
                    return resolve(result);
                  })
                  .catch((err) => {
                    console.log('err', err);
                    return reject(err);
                  })
              }));
          } else {
            logger.info(path.basename(__filename), 'video will not be pushed. video not exists');
            logger.debug(path.basename(__filename), `unexisted video path: ${test.videoFilePath}`);
          }
        })
      })
    }

    // finish test run:
    const registerTestRunFinish = async () => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      return httpClient.callPut(urls.URL_FINISH_RUN.concat(runId), { endedAt: new Date( Date.now() - (process.env.ZBR_RUN_END_TIMEOUT || 10000 ))}, headers);
    }

    await registerTestRunFinish();

    if (promises.length > 0) {
      console.log('Video is sending');
      return await new Promise((resolve, reject) => {
        return Promise.all(promises).then((results) => {
          console.log(results);
          console.log('Completed');
          return resolve();
        });
      });
    }
  })
  })
};

module.exports = registerZbrPlugin;
