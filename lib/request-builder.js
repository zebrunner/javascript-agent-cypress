const { v4: uuidv4 } = require('uuid');
const { ConfigResolver } = require('./config-resolver');

const urls = {
  URL_REFRESH: '/api/iam/v1/auth/refresh',
  URL_REGISTER_RUN: '/api/reporting/v1/test-runs?projectKey=${project}',
  URL_FINISH_RUN: '/api/reporting/v1/test-runs/',
  URL_START_TEST: '/api/reporting/v1/test-runs/${testRunId}/tests',
  URL_FINISH_TEST: '/api/reporting/v1/test-runs/${testRunId}/tests/${testId}',
  URL_SEND_LOGS: '/api/reporting/v1/test-runs/${testRunId}/logs',
  URL_SEND_SCREENSHOT: '/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/screenshots',
  URL_SET_RUN_LABELS: '/api/reporting/v1/test-runs/${testRunId}/labels',
  URL_START_SESSION: '/api/reporting/v1/test-runs/${testRunId}/test-sessions',
  URL_UPDATE_SESSION: '/api/reporting/v1/test-runs/${testRunId}/test-sessions/${testSessionId}',
  URL_RUN_CONTEXT_EXCHANGE: '/api/reporting/v1/run-context-exchanges',
  URL_SEND_RUN_LABELS: '/api/reporting/v1/test-runs/${testRunId}/labels',
};

const testrailLabels = {
  L_SYNC_ENABLED: 'com.zebrunner.app/tcm.testrail.sync.enabled',
  L_SYNC_REAL_TIME: 'com.zebrunner.app/tcm.testrail.sync.real-time',
  L_INCLUDE_ALL: 'com.zebrunner.app/tcm.testrail.include-all-cases',
  L_SUITE_ID: 'com.zebrunner.app/tcm.testrail.suite-id',
  L_RUN_ID: 'com.zebrunner.app/tcm.testrail.run-id',
  L_RUN_NAME: 'com.zebrunner.app/tcm.testrail.run-name',
  L_MILESTONE: 'com.zebrunner.app/tcm.testrail.milestone',
  L_ASSIGNEE: 'com.zebrunner.app/tcm.testrail.assignee',
  L_CASE_ID: 'com.zebrunner.app/tcm.testrail.case-id',
};

const xrayLabels = {
  L_SYNC_ENABLED: 'com.zebrunner.app/tcm.xray.sync.enabled',
  L_SYNC_REAL_TIME: 'com.zebrunner.app/tcm.xray.sync.real-time',
  L_EXECUTION_KEY: 'com.zebrunner.app/tcm.xray.test-execution-key',
  L_TEST_KEY: 'com.zebrunner.app/tcm.xray.test-key',
};

const getRefreshToken = (token) => ({
  refreshToken: token,
});

const getTestRunStart = (suite, reporterConfig, testRunUuid = null) => {
  const testRunStartBody = {
    uuid: testRunUuid || uuidv4(),
    name: suite.title,
    startedAt: new Date(),
    framework: 'cypress',
    config: {},
    notificationTargets: [],
  };
  const configResolver = new ConfigResolver(reporterConfig);

  if (configResolver.getReportingRunEnvironment()) {
    testRunStartBody.config.environment = configResolver.getReportingRunEnvironment();
  }
  if (configResolver.getReportingRunBuild()) {
    testRunStartBody.config.build = configResolver.getReportingRunBuild();
  }
  if (configResolver.getReportingRunDisplayName()) {
    testRunStartBody.name = configResolver.getReportingRunDisplayName();
  }

  if (configResolver.getSlackChannels()) {
    testRunStartBody.notificationTargets.push({ type: 'SLACK_CHANNELS', value: configResolver.getSlackChannels() });
  }
  if (configResolver.getEmailRecipients()) {
    testRunStartBody.notificationTargets.push({ type: 'EMAIL_RECIPIENTS', value: configResolver.getEmailRecipients() });
  }

  return testRunStartBody;
};

const getTestRunEnd = () => ({
  endedAt: new Date(),
});

