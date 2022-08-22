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
    console.log('process.env.ZBR_RUN_END_TIMEOUT', process.env.ZBR_RUN_END_TIMEOUT);
    return new Promise(resolve => setTimeout(resolve, process.env.ZBR_RUN_END_TIMEOUT || 10000)).then(async () => {
    console.log('--- after:run event:');
    // console.log('results: ', results);
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
    const testsDataString = response.data?.items?.find((item) => item.key === runId)?.value;
    const testsData = testsDataString && safelyParseJSON(testsDataString);
    const durationsData = response.data?.items?.find((item) => item.key === `zebSuiteTestsData${process.env.HOSTNAME || ''}`)?.value;
    const testsDurationData = durationsData && safelyParseJSON(durationsData);
    // const storedSessionsIdString = response.data?.items.find((item) => item.key === `storedSessionsId${process.env.HOSTNAME || ''}`)?.value;
    // const storedSessionsId = storedSessionsIdString && safelyParseJSON(storedSessionsIdString);
    // console.log('getAllStoredTestsData runID', runId);
    // console.log('getAllStoredTestsData testsData', testsData);
    // console.log('getAllStoredTestsData testsDurationData', testsDurationData);
    // console.log('getAllStoredTestsData storedSessionsId', storedSessionsId);

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

    const setTestStatus = async (test) => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      const zbrTestId = test.zbrTestId;
      const url = urls.URL_FINISH_TEST.replace('${testRunId}', runId).replace('${testId}', zbrTestId);
      const testEnd = {
        'result': test.status
      };
      return httpClient.callPut(url, testEnd, headers);
    }

    const deletePendingTest = async (test) => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      const zbrTestId = test.zbrTestId;
      const url = urls.URL_FINISH_TEST.replace('${testRunId}', runId).replace('${testId}', zbrTestId);
      return httpClient.callDelete(url, headers);
    }

  //   let durationJsonData;
  //   let testsJsonData;
  //   let testsData;
  //   let runId;

  //   if (fs.existsSync(path.join(__dirname, '..', `zbrTestsDurationData${process.env.HOSTNAME || ''}.txt`))) {
  //     durationJsonData = await fs.readFileSync(path.join(__dirname, '..', `zbrTestsDurationData${process.env.HOSTNAME || ''}.txt`), { encoding:'utf8', flag:'r' } );
  //   }

  //   if (fs.existsSync(path.join(__dirname, '..', `zbrTestsData${process.env.HOSTNAME || ''}.txt`))) {
  //     testsJsonData = await fs.readFileSync(path.join(__dirname, '..', `zbrTestsData${process.env.HOSTNAME || ''}.txt`), { encoding:'utf8', flag:'r' } );
  //   }

  //   const testsDurationData = await safelyParseJSON(durationJsonData) || {};
  //   const rTestsData = await safelyParseJSON(testsJsonData) || {};
  //   testsData = rTestsData.testsData;
  //   runId = rTestsData.runId;

  //   console.log('testsDurationData: ', testsDurationData);
  //   console.log('testsData: ', testsData);
  //   console.log('runId: ', runId);

  //   function deleteFiles(files, callback){
  //     var i = files.length;
  //     files.forEach(function(filepath){
  //       fs.unlink(filepath, function(err) {
  //         i--;
  //         if (err) {
  //           callback(err);
  //           return;
  //         } else if (i <= 0) {
  //           callback(null);
  //         }
  //       });
  //     });
  //   }

  //   let files = [path.join(__dirname, '..', `zbrTestsDurationData${process.env.HOSTNAME || ''}.txt`), path.join(__dirname, '..', `zbrTestsData${process.env.HOSTNAME || ''}.txt`)];

  //   deleteFiles(files, (err) => {
  //     if (err) {
  //       console.log(err);
  //     }
  //   });

    let promises = [];
    if (testsDurationData) {
      await splitFullVideoIntoParts(testsDurationData, logger);
      testsDurationData?.forEach(tests => {
        tests.forEach(async (test) => {
          console.log('test: ', test);
          if (test.videoFilePath && testsData?.get(test.uniqueId)) {
            promises.push(test.state === 'pending' ? deletePendingTest({...test, ...testsData.get(test.uniqueId)}) : setTestStatus({...test, ...testsData.get(test.uniqueId)}));
            //video is sent to all tests. check test.state === 'failed' for only failed tests
            testsData.get(test.uniqueId).videoFilePath = test.videoFilePath;
            console.log('testsData.get(test.uniqueId).zbrSessionId)', testsData.get(test.uniqueId).zbrSessionId);
            promises.push(sendVideo(test.videoFilePath, runId, testsData.get(test.uniqueId).zbrSessionId));
          } else {
            logger.info(path.basename(__filename), 'video will not be pushed. video not exists');
            logger.debug(path.basename(__filename), `unexisted video path: ${test.videoFilePath}`);
          }
        })
      })
    }

    if (promises.length > 0) {
      return new Promise((resolve, reject) => {
        return Promise.all(promises).then(() => {
          // afterRunEventInProgress = false;
          return resolve();
        });
      });
    }
  })
  })
};

module.exports = registerZbrPlugin;