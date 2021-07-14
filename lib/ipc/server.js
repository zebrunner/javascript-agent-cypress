const ipc = require('node-ipc');

const startZbrIPC = (subscribeServerEvents, unsubscribeServerEvents) => {
  if (ipc.server) {
    unsubscribeServerEvents(ipc.server);
    subscribeServerEvents(ipc.server);
    return;
  }
  ipc.config.id = 'zbr';
  ipc.config.retry = 200;
  ipc.config.silent = true;

  ipc.serve(() => {
    subscribeServerEvents(ipc.server);
    process.on('exit', () => {
      unsubscribeServerEvents(ipc.server);
      ipc.server.stop();
    });
  });
  ipc.server.start();
  console.log('ipc server was started')
};

module.exports = { startZbrIPC };