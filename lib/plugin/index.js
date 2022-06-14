const ipc = require('node-ipc');
const { connectToZbrIPC } = require('./../ipc/client');
const { EVENTS } = require('./../ipc/events');

const registerZbrPlugin = (on, config) => {
  console.log('zbr plugin execution was started');

  const ipcConnectionAlias = `zbr-${process.ppid}`

  const connectPromise = connectToZbrIPC(config);

  on('task', {
    zbr_registerBrowser(browser) {
      connectPromise.then(() => {
        ipc.of[ipcConnectionAlias].emit(EVENTS.REG_BROWSER, browser);
      })
      return null;
    },
  });

  on('after:run', async () => {
    // timeout does not allow
    // the process to be completed,
    // this is necessary for
    // processing video artifacts
    await new Promise(resolve => setTimeout(resolve, process.env.ZBR_VIDEO_PROCESSING_TIMEOUT_MS || 15000));
  })

};

module.exports = registerZbrPlugin;