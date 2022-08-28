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
const platforms = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'windows',
};

const workerEvents = {
  WORKER_INIT: 'workerInit',
  SET_BROWSER: 'setBrowser',
  PARENT_PROCESS_END: 'parentProcessEnd',
};

const DEFAULT_SPEC_CONFIG = {
  ignoreTestFiles: '*.hot-update.js',
  testFiles: '**/*.*',
  integrationFolder: 'cypress/integration',
  fixturesFolder: 'cypress/fixtures',
  supportFile: 'cypress/support',
};

module.exports = {
  platforms,
  workerEvents,
  DEFAULT_SPEC_CONFIG,
};
