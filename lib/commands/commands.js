const { tcmTypes } = require('../constants');
const { isBlankString } = require('../utils');

Cypress.Commands.add('registerBrowser', (browser) => {
  cy.task('zbr_registerBrowser', {
    browser,
  });
});

// TODO: don't work correctly, necessary to refactor
// Cypress.Commands.add('attachZbrTestLabel', (...labels) => {
//   cy.task('zbr_attachZbrTestLabel', {
//     labels,
//   });
// });

// Cypress.Commands.add('attachZbrLaunchLabel', (...labels) => {
//   cy.task('zbr_attachZbrLaunchLabel', {
//     labels,
//   });
// });

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
