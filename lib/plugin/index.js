const ipc = require('node-ipc');
const { connectToZbrIPC } = require('../ipc/client');
const { EVENTS } = require('../ipc/events');
const { HttpClient, jsonHeaders } = require('../api-client-axios');
const { ConfigResolver } = require('../config-resolver');
const { LogUtil } = require('../log-util');
const { urls, getRefreshToken } = require('../request-builder');

const registerZbrPlugin = (on, config) => {
  console.log('zbr plugin execution was started');

  const ipcConnectionAlias = `zbr-${process.ppid}`;
  const connectPromise = connectToZbrIPC(config);

  on('task', {
    zbr_registerBrowser(browser) {
      connectPromise.then(() => {
        ipc.of[ipcConnectionAlias].emit(EVENTS.REG_BROWSER, browser);
      });
      return null;
    },
  });

  on('after:run', async (results) => new Promise((resolve) => setTimeout(resolve, process.env.ZBR_RUN_END_TIMEOUT || 10000)).then(async () => {
    console.log('--- after:run event:');
    console.log('results: ', results);
    const configResolver = new ConfigResolver(results.config);
    const logger = new LogUtil(configResolver);
    const httpClient = new HttpClient(configResolver, logger);
    let accessToken;

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

    const getAllStoredTestsData = async () => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      return httpClient.callGet(urls.URL_ZE_TESTS_DATA_SAVE, headers);
    };

    const response = await getAllStoredTestsData();
    const runId = response.data?.items?.find((item) => item.key === `runId${process.env.HOSTNAME || ''}`)?.value;

    // finish test run:
    const registerTestRunFinish = async () => {
      const headers = await getHeadersWithAuth(jsonHeaders);
      return httpClient.callPut(urls.URL_FINISH_RUN.concat(runId), { endedAt: new Date(Date.now() - (process.env.ZBR_RUN_END_TIMEOUT || 10000)) }, headers);
    };

    await registerTestRunFinish();
  }));
};

module.exports = registerZbrPlugin;
