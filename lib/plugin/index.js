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
const Spinnies = require('spinnies');
const { dots } = Spinnies;
const spinnies = new Spinnies({ spinner: dots });
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
    if (afterRunEventInProgress) { return; }
    afterRunEventInProgress = true;
    const configResolver = new ConfigResolver(results.config);
    const logger = new LogUtil(configResolver);
    const httpClient = new HttpClient(configResolver, logger);
    let accessToken;
    spinnies.add('after:run', { text: 'Video processing in progress...' });

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

    console.log('durationJsonData', durationJsonData);
    console.log('testsJsonData', testsJsonData);

    const durationJsonData = await fs.readFileSync( '../zbrTestsDurationData.txt', { encoding:'utf8', flag:'r' } );
    const testsDurationData = await JSON.parse(durationJsonData, mapJsonReviver);
    const testsJsonData = await fs.readFileSync( '../zbrTestsData.txt', { encoding:'utf8', flag:'r' } );
    const { testsData, runId } = await JSON.parse(testsJsonData, mapJsonReviver);

    console.log('testsDurationData: ', testsDurationData);
    console.log('testsData: ', testsData);
    console.log('runId: ', runId);

    function deleteFiles(files, callback){
      var i = files.length;
      files.forEach(function(filepath){
        fs.unlink(filepath, function(err) {
          i--;
          if (err) {
            callback(err);
            return;
          } else if (i <= 0) {
            callback(null);
          }
        });
      });
    }

    let files = ['../zbrTestsDurationData.txt', '../zbrTestsData.txt'];

    deleteFiles(files, (err) => {
      if (err) {
        console.log(err);
      }
    });

    let promises = [];
    if (testsDurationData) {
      await splitFullVideoIntoParts(testsDurationData, logger);
      console.log(`Video splitter results: `,testsDurationData);
      testsDurationData.forEach(tests => {
        tests.forEach(test => {
          console.log('test: ', test);
          spinnies.add('promises', { text: `Video promises constructor. Condition: ${test.videoFilePath}`});
          if (test.videoFilePath) {
            //video is sent to all tests. check test.state === 'failed' for only failed tests
            testsData.get(test.uniqueId).videoFilePath = test.videoFilePath;
            promises.push(sendVideo(test.videoFilePath, runId, testsData.get(test.uniqueId).zbrSessionId));
          } else {
            logger.info(path.basename(__filename), 'video will not be pushed. video not exists');
            logger.debug(path.basename(__filename), `unexisted video path: ${test.videoFilePath}`);
          }
        })
      })
    }

    spinnies.succeed('after:run', { text: 'Video processing completed.' });

    if (promises.length > 0) {
      spinnies.add('videos', { text: 'Video artifacts sending in progress...' });
      return new Promise((resolve, reject) => {
        return Promise.all(promises).then(() => {
          spinnies.succeed('videos', { text: 'Video artifacts sent.'});
          afterRunEventInProgress = false;
          return resolve();
        });
      });
    }
  })
};

module.exports = registerZbrPlugin;