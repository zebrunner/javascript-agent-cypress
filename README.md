# Zebrunner Cypress agent

## Inclusion into your project

In order to install the reporting agent dependency please execute the following command:

```shell
npm install @zebrunner/javascript-agent-cypress
```

## Tracking of test results

This section contains details on configuration required for the reporter and key features provided by agent APIs.

### Configuration

1. Add reporter settings to Cypress config file

   It is currently possible to provide the configuration via Cypress config file `cypress.json`.

   Please see sample configuration below:
    ```json
        "reporter": "@zebrunner/javascript-agent-cypress",
        "reporterOptions": {
            "reportingServerHostname": "<YOUR_ZEBRUNNER_SERVER_URL>",
            "reportingServerAccessToken": "<YOUR_ZEBRUNNER_ACCESS_TOKEN>",
            "reportingProjectKey": "DEF",
            "reportingRunEnvironment": "STAGE",
            "reportingRunBuild": "1.0-alpha",
            "reportingRunDisplayName": "My regression suite",
            "reportingRunLocale": "en_US",
            "reportingSlackChannels": "",
            "reportingEmailRecipients": ""
        }
    ```

   Here's the summary of configuration parameters recognized by the agent:
    - `reportingServerHostname` - Zebrunner server hostname. It can be obtained in Zebrunner on the **Account & Profile** page under the **Service URL** section
    - `reportingServerAccessToken` - access token must be used to perform API calls. It can be obtained in Zebrunner on the **Account & Profile** page under the **Token** section
    - `reportingProjectKey` the project that the test run belongs to. Project must exist in Zebrunner. The default value is `DEF`. You can manage projects in Zebrunner in the appropriate section
    - `reportingRunEnvironment` (optional) - tested environment. Appropriate test run label will be used for test run, if specified
    - `reportingRunBuild` (optional) - build number that is associated with the test run. It can depict either the test build number or the application build number
    - `reportingRunDisplayName` (optional) - display name of the test run
    - `reportingRunLocale` (optional) - locale, that will be displayed for the run in Zebrunner if specified
    - `reportingSlackChannels` (optional) - comma separated list of slack channels for notifications
    - `reportingEmailRecipients` (optional) - comma separated list of recipients for email notifications

2. Include and enable Zebrunner reporting plugin

   Add the following to `cypress/plugins/index.js` file:
    ```javascript
    const zbrPlugin = require('@zebrunner/javascript-agent-cypress/lib/plugin');

    module.exports = (on, config) => { zbrPlugin(on, config); }
    ```

   Include the following next line in cypress/support/commands.js file
    ```javascript
    require('@zebrunner/javascript-agent-cypress/lib/commands/commands');
    ```

3. In order to track browser in Zebrunner run include next lines in cypress/support/index.js file
```javascript
before(() => {
    cy.registerBrowser(Cypress.browser)
})
```

#### Configuration via environment variables

The following configuration parameters are recognized by the agent:
- `REPORTING_SERVER_HOSTNAME` - mandatory if reporting is enabled. It is Zebrunner server hostname. It can be obtained in Zebrunner on the 'Account & profile' page under the 'Service URL' section;
- `REPORTING_SERVER_ACCESS_TOKEN` - mandatory if reporting is enabled. Access token must be used to perform API calls. It can be obtained in Zebrunner on the 'Account & profile' page under the 'Token' section;
- `REPORTING_PROJECT_KEY` - optional value. It is the project that the test run belongs to. The default value is `UNKNOWN`. You can manage projects in Zebrunner in the appropriate section;
- `REPORTING_RUN_DISPLAY_NAME` - optional value. It is the display name of the test run. The default value is `Default Suite`;
- `REPORTING_RUN_BUILD` - optional value. It is the build number that is associated with the test run. It can depict either the test build number or the application build number;
- `REPORTING_RUN_ENVIRONMENT` - optional value. It is the environment where the tests will run.
- `REPORTING_SLACK_CHANNELS` - optional value. Predefined list of slack channels for results notifications.
- `REPORTING_EMAIL_RECIPIENTS` - optional value. Predefined list of recipients for email notifications.

