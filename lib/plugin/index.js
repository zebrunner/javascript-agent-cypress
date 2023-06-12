const ipc = require('node-ipc');
const fs = require('fs');
const path = require('path');
const { connectToZbrIPC } = require('../ipc/client');
const { EVENTS } = require('../ipc/events');
const { HttpClient, jsonHeaders } = require('../api-client-axios');
const { ConfigResolver } = require('../config-resolver');
const { LogUtil } = require('../log-util');
const { urls, getRefreshToken } = require('../request-builder');
const { waitForFileExists } = require('../utils');

const registerZbrPlugin = (on, config) => {
  const ipcConnectionAlias = `zbr-${process.ppid}`;
  const connectPromise = connectToZbrIPC(config);

  on('task', {
    zbr_registerBrowser(browser) {
      connectPromise.then(() => {
        ipc.of[ipcConnectionAlias].emit(EVENTS.REG_BROWSER, browser);
      });
      return null;
    },
    zbr_zebrunnerTestCase(testCase) {
      connectPromise.then(() => {
        ipc.of[ipcConnectionAlias].emit(EVENTS.ADD_TEST_CASES, testCase);
      });
      return null;
    },
  });

  on('task', {
    zbr_attachZbrTestLabel({ labels }) {
      const [key, ...values] = labels;

      connectPromise.then(() => {
        ipc.of[ipcConnectionAlias].emit(EVENTS.ATTACH_TEST_LABELS, { key, values });
      });
      return null;
    },
  });

  on('task', {
    zbr_attachZbrLaunchLabel({ labels }) {
      const [key, ...values] = labels;

      connectPromise.then(() => {
        ipc.of[ipcConnectionAlias].emit(EVENTS.ATTACH_LAUNCH_LABELS, { key, values });
      });
      return null;
    },
  });

  on('before:run', (details) => {
    console.log('before:run details', details);
  });

  // on('after:spec', (spec, results) => {
  //   console.log('after:spec', spec);
  //   console.log('after:spec', results);
  // });

  on('after:run', async (results) => {
    if (process.env.ZEBRUNNER_RUN_ID) {
      // wait for all finishTestPromises on EVENT_RUN_END
      // then create a file .${process.env.ZEBRUNNER_RUN_ID} that means Zebrunner reporting is done
      const timeout = process.env.ZBR_RUN_END_TIMEOUT || 60000;
      return waitForFileExists(`./.${process.env.ZEBRUNNER_RUN_ID}`, 0, timeout, 1000).then(() => {
        console.log('ZEBRUNNER_RUN_END');
      });
    }

    return new Promise((resolve) => setTimeout(resolve, process.env.ZBR_RUN_END_TIMEOUT || 1000)).then(async () => {
      console.log('--- after:run event:');
      console.log('results: ', results);
      const configResolver = new ConfigResolver(results.config);
      const logger = new LogUtil(configResolver);
      const httpClient = new HttpClient(configResolver, logger);
      const runIdFilePath = path.join(__dirname, '..', `zbrTestsData${process.env.HOSTNAME || ''}.txt`);
      let accessToken;
      let runIdData;

      const refreshToken = async () => {
        if (!accessToken) {
          const res = await httpClient.callPost(urls.URL_REFRESH, getRefreshToken(configResolver.getReportingServerAccessToken()), jsonHeaders.headers, true);
          const token = `${res.data.authTokenType} ${res.data.authToken}`;
          accessToken = token;
        }
        return accessToken;
      };

      const getHeadersWithAuth = async (basicHeaders) => {
        const authToken = await refreshToken();
        if (authToken) {
          const authHeaders = basicHeaders.headers;
          authHeaders.Authorization = authToken;
          return authHeaders;
        }
      };

      if (fs.existsSync(runIdFilePath)) {
        runIdData = JSON.parse(fs.readFileSync(runIdFilePath, { encoding: 'utf8', flag: 'r' }));
      }

      const { runId } = runIdData;

      try {
        fs.unlinkSync(runIdFilePath);
      } catch (err) {
        console.error(err);
      }

    // set test run label:
      const testRunLabel = results.config?.env?.TAGS;

      if (testRunLabel) {
        const headers = await getHeadersWithAuth(jsonHeaders);
        await httpClient.callPut(urls.URL_ATTACH_TEST_RUN_LABELS.replace('${testRunId}', runId), { items: [{ key: 'tags', value: testRunLabel }] }, headers);
      }

    // finish test run:
      const registerTestRunFinish = async () => {
        const headers = await getHeadersWithAuth(jsonHeaders);
        return httpClient.callPut(urls.URL_FINISH_RUN.concat(runId), { endedAt: new Date(Date.now() - (process.env.ZBR_RUN_END_TIMEOUT || 1000)) }, headers);
      };

      await registerTestRunFinish();
    });
  });
};

module.exports = registerZbrPlugin;
