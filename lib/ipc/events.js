const EVENTS = {
  CONFIG: 'config',
  REG_BROWSER: 'browser',

  ATTACH_LAUNCH_LABELS: 'zbr:launch:attachLabels',
  ATTACH_TEST_LABELS: 'zbr:test:attachLabels',

  REVERT_TEST_REGISTRATION: 'zbr:test:revertRegistration',

  ATTACH_TEST_ARTIFACT_REFERENCE: 'zbr:test:attachArtifactReference',
  ATTACH_LAUNCH_ARTIFACT_REFERENCE: 'zbr:launch:attachArtifactReference',

  ATTACH_TEST_ARTIFACT: 'zbr:test:attachArtifact',
  ATTACH_LAUNCH_ARTIFACT: 'zbr:launch:attachArtifact',

  ADD_TEST_CASES: 'zbr:test:addTestCase',
};

module.exports = { EVENTS };
