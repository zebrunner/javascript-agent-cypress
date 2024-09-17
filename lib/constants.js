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
  REVERT_TEST_REGISTRATION: 'revertTestRegistration',
  ATTACH_LAUNCH_ARTIFACT_REFERENCE: 'attachLaunchArtifactReference',
  ATTACH_TEST_ARTIFACT_REFERENCE: 'attachTestArtifactReference',
  ATTACH_LAUNCH_ARTIFACT: 'attachLaunchArtifact',
  ATTACH_TEST_ARTIFACT: 'attachTestArtifact',
  ADD_TEST_CASES: 'addTestCases',
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
  testStatuses,
  tcmTypes,
};
