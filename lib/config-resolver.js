class ConfigResolver {

    constructor(reporterConfig) {
        this.reporterConfig = reporterConfig 
    }

    getConfigVar(envVarName, configVarName, optional = false) {
        if(process.env[envVarName]) {
            return process.env[envVarName]
        } else if (this.reporterConfig.reporterOptions[configVarName]) {
            return this.reporterConfig.reporterOptions[configVarName]
        } else {
            // just log for now
            if(!optional) {
                console.log(`parameter ${configVarName} was not set`)
            }
            return undefined
            // if(!optional) {
            //     throw new Error(`required paramater ${configVarName} is not specified`);
            // }
        }
    }

    getReportingServerHostname() {
        return this.getConfigVar('REPORTING_SERVER_HOSTNAME', 'reportingServerHostname')
    }

    getReportingServerAccessToken() {
        return this.getConfigVar('REPORTING_SERVER_ACCESS_TOKEN', 'reportingServerAccessToken')
    }

    getReportingProjectKey() {
        return this.getConfigVar('REPORTING_PROJECT_KEY', 'reportingProjectKey', true)
    }

    getReportingRunDisplayName() {
        return this.getConfigVar('REPORTING_RUN_DISPLAY_NAME', 'reportingRunDisplayName', true)
    }

    getReportingRunBuild() {
        return this.getConfigVar('REPORTING_RUN_BUILD', 'reportingRunBuild', true)
    }

    getReportingRunEnvironment() {
        return this.getConfigVar('REPORTING_RUN_ENVIRONMENT', 'reportingRunEnvironment', true)
    }

    getReportingCiRunId() {
        return this.getConfigVar('REPORTING_CI_RUN_ID', 'reportingCiRunId', true)
    }

    getSlackChannels() {
        return this.getConfigVar('REPORTING_SLACK_CHANNELS', 'reportingSlackChannels', true)
    }

    getEmailRecipients() {
        return this.getConfigVar('REPORTING_EMAIL_RECIPIENTS', 'reportingEmailRecipients', true)
    }

    getDebugLogging() {
        return this.getConfigVar('REPORTING_DEBUG_LOGGING', 'reportingDebugLogging', true)
    }

}

module.exports = {
    ConfigResolver
};