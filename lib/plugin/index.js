const ipc = require('node-ipc');
const { connectToZbrIPC } = require('./../ipc/client');
const { EVENTS } = require('./../ipc/events');

const registerZbrPlugin = (on, config) => {
  console.log('zbr plugin execution was started');

  const ipcConnectionAlias = `zbr-${process.ppid}`

  connectToZbrIPC(config);

  on('task', {
    zbr_registerBrowser(browser) {
      ipc.of[ipcConnectionAlias].emit(EVENTS.REG_BROWSER, browser);
      return null;
    },
  });

};

module.exports = registerZbrPlugin;