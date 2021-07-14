const {uuidv4} = require("./utils");

const urls = {
    URL_REFRESH: '/api/iam/v1/auth/refresh',
    URL_REGISTER_RUN: '/api/reporting/v1/test-runs?projectKey=${project}',
    URL_FINISH_RUN: '/api/reporting/v1/test-runs/',
    URL_START_TEST: '/api/reporting/v1/test-runs/${testRunId}/tests',
    URL_FINISH_TEST: '/api/reporting/v1/test-runs/${testRunId}/tests/${testId}',
    URL_SEND_LOGS: '/api/reporting/v1/test-runs/${testRunId}/logs',
    URL_SEND_SCREENSHOT: '/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/screenshots',
    URL_START_SESSION: 'api/reporting/v1/test-runs/${testRunId}/test-sessions',
    URL_UPDATE_SESSION: 'api/reporting/v1/test-runs/${testRunId}/test-sessions/${testSessionId}'
};

const getRefreshToken = (token) => {
    return {
        refreshToken: token
    };
};


const getTestRunStart = (suite) => {
    return {
        'uuid': uuidv4(),
        'name': suite.title,
        'startedAt': new Date(),
        'framework': 'cypress'
    };
};

const getTestRunEnd = (suite) => {
    return {
        'endedAt': new Date()
    };
};

const getTestStart = (test) => {
    return {
        'name': test.title,
        'startedAt': new Date(),
        'className': test.fullTitle(),
        'methodName': test.title
    };
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

const getLog = (zbrTestId) => {
    return {
        'endedAt': new Date(),
        'testIds': [zbrTestId]
    };
};

module.exports = {
    urls,
    getRefreshToken,
    getTestRunStart,
    getTestRunEnd,
    getTestStart,
    getTestEnd,
    getTestSessionStart,
    getTestSessionEnd
}