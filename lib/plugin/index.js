const ipc = require('node-ipc');
const { connectToZbrIPC } = require('./../ipc/client');
const { writeJsonToFile } = require('./../utils');
const { EVENTS } = require('./../ipc/events');

const registerZbrPlugin = (on, config) => {
  console.log('zbr plugin execution was started');

  connectToZbrIPC(config);

  on('task', {
    zbr_registerBrowser(browser) {
      ipc.of.zbr.emit(EVENTS.REG_BROWSER, browser);
      return null;
    },
  });

  on('after:spec', (spec, results) => {
    writeJsonToFile('zbr-report', `${spec.name.split("/")[spec.name.split("/").length - 1]}-spec-results.json`, results);
  })
};

module.exports = registerZbrPlugin;