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

const summarySendingPolicies = {
  ALWAYS: 'ALWAYS',
  NEVER: 'NEVER',
  IF_CONTAINS_NON_PASSED: 'IF_CONTAINS_NON_PASSED',
  IF_CONTAINS_UNKNOWN_ISSUES: 'IF_CONTAINS_UNKNOWN_ISSUES'
};

module.exports = {
  platforms,
  workerEvents,
  testStatuses,
  tcmTypes,
  summarySendingPolicies,
};
