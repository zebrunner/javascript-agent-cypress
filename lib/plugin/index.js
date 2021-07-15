const ipc = require('node-ipc');
const { connectToZbrIPC } = require('./../ipc/client');
const { EVENTS } = require('./../ipc/events');

const registerZbrPlugin = (on, config) => {
  console.log('zbr plugin execution was started');

  connectToZbrIPC(config);

  on('task', {
    zbr_setOwner(owner) {
      ipc.of.zbr.emit(EVENTS.SET_OWNER, owner);
      return null;
    },
    zbr_registerBrowser(browser) {
      ipc.of.zbr.emit(EVENTS.REG_BROWSER, browser);
      return null;
    },
  });
};

module.exports = registerZbrPlugin;