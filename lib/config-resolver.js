const getValueByPath = (object, path) => path.split('.').reduce((o, k) => o?.[k], object);

class ConfigResolver {
  constructor(reporterConfig) {
    this.reporterConfig = reporterConfig;
  }

  getConfigVar(envVarName, configVarName, optional = false) {
    if (envVarName && process.env[envVarName]) {
      return process.env[envVarName];
    }

    const configValue = configVarName ? getValueByPath(this.reporterConfig.reporterOptions, configVarName) : null;

    // configValue value can be either undefined | null | true | false | 'string' so explicitly checking that not undefined and not null
    if (configValue !== undefined && configValue !== null) {
      return configValue;
    }
      // just log for now
    if (!optional) {
      console.log(`parameter ${configVarName} was not set`);
    }

    return undefined;
      // if(!optional) {
      //     throw new Error(`required paramater ${configVarName} is not specified`);
      // }
  }

  getReportingServerHostname() {
    return this.getConfigVar('REPORTING_SERVER_HOSTNAME', 'reportingServerHostname');
  }

  getReportingServerAccessToken() {
    return this.getConfigVar('REPORTING_SERVER_ACCESS_TOKEN', 'reportingServerAccessToken');
  }

  getReportingProjectKey() {
    return this.getConfigVar('REPORTING_PROJECT_KEY', 'reportingProjectKey', true);
  }

  getReportingRunDisplayName() {
    return this.getConfigVar('REPORTING_RUN_DISPLAY_NAME', 'reportingRunDisplayName', true);
  }

  getReportingRunBuild() {
    return this.getConfigVar('REPORTING_RUN_BUILD', 'reportingRunBuild', true);
  }

  getReportingRunEnvironment() {
    return this.getConfigVar('REPORTING_RUN_ENVIRONMENT', 'reportingRunEnvironment', true);
  }

  getSlackChannels() {
    return this.getConfigVar('REPORTING_SLACK_CHANNELS', 'reportingSlackChannels', true);
  }

  getEmailRecipients() {
    return this.getConfigVar('REPORTING_EMAIL_RECIPIENTS', 'reportingEmailRecipients', true);
  }

  getLoggingEnabled() {
    return this.getConfigVar('REPORTING_LOGGING_ENABLED', 'reportingLoggingEnabled', true);
  }

  getLoggingLevel() {
    return this.getConfigVar('REPORTING_LOGGING_LEVEL', 'reportingLoggingLevel', true);
  }

  getReportingTcmTestCaseStatusOnPass() {
    return this.getConfigVar('REPORTING_TCM_TEST_CASE_STATUS_ON_PASS', 'tcm.testCaseStatus.onPass');
  }

  getReportingTcmTestCaseStatusOnFail() {
    return this.getConfigVar('REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL', 'tcm.testCaseStatus.onFail');
  }

  getReportingTcmZebrunner() {
    return {
      pushResults: this.getConfigVar('REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS', 'tcm.zebrunner.pushResults'),
      pushInRealTime: this.getConfigVar('REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME', 'tcm.zebrunner.pushInRealTime'),
      testRunId: this.getConfigVar('REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID', 'tcm.zebrunner.testRunId'),
    };
  }
}

module.exports = {
  ConfigResolver,
};
