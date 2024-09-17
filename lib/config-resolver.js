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
    return this.getConfigVar('REPORTING_LAUNCH_DISPLAY_NAME', 'reportingLaunchDisplayName', true);
  }

  getReportingRunBuild() {
    return this.getConfigVar('REPORTING_RUN_BUILD', 'reportingLaunchBuild', true);
  }

  getReportingRunTreatSkipsAsFailures() {
    return this.getConfigVar('REPORTING_LAUNCH_TREAT_SKIPS_AS_FAILURES', 'reportingLaunchTreatSkipsAsFailures', true);
  }

  getReportingMilestoneName() {
    return this.getConfigVar('REPORTING_MILESTONE_NAME', 'reportingMilestoneName');
  }

  getReportingMilestoneId() {
    return this.getConfigVar('REPORTING_MILESTONE_ID', 'reportingMilestoneId');
  }

  getReportingRunEnvironment() {
    return this.getConfigVar('REPORTING_RUN_ENVIRONMENT', 'reportingLaunchEnvironment', true);
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

  getReportingTcmTestCaseStatusOnSkip() {
    return this.getConfigVar('REPORTING_TCM_TEST_CASE_STATUS_ON_SKIP', 'tcm.testCaseStatus.onSkip');
  }

  getReportingTcmZebrunner() {
    return {
      pushResults: this.getConfigVar('REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS', 'tcm.zebrunner.pushResults'),
      pushInRealTime: this.getConfigVar('REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME', 'tcm.zebrunner.pushInRealTime'),
      testRunId: this.getConfigVar('REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID', 'tcm.zebrunner.testRunId'),
    };
  }

  getReportingTcmXray() {
    return {
      pushResults: this.getConfigVar('REPORTING_TCM_XRAY_PUSH_RESULTS', 'tcm.xray.pushResults'),
      pushInRealTime: this.getConfigVar('REPORTING_TCM_XRAY_PUSH_IN_REAL_TIME', 'tcm.xray.pushInRealTime'),
      executionKey: this.getConfigVar('REPORTING_TCM_XRAY_EXECUTION_KEY', 'tcm.xray.executionKey'),
    };
  }

  getReportingTcmZephyr() {
    return {
      pushResults: this.getConfigVar('REPORTING_TCM_ZEPHYR_PUSH_RESULTS', 'tcm.zephyr.pushResults'),
      pushInRealTime: this.getConfigVar('REPORTING_TCM_ZEPHYR_PUSH_IN_REAL_TIME', 'tcm.zephyr.pushInRealTime'),
      testCycleKey: this.getConfigVar('REPORTING_TCM_ZEPHYR_JIRA_PROJECT_KEY', 'tcm.zephyr.testCycleKey'),
      jiraProjectKey: this.getConfigVar('REPORTING_TCM_ZEPHYR_TEST_CYCLE_KEY', 'tcm.zephyr.jiraProjectKey'),
    };
  }

  getReportingTcmTestRail() {
    return {
      pushResults: this.getConfigVar('REPORTING_TCM_TESTRAIL_PUSH_RESULTS', 'tcm.testRail.pushResults'),
      pushInRealTime: this.getConfigVar('REPORTING_TCM_TESTRAIL_PUSH_IN_REAL_TIME', 'tcm.testRail.pushInRealTime'),
      suiteId: this.getConfigVar('REPORTING_TCM_TESTRAIL_SUITE_ID', 'tcm.testRail.suiteId'),
      runId: this.getConfigVar('REPORTING_TCM_TESTRAIL_RUN_ID', 'tcm.testRail.runId'),
      runName: this.getConfigVar('REPORTING_TCM_TESTRAIL_RUN_NAME', 'tcm.testRail.runName'),
      includeAllTestCasesInNewRun: this.getConfigVar(
        'REPORTING_TCM_TESTRAIL_INCLUDE_ALL_IN_NEW_RUN',
        'tcm.testRail.includeAllTestCasesInNewRun',
      ),
      milestoneName: this.getConfigVar('REPORTING_TCM_TESTRAIL_MILESTONE_NAME', 'tcm.testRail.milestoneName'),
      assignee: this.getConfigVar('REPORTING_TCM_TESTRAIL_ASSIGNEE', 'tcm.testRail.assignee'),
    };
  }
}

module.exports = {
  ConfigResolver,
};
