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
  it('test name', {'owner': '<username>'}, () => {...})
})
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
  it('test name', {'testrailTestCaseId': 'case_id'}, () => {...})
})
```
where `case_id` is related TestRail test case ID.
If you need to pass multiple case IDs at once please follow the next pattern:
```javascript
describe('some spec', () => {
  it('test name', {'testrailTestCaseId': ['case_id_1', 'case_id_2']}, () => {...})
})
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
  it('test name', {'xrayTestKey': 'test_keys'}, () => {...})
})
```
where `test_keys` is list of related Xray cases split by a comma.

### Integration with Zebrunner Test Case Management (TCM)

Zebrunner integrates with Zebrunner Test Case Management (TCM) system and provides the following capabilities:

1. Linking test cases to test executions
2. Previewing linked test cases in Zebrunner
3. Pushing test execution results to the TCM system

If you want to push the execution results to the TCM system, you need to provide additional configuration for the Agent using `reporterOptions` of your `cypress.json` file or environment variables as described below.

| Env var / Reporter config                                                      | Description                                                                                                                                                             |
|--------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS`<br/>`tcm.zebrunner.pushResults`         | Boolean value which specifies if the execution results should be pushed to Zebrunner TCM. The default value is `false`.                                                 |
| `REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME`<br/>`tcm.zebrunner.pushInRealTime` | Boolean value. Specifies whether to push execution results immediately after each test is finished (value `true`) or not (value `false`). The default value is `false`. |
| `REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID`<br/>`tcm.zebrunner.testRunId`            | Numeric id of the target Test Run in Zebrunner TCM. If a value is not provided, no new runs will be created. 

```json
    "reporter": "@zebrunner/javascript-agent-cypress",
    "reporterOptions": {
        "reportingServerHostname": "<YOUR_ZEBRUNNER_SERVER_URL>",
        // ...
        "tcm": {
            "zebrunner": {
              "pushResults": true,
              "pushInRealTime": true,
              "testRunId": 18
            }
        }
    }
```

The Agent comes with following custom commands:

- `cy.zebrunnerTestCaseKey(...testCaseKeys)` — accepts a list of test cases which should be linked to the current test;
- `cy.zebrunnerTestCaseStatus(testCaseKey, resultStatus)` — links one test case and provides\overrides its result status. This may be useful if the test case result status does not correlate with the test execution status or if you have conditional logic determining the actual result status for the test case.

If these methods are invoked for the same test case id many times within a test method, the last invocation will take precedence. For example, if you invoke the `cy.zebrunnerTestCaseStatus('KEY-1', 'SKIPPED')` first, and then invoke the `cy.zebrunnerTestCaseKey('KEY-1')`, then the result status you provided in the first invocation will be ignored.

```js
describe('some spec', () => {

  it('test name', () => {
    cy.zebrunnerTestCaseKey('KEY-1', 'KEY-2', 'KEY-3');
    if (someCondition) {
      // overriddes the status of the test case when results are pushed to the Zebrunner TCM.
      // using this method, you can manually specify the desired result status. 
      cy.zebrunnerTestCaseStatus('KEY-2', 'FAILED');
    }
  })
})
```

#### Custom Result Statuses

By default, when the execution results are being pushed to a TCM system, Zebrunner maps each test execution result to an appropriate result status in the target TCM system. Most of the time this works perfectly, but in some cases Zebrunner is not able to derive the appropriate target result status.

One of the examples of such cases is when a test case result status does not correlate with the test execution status, or when you have conditional logic determining the actual result status for the test case. For such cases, the Agent comes with a special method which sets a specific Result Status to the test case. 

Another example is custom Result Statuses in the target TCM system. In this case, we cannot anticipate the correct status and simply skip the test execution. In order to tackle this, Zebrunner allows you to configure default status for passed and failed test executions (for skipped tests, this is not technically possible).

| Env var / Reporter config                                                | Description                                                                                              |
|--------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `REPORTING_TCM_TEST_CASE_STATUS_ON_PASS`<br/>`tcm.testCaseStatus.onPass` | The default status that will be assigned to passed test executions when they are pushed to a TCM system. |
| `REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL`<br/>`tcm.testCaseStatus.onFail` | The default status that will be assigned to failed test executions when they are pushed to a TCM system. |

```json
    "reporter": "@zebrunner/javascript-agent-cypress",
    "reporterOptions": {
        "reportingServerHostname": "<YOUR_ZEBRUNNER_SERVER_URL>",
        // ...
        "tcm": {
            "testCaseStatus": {
              "onPass": "PASSED",
              "onFail": "FAILED"
            },
            "zebrunner": {
              "pushResults": true,
              "pushInRealTime": true,
              "testRunId": 18
            }
        }
    }
```

When pushing results to a TCM system, Zebrunner derives the Result Status in the following order:

1. Checks the explicitly assigned value (which was assigned using the `cy.zebrunnerTestCaseStatus()` method).
2. Takes the default status provided via configuration for passed and/or failed tests.
3. Uses internal mapping of Zebrunner statuses to the Result Statuses of the target TCM system.

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
