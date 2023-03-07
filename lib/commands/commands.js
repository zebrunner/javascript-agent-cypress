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
