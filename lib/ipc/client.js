const ipc = require('node-ipc');
const { EVENTS } = require('./events');

const connectToZbrIPC = (config) => {
  ipc.config.id = 'zbrReporter';
  ipc.config.retry = 200;
  ipc.config.silent = true;
  
  ipc.connectTo('zbr', () => {
    ipc.of.zbr.on('connect', () => {
      console.log("client was connected to zbr reporter's ipc server");
      ipc.of.zbr.emit(EVENTS.CONFIG, config);
    });
    ipc.of.zbr.on('disconnect', () => {
      // console.log("client was disconnected from zbr reporter's ipc server");
    });
  });
};

module.exports = { connectToZbrIPC };