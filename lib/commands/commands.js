Cypress.Commands.add('registerBrowser', (browser) => {
  cy.task('zbr_registerBrowser', {
    browser,
  });
});