### Tracking test maintainer

You may want to add transparency to the process of automation maintenance by having an engineer responsible for evolution of specific tests or test classes.
Zebrunner comes with a concept of a maintainer - a person that can be assigned to maintain tests.

`owner` attribute should be set in your test implementation. Here is an example:
```javascript
describe('some spec', () => {
  it('test name', {'owner': '<username>'}, () => {...}
}
```

The maintainer username should be a valid Zebrunner username, otherwise it will be set to `anonymous`.

### Integration with TestRail

Zebrunner provides built in integration with TestRail test case management tool.

To enable integration with TestRail it's needed to set next properties in `reporterOptions` of your `cypress.json`:
```json
    "reportingTestrailEnabled": "",
    "reportingTestrailSuiteId": "",
    "reportingTestrailTestrunName": "",
    "reportingTestrailTestrunID": "",
    "reportingTestrailMilestone": "",
    "reportingTestrailAssignee": "",
    "reportingTestrailIncludeAll": ""
```

Here's the summary of configuration parameters:
- `reportingTestrailEnabled` - _true_ of _false_ to enable or disable integration
- `reportingTestrailSuiteId` - ID of suite in TestRail
- `reportingTestrailTestrunName` - (optional) name of existent test run in TestRail
- `reportingTestrailTestrunID` - (optional) ID of existent test run in TestRail
- `reportingTestrailMilestone` - (optional) milestone for the run in TestRail
- `reportingTestrailAssignee` - (optional) assignee for the run in TestRail
- `reportingTestrailIncludeAll` - (optional)

To map TestRail case ID to test body the following metadata attribute should be added to test implementation:
```javascript
describe('some spec', () => {
  it('test name', {'testrailTestCaseId': 'case_id'}, () => {...}
}
```
where `case_id` is related TestRail test case ID.
If you need to pass multiple case IDs at once please follow the next pattern:
```javascript
describe('some spec', () => {
  it('test name', {'testrailTestCaseId': ['case_id_1', 'case_id_2']}, () => {...}
}
```

### Integration with Xray

Zebrunner provides built in integration with Xray test management tool.

To enable integration with Xray it's needed to set next properties in `reporterOptions` of your `cypress.json`:
```json
    "reportingXrayEnabled": "",
    "reportingXrayTestExecutionKey": ""
```
where parameters are:
- `reportingXrayEnabled` - _true_ of _false_ to enable or disable integration
- `reportingXrayTestExecutionKey` - execution key obtained at Xray

To map Xray case to test body the following metadata attribute should be added to test implementation:
```javascript
describe('some spec', () => {
  it('test name', {'xrayTestKey': 'test_keys'}, () => {...}
}
```
where `test_keys` is list of related Xray cases split by a comma.

### Tracking of test artifacts
By default agent pushes to Zebrunner server screenshot for every test failure.
You may find it in the details for the failed tests at the report page.
Also agent automatically sends video of entire spec execution to Zebrunner for every failed test.
You may find it attached to appropriate test results page.

### Logging
By default logging is disabled.
To enable logging of agent output data to file you need to add next parameter in reporterOptions of your cypress.config:
```"reportingLoggingEnabled": true```
Also that's possible to choose level of logging. By default it's 'info'.
But you can choose out of 'debug', 'info', 'warn' and 'error'.
To set level you need to add next parameter in reporterOptions of your cypress.config:
```"reportingLoggingLevel": "debug"```
So entire configuration could look like:
```js
  "reporter": "@zebrunner/javascript-agent-cypress",
  "reporterOptions": {
    ...
    "reportingLoggingEnabled": true,
    "reportingLoggingLevel": "debug"
  }
```
Please note if logging is enabled then .log files will be rotated on daily basis.
Also old files (dated older than 14 days ago) will be cleaned up automatically with new executions of tests.
