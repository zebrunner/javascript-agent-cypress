const { tcmTypes } = require('../constants');
const { isBlankString } = require('../utils');

Cypress.Commands.add('registerBrowser', (browser) => {
  cy.task('zbr_registerBrowser', {
    browser,
  });
});

Cypress.Commands.add('attachZbrTestLabel', (...labels) => {
  cy.task('zbr_attachZbrTestLabel', {
    labels,
  });
});

Cypress.Commands.add('attachZbrLaunchLabel', (...labels) => {
  cy.task('zbr_attachZbrLaunchLabel', {
    labels,
  });
});

Cypress.Commands.add('revertZbrTestRegistration', () => {
  cy.task('zbr_revertTestRegistration');
});

Cypress.Commands.add('attachZbrTestArtifactReference', (name, value) => {
  cy.task('zbr_attachZbrTestArtifactReference', {
    artifactReference: { name, value },
  });
});

Cypress.Commands.add('attachZbrLaunchArtifactReference', (name, value) => {
  cy.task('zbr_attachZbrLaunchArtifactReference', {
    artifactReference: { name, value },
  });
});

Cypress.Commands.add('attachZbrTestArtifact', (pathOrBuffer, name) => {
  cy.task('zbr_attachZbrTestArtifact', {
    artifact: { pathOrBuffer, name },
  });
});

Cypress.Commands.add('attachZbrLaunchArtifact', (pathOrBuffer, name) => {
  cy.task('zbr_attachZbrLaunchArtifact', {
    artifact: { pathOrBuffer, name },
  });
});

Cypress.Commands.add('zebrunnerTestCaseKey', (...testCaseKeys) => {
  testCaseKeys.forEach((testCaseKey) => {
    if (!isBlankString(testCaseKey)) {
      const testCase = {
        tcmType: tcmTypes.ZEBRUNNER,
        testCaseId: testCaseKey,
      };
      cy.task('zbr_zebrunnerTestCase', testCase);
    }
  });
});

Cypress.Commands.add('zebrunnerTestCaseStatus', (testCaseKey, resultStatus) => {
  if (!isBlankString(testCaseKey)) {
    const testCase = {
      tcmType: tcmTypes.ZEBRUNNER,
      testCaseId: testCaseKey,
      resultStatus,
    };
    cy.task('zbr_zebrunnerTestCase', testCase);
  }
});

Cypress.Commands.add('xrayTestCaseKey', (...testCaseKeys) => {
  testCaseKeys.forEach((testCaseKey) => {
    if (!isBlankString(testCaseKey)) {
      const testCase = {
        tcmType: tcmTypes.XRAY,
        testCaseId: testCaseKey,
      };
      cy.task('zbr_zebrunnerTestCase', testCase);
    }
  });
});

Cypress.Commands.add('xrayTestCaseStatus', (testCaseKey, resultStatus) => {
  if (!isBlankString(testCaseKey)) {
    const testCase = {
      tcmType: tcmTypes.XRAY,
      testCaseId: testCaseKey,
      resultStatus,
    };
    cy.task('zbr_zebrunnerTestCase', testCase);
  }
});

Cypress.Commands.add('zephyrTestCaseKey', (...testCaseKeys) => {
  testCaseKeys.forEach((testCaseKey) => {
    if (!isBlankString(testCaseKey)) {
      const testCase = {
        tcmType: tcmTypes.ZEPHYR,
        testCaseId: testCaseKey,
      };
      cy.task('zbr_zebrunnerTestCase', testCase);
    }
  });
});

Cypress.Commands.add('zephyrTestCaseStatus', (testCaseKey, resultStatus) => {
  if (!isBlankString(testCaseKey)) {
    const testCase = {
      tcmType: tcmTypes.ZEPHYR,
      testCaseId: testCaseKey,
      resultStatus,
    };
    cy.task('zbr_zebrunnerTestCase', testCase);
  }
});

Cypress.Commands.add('testRailTestCaseKey', (...testCaseKeys) => {
  testCaseKeys.forEach((testCaseKey) => {
    if (!isBlankString(testCaseKey)) {
      const testCase = {
        tcmType: tcmTypes.TEST_RAIL,
        testCaseId: testCaseKey,
      };
      cy.task('zbr_zebrunnerTestCase', testCase);
    }
  });
});

Cypress.Commands.add('testRailTestCaseStatus', (testCaseKey, resultStatus) => {
  if (!isBlankString(testCaseKey)) {
    const testCase = {
      tcmType: tcmTypes.TEST_RAIL,
      testCaseId: testCaseKey,
      resultStatus,
    };
    cy.task('zbr_zebrunnerTestCase', testCase);
  }
});
