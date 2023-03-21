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
  ATTACH_TEST_LABELS: 'attachTestLabels',
  ATTACH_LAUNCH_LABELS: 'attachLaunchLabels',
  ADD_TEST_CASES: 'addTestCases',
};

const DEFAULT_SPEC_CONFIG = {
  ignoreTestFiles: '*.hot-update.js',
  testFiles: '**/*.*',
  integrationFolder: 'cypress/integration',
  fixturesFolder: 'cypress/fixtures',
  supportFile: 'cypress/support',
};

const testStatuses = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
};

const tcmTypes = {
  ZEBRUNNER: 'ZEBRUNNER',
  TEST_RAIL: 'TEST_RAIL',
  XRAY: 'XRAY',
  ZEPHYR: 'ZEPHYR',
};

module.exports = {
  platforms,
  workerEvents,
  DEFAULT_SPEC_CONFIG,
  testStatuses,
  tcmTypes,
};
