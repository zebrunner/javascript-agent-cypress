
/* possible options:
    aix
    darwin
    freebsd
    linux
    openbsd
    sunos
    win32
    android
*/
const platfroms = {
    darwin: 'macos',
    linux: 'linux',
    win32: 'windows'
};

const workerEvents = {
    WORKER_INIT: 'workerInit',
    SET_BROWSER: 'setBrowser',
    PARENT_PROCESS_END: 'parentProcessEnd',
  };

module.exports = {
    platfroms,
    workerEvents
}