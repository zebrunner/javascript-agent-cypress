# Zebrunner Agent for Cypress

## Steps to install

```
npm install @zebrunner/javascript-agent-cypress
```

## How to use

1. Add next configuration into cypress.json
```
    "reporter": "@zebrunner/javascript-agent-cypress",
    "reporterOptions": {
        "reportingServerHostname": "zebrunner_service_url",
        "reportingServerAccessToken": "zebrunner_token",
        "reportingProjectKey": "zebrunner_project",
        "reportingRunEnvironment": "zebrunner_environment",
        "reportingRunBuild": "application_build_version",
        "reportingRunDisplayName": "zebrunner_run_display_name",
        "reportingRunLocale": "tested_locale",
    }
```
where parameters are:
- zebrunner_service_url - url of Zebrunner service taken from Zebrunner configuration page
- zebrunner_token - access token taken from Zebrunner configuration page
- zebrunner_project (optional) - project key in Zebrunner if used
- zebrunner_environment (optional) - tested environment. if specified will be tracked with test run
- application_build_version (optional) - if need you can set version of tested application via that parameter. it will be displayed in Zebrunner then.   
- zebrunner_run_display_name (optional) - if specified custom run version will be displayed in Zebrunner
- tested_locale (optional) - if specified locale will be displayed for the run in Zebrunner

2. Include next lines in cypress/plugins/index.js file
```
const zbrPlugin = require('@zebrunner/javascript-agent-cypress/lib/plugin');

module.exports = (on) => { zbrPlugin(on); }
```

3. Include next line in cypress/support/commands.js file
```
require('@zebrunner/javascript-agent-cypress/lib/commands/commands');
```

4. In order to track browser in Zebrunner run include next lines in cypress/support/index.js file
```
before(() => {
    cy.registerBrowser(Cypress.browser)
})
```

## Features

### Tracking of test owner
In order to track test owner you need to specify appropriate metadata in your test implementation. Here is the sample:    
```
describe('some spec', () => {
  it('test name', {'owner': 'zebrunner_username'}, () => {...}
}
```
**Important!** _zebrunner_username_ should be an existing name of the user registered in Zebrunner. If username is missing in system it won't be tracked.   

### Integration with TestRail
Zebrunner provides built in integration with TestRail test management tool.   
To enable integration with TestRail it's needed to set next properties in reporterOptions of your cypress.json:   
```
    "reportingTestrailEnabled": "",
    "reportingTestrailProjectId": "",
    "reportingTestrailSuiteId": "",
    "reportingTestrailTestrunName": "",
    "reportingTestrailMilestone": "",
    "reportingTestrailAssignee": "",
    "reportingTestrailSearchInterval": "",
    "reportingTestrailRunExists": "",
    "reportingTestrailIncludeAll": ""
```
where parameters are:   
- reportingTestrailEnabled - _true_ of _false_ to enable or disable integration
- reportingTestrailProjectId - ID of associated test project in TestRail
- reportingTestrailSuiteId - ID of suite in TestRail
- reportingTestrailTestrunName - (optional) name of existent test run in TestRail
- reportingTestrailMilestone - (optional) milestone for the run in TestRail
- reportingTestrailAssignee - (optional) assignee for the run in TestRail
- reportingTestrailSearchInterval - (optional) interval for searching of existent runs in TestRail
- reportingTestrailRunExists - (optional) _true_ or _false_ search or not for existing run in TestRail in order to update it rather than register new run
- reportingTestrailIncludeAll - (optional)

To map TestRail case ID to test body next metadata should be added to test implementation:   
```
describe('some spec', () => {
  it('test name', {'testrailTestCaseId': 'testrail_cases'}, () => {...}
}
```
where testrail_cases is list of related TestRail case IDs split by comma.

### Integration with Xray
Zebrunner provides built in integration with Xray test management tool.   
To enable integration with Xray it's needed to set next properties in reporterOptions of your cypress.json:   
```
    "reportingXrayEnabled": "",
    "reportingXrayTestExecutionKey": ""
```
where parameters are:   
- reportingXrayEnabled - _true_ of _false_ to enable or disable integration
- reportingXrayTestExecutionKey - execution key obtained at Xray

To map Xray case to test body next metadata should be added to test implementation:   
```
describe('some spec', () => {
  it('test name', {'xrayTestKey': 'xray_cases'}, () => {...}
}
```
where xray_cases is list of related Xray cases split by comma.
