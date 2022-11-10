class ConfigResolver {
  constructor(reporterConfig) {
    this.reporterConfig = reporterConfig;
  }

  getConfigVar(envVarName, configVarName, optional = false) {
    if (process.env[envVarName]) {
      return process.env[envVarName];
    }
    if (this.reporterConfig.reporterOptions[configVarName]) {
      return this.reporterConfig.reporterOptions[configVarName];
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
    return this.getConfigVar('REPORTING_LOGGIN_ENABLED', 'reportingLoggingEnabled', true);
  }

  getLoggingLevel() {
    return this.getConfigVar('REPORTING_LOGGING_LEVEL', 'reportingLoggingLevel', true);
  }
}

module.exports = {
  ConfigResolver,
};
