
const parseSuiteStartObject = (suite, testFileName) => ({
  id: suite.id,
  type: 'suite',
  title: suite.title.slice(0, 255).toString(),
  startTime: new Date().valueOf(),
  description: suite.description,
  attributes: [],
  codeRef: getCodeRef(suite.titlePath(), testFileName),
  parentId: !suite.root ? suite.parent.id : undefined
});

const parseSuiteEndObject = (suite) => ({
  id: suite.id,
  title: suite.title,
  endTime: new Date().valueOf()
});

const parseTestInfo = (cypressConfig, test, testFileName, status, err) => ({
  id: test.id,
  status: status || (test.state === 'pending' ? testItemStatuses.SKIPPED : test.state),
  title: test.title,
  fullTitle: test.fullTitle(),
  body: test.body,
  _testConfig: test._testConfig,
  codeRef: getCodeRef(test.titlePath(), testFileName),
  parentId: test.parent.id,
  err: (err && err.message) || err || (test.err && test.err.message),
  testFileName,
  uniqueId: Buffer.from(`${test.id}-${test.fullTitle()}`, 'utf-8').toString('base64'),
  videoFilePath: getVideoPath(cypressConfig, testFileName)
});

const getCodeRef = (testItemPath, testFileName) =>
  `${testFileName.replace(/\\/g, '/')}/${testItemPath.join('/')}`;

const getVideoPath = (cypressConfig, testFileName) => {
  if(cypressConfig) {
    var projectRoot = cypressConfig.projectRoot
    var videoEnabled = cypressConfig.video
    var videosFolder = cypressConfig.videosFolder
    var integrationFolder = cypressConfig.integrationFolder
    if(videoEnabled) {
      var absFilePath = `${projectRoot.replace(/\\/g, '/')}/${testFileName}`
      var videoFileRelPath = absFilePath.substring(`${integrationFolder.replace(/\\/g, '/')}`.length + 1)
      return `${videosFolder.replace(/\\/g, '/')}/${videoFileRelPath}.mp4`
    } else {
      return undefined
    }
  }
  else {
    console.log('cypress config undefined hence skipping video pushing')
    return undefined
  }
}

module.exports = {
    parseSuiteStartObject,
    parseSuiteEndObject,
    parseTestInfo
}