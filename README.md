# Zebrunner Agent for Cypress

## Steps to install

```
$ npm install @zebrunner/javascript-agent-cypress
```

## How to use

1. Add next configuration into cypress.json
```
    "reporter": "@zebrunner/javascript-agent-cypress",
    "reporterOptions": {
        "reportingServerHostname": "zebrunner_service_url",
        "reportingServerAccessToken": "zebrunner_token",
        "reportingProjectKey": "zebrunner_project",
        "reportingRunEnvironment": "zebrunner_environment"
    }
```
where parameters are:
- zebrunner_service_url - url of Zebrunner service taken from Zebrunner configuration page
- zebrunner_token - access token taken from Zebrunner configuration page
- zebrunner_project (optional) - project key in Zebrunner if used
- zebrunner_environment (optional) - tested environment. if specified will be tracked with test run

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
In order to track test owner include next code into your test's body or in beforeEach() method.
```
cy.setOwner('zebrunner_username')
```
If you specify owner in beforeEach() method make sure you add it as the first line of the method.   
Use same approach for defining owner in test method.   
**Important!** zebrunner_username should be an existing name of the user registered in Zebrunner. If username is missing in system it won't be tracked.   

**Note:** this feature is currently experimental. So sometimes test owner is not getting tracked properly. Stabilization of this feature work is currently in progress    
