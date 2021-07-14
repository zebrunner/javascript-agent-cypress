Cypress.Commands.add('setOwner', (owner) => {
    cy.task('zbr_setOwner', {
      owner
    });
  });

 Cypress.Commands.add('registerBrowser', (browser) => {
    cy.task('zbr_registerBrowser', {
      browser
    });
  });