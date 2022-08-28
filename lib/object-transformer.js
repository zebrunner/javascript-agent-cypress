const getCodeRef = (testItemPath, testFileName) => `${testFileName.replace(/\\/g, '/')}/${testItemPath.join('/')}`;

const parseSuiteStartObject = (suite, testFileName) => ({
  id: suite.id,
  type: 'suite',
  title: suite.title.slice(0, 255).toString(),
  startTime: new Date().valueOf(),
  description: suite.description,
  attributes: [],
  codeRef: getCodeRef(suite.titlePath(), testFileName),
  parentId: !suite.root ? suite.parent.id : undefined,
});

const parseSuiteEndObject = (suite) => ({
  id: suite.id,
  title: suite.title,
  endTime: new Date().valueOf(),
});

const testParse = (suite, arr) => {
  suite.forEach((s) => {
    s.tests.forEach((test) => {
      arr.push({
        title: test.title,
        state: test.state,
        id: test.id,
        uniqueId: Buffer.from(`${s.parent?.file}-${test.id}-${test.fullTitle()}`, 'utf-8').toString('base64'),
        duration: test.wallClockDuration,
      });
    });
    if (s.suites.length > 0) {
      testParse(s.suites, arr);
    }
  });
  return arr;
};

const getScreenshotFileBaseName = (testItemPath) => `${testItemPath.join(' -- ')}`;

const getVideoPath = (cypressConfig, testFileName) => {
  if (cypressConfig) {
    const { projectRoot } = cypressConfig;
    const videoEnabled = cypressConfig.video;
    const { videosFolder } = cypressConfig;
    const { integrationFolder } = cypressConfig;
    if (videoEnabled) {
      const absFilePath = `${projectRoot.replace(/\\/g, '/')}/${testFileName}`;
      const videoFileRelPath = absFilePath.substring(`${integrationFolder.replace(/\\/g, '/')}`.length + 1);
      return `${videosFolder.replace(/\\/g, '/')}/${videoFileRelPath}.mp4`;
    }
    return undefined;
  }
  // console.log('cypress config undefined hence skipping video pushing')
  return undefined;
};

const getRetries = (cypressConfig) => {
  if (cypressConfig) {
    if (cypressConfig.retries) {
      if (cypressConfig.retries.runMode) {
        return cypressConfig.retries.runMode;
      }
      return cypressConfig.retries;
    }
    return undefined;
  }
  // console.log('cypress config undefined hence skipping retries setting')
  return undefined;
};

const parseTestInfo = (cypressConfig, test, testFileName, status, err) => ({
  id: test.id,
  status: status || test.state,
  title: test.title,
  fullTitle: test.fullTitle(),
  body: test.body,
  _testConfig: test._testConfig,
  codeRef: getCodeRef(test.titlePath(), testFileName),
  parentId: test.parent.id,
  err: (err && err.message) || err || (test.err && test.err.message),
  testFileName,
  uniqueId: Buffer.from(`${test.parent?.parent?.file}-${test.id}-${test.fullTitle()}`, 'utf-8').toString('base64'),
  videoFilePath: getVideoPath(cypressConfig, testFileName),
  screenshotFileBaseName: getScreenshotFileBaseName(test.titlePath()),
  retries: getRetries(cypressConfig),
});

module.exports = {
  parseSuiteStartObject,
  parseSuiteEndObject,
  parseTestInfo,
  testParse,
};
