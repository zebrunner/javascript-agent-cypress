const ipc = require('node-ipc');
const { EVENTS } = require('./events');

const connectToZbrIPC = (config) => {
  const ipcConnectionAlias = `zbr-${process.ppid}`;

  ipc.config.id = 'zbrReporter';
  ipc.config.retry = 200;
  ipc.config.silent = true;

  return new Promise((resolve) => {
    ipc.connectTo(ipcConnectionAlias, () => {
      ipc.of[ipcConnectionAlias].on('connect', () => {
        ipc.log(`client was connected to zbr reporter's ipc server with alias '${ipcConnectionAlias}'`);
        ipc.of[ipcConnectionAlias].emit(EVENTS.CONFIG, config);
        ipc.log('config was emitted');
        resolve();
      });
      ipc.of[ipcConnectionAlias].on('disconnect', () => {
        ipc.log("client was disconnected from zbr reporter's ipc server");
      });
    });
  });
};

module.exports = { connectToZbrIPC };