const getTestStart = (test) => {
  const testStartBody = {
    name: test.title,
    startedAt: new Date(),
    className: test.fullTitle,
    methodName: test.title,
    labels: [],
  };
  let testConfig;
  // in newest version of cypress test metadata is coming in test._testConfig.unverifiedTestConfig object
  // but in old ones it was test._testConfig object
  if (test._testConfig) {
    testConfig = test._testConfig.unverifiedTestConfig ? test._testConfig.unverifiedTestConfig : test._testConfig;
  }
  if (testConfig) {
    if (testConfig.owner) {
      // console.debug(`Test owner ${testConfig.owner} was set for the test "${test.title}"`)
      testStartBody.maintainer = testConfig.owner;
    }
    if (testConfig.testrailTestCaseId) {
      if (testConfig.testrailTestCaseId instanceof Array) {
        testConfig.testrailTestCaseId.forEach((caseId) => {
          testStartBody.labels.push({ key: testrailLabels.L_CASE_ID, value: caseId });
        });
      } else {
        testStartBody.labels.push({ key: testrailLabels.L_CASE_ID, value: testConfig.testrailTestCaseId });
      }
    }
    if (testConfig.xrayTestKey) {
      if (testConfig.xrayTestKey instanceof Array) {
        testConfig.xrayTestKey.forEach((caseId) => {
          testStartBody.labels.push({ key: xrayLabels.L_TEST_KEY, value: caseId });
        });
      } else {
        testStartBody.labels.push({ key: xrayLabels.L_TEST_KEY, value: testConfig.xrayTestKey });
      }
    }
  }
  return testStartBody;
};

const getTestEnd = (status) => ({
  endedAt: new Date(),
  result: status,
});

const getTestSessionStart = (zbrTestId) => ({
  sessionId: uuidv4(),
  initiatedAt: new Date(),
  startedAt: new Date(),
  capabilities: 'n/a',
  desiredCapabilities: 'n/a',
  testIds: [zbrTestId],
});

const getTestSessionEnd = (zbrTestId) => ({
  endedAt: new Date(),
  testIds: [zbrTestId],
});

const getTestRunLabels = (reporterOptions) => {
  const testRunLabelsBody = {
    items: [],
  };
  if (reporterOptions.reportingRunLocale) {
    testRunLabelsBody.items.push({ key: 'com.zebrunner.app/sut.locale', value: reporterOptions.reportingRunLocale });
  }
  if (reporterOptions.reportingTestrailEnabled) {
    if (reporterOptions.reportingTestrailEnabled) {
      testRunLabelsBody.items.push({ key: testrailLabels.L_SYNC_ENABLED, value: reporterOptions.reportingTestrailEnabled });
    }
    if (reporterOptions.reportingTestrailSuiteId) {
      testRunLabelsBody.items.push({ key: testrailLabels.L_SUITE_ID, value: reporterOptions.reportingTestrailSuiteId });
    }
    if (reporterOptions.reportingTestrailTestrunID) {
      testRunLabelsBody.items.push({ key: testrailLabels.L_RUN_ID, value: reporterOptions.reportingTestrailTestrunID });
    }
    if (reporterOptions.reportingTestrailTestrunName) {
      testRunLabelsBody.items.push({ key: testrailLabels.L_RUN_NAME, value: reporterOptions.reportingTestrailTestrunName });
    }
    if (reporterOptions.reportingTestrailMilestone) {
      testRunLabelsBody.items.push({ key: testrailLabels.L_MILESTONE, value: reporterOptions.reportingTestrailMilestone });
    }
    if (reporterOptions.reportingTestrailAssignee) {
      testRunLabelsBody.items.push({ key: testrailLabels.L_ASSIGNEE, value: reporterOptions.reportingTestrailAssignee });
    }
    if (reporterOptions.reportingTestrailIncludeAll) {
      testRunLabelsBody.items.push({ key: testrailLabels.L_INCLUDE_ALL, value: reporterOptions.reportingTestrailIncludeAll });
    }
  }
  if (reporterOptions.reportingXrayEnabled) {
    testRunLabelsBody.items.push({ key: xrayLabels.L_SYNC_ENABLED, value: reporterOptions.reportingXrayEnabled });
    if (reporterOptions.reportingXrayTestExecutionKey) {
      testRunLabelsBody.items.push({ key: xrayLabels.L_EXECUTION_KEY, value: reporterOptions.reportingXrayTestExecutionKey });
    }
  }

  return testRunLabelsBody;
};

module.exports = {
  urls,
  getRefreshToken,
  getTestRunStart,
  getTestRunEnd,
  getTestStart,
  getTestEnd,
  getTestSessionStart,
  getTestSessionEnd,
  getTestRunLabels,
};
