const {uuidv4} = require("./utils");

const urls = {
    URL_REFRESH: '/api/iam/v1/auth/refresh',
    URL_REGISTER_RUN: '/api/reporting/v1/test-runs?projectKey=${project}',
    URL_FINISH_RUN: '/api/reporting/v1/test-runs/',
    URL_START_TEST: '/api/reporting/v1/test-runs/${testRunId}/tests',
    URL_FINISH_TEST: '/api/reporting/v1/test-runs/${testRunId}/tests/${testId}',
    URL_SEND_LOGS: '/api/reporting/v1/test-runs/${testRunId}/logs',
    URL_SEND_SCREENSHOT: '/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/screenshots',
    URL_SET_RUN_LABELS: '/api/reporting/v1/test-runs/${testRunId}/labels',
    URL_START_SESSION: 'api/reporting/v1/test-runs/${testRunId}/test-sessions',
    URL_UPDATE_SESSION: 'api/reporting/v1/test-runs/${testRunId}/test-sessions/${testSessionId}'
};

const getRefreshToken = (token) => {
    return {
        refreshToken: token
    };
};


const getTestRunStart = (suite, reporterOptions) => {
    var testRunStartBody = {
        'uuid': uuidv4(),
        'name': suite.title,
        'startedAt': new Date(),
        'framework': 'cypress',
        'config': {}
    };
    if (reporterOptions.reportingRunEnvironment) {
        testRunStartBody.config.environment = reporterOptions.reportingRunEnvironment
    }
    if (reporterOptions.reportingRunBuild) {
        testRunStartBody.config.build = reporterOptions.reportingRunBuild
    }
    if (reporterOptions.reportingRunDisplayName) {
        testRunStartBody.name = reporterOptions.reportingRunDisplayName
    }

    return testRunStartBody;
};

const getTestRunEnd = (suite) => {
    return {
        'endedAt': new Date()
    };
};

const getTestStart = (test) => {
    var testStartBody = {
        'name': test.title,
        'startedAt': new Date(),
        'className': test.fullTitle(),
        'methodName': test.title,
        'labels': []
    };
    if(test._testConfig) {
        if(test._testConfig.owner) {
            console.debug(`Test owner ${test._testConfig.owner} was set for the test "${test.title}"`)
            testStartBody.maintainer = test._testConfig.owner
        }
        if(test._testConfig.testrailTestCaseId) {
            testStartBody.labels.push({'key': 'com.zebrunner.app/tcm.testrail.testcase-id', 'value': test._testConfig.testrailTestCaseId})
        }
        if(test._testConfig.xrayTestKey) {
            testStartBody.labels.push({'key': 'com.zebrunner.app/tcm.xray.test-key', 'value': test._testConfig.xrayTestKey})
        }  
    }
    return testStartBody;
};

const getTestEnd = (status) => {
    return {
        'endedAt': new Date(),
        'result': status
    };
};

const getTestSessionStart = (zbrTestId) => {
    return {
        'sessionId': uuidv4(),
        'initiatedAt': new Date(),
        'startedAt': new Date(),
        'capabilities': 'n/a',
        'desiredCapabilities': 'n/a',
        'testIds': [zbrTestId]
    };
};

const getTestSessionEnd = (zbrTestId) => {
    return {
        'endedAt': new Date(),
        'testIds': [zbrTestId]
    };
};

const getTestRunLabels = (reporterOptions) => {
    var testRunLabelsBody = {
        'items': []
    };
    if (reporterOptions.reportingRunLocale) {
        testRunLabelsBody.items.push({'key': 'com.zebrunner.app/sut.locale', 'value': reporterOptions.reportingRunLocale})
    }
    if(reporterOptions.reportingTestrailEnabled) {
        testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.enabled', 'value': reporterOptions.reportingTestrailEnabled})
        if(reporterOptions.reportingTestrailProjectId) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.project-id', 'value': reporterOptions.reportingTestrailProjectId})
        }
        if(reporterOptions.reportingTestrailSuiteId) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.suite-id', 'value': reporterOptions.reportingTestrailSuiteId})
        }
        if(reporterOptions.reportingTestrailTestrunName) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.testrun-name', 'value': reporterOptions.reportingTestrailTestrunName})
        }
        if(reporterOptions.reportingTestrailMilestone) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.milestone', 'value': reporterOptions.reportingTestrailMilestone})
        }
        if(reporterOptions.reportingTestrailAssignee) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.assignee', 'value': reporterOptions.reportingTestrailAssignee})
        }
        if(reporterOptions.reportingTestrailSearchInterval) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.search-interval', 'value': reporterOptions.reportingTestrailSearchInterval})
        }
        if(reporterOptions.reportingTestrailRunExists) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.run-exists', 'value': reporterOptions.reportingTestrailRunExists})
        }
        if(reporterOptions.reportingTestrailIncludeAll) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.testrail.include-all', 'value': reporterOptions.reportingTestrailIncludeAll})
        }
    }
    if(reporterOptions.reportingXrayEnabled) {
        testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.xray.enabled', 'value': reporterOptions.reportingXrayEnabled})
        if(reporterOptions.reportingXrayTestExecutionKey) {
            testRunLabelsBody.items.push({'key': 'com.zebrunner.app/tcm.xray.test-execution-key', 'value': reporterOptions.reportingXrayTestExecutionKey})
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
    getTestRunLabels
}