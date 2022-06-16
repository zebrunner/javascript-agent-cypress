const glob = require('glob');
const fs = require('fs');
const path = require('path');
const minimatch = require('minimatch');
const { DEFAULT_SPEC_CONFIG } = require('./constants');

const getObjectAsString = (obj) => {
  return JSON.stringify(obj, null, 2)
}

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const getFailedScreenshot = (screenshotFileBaseName, retries) => {
  console.log('----- getFailedScreenshot -----');
  console.log('screenshotFileBaseName: ', screenshotFileBaseName);
  console.log('retries: ', retries);
  return new Promise(resolve => {
    var filesAll = [];
    const testName = screenshotFileBaseName.replace(/[",:,<,>]/g, '');
    console.log('testName: ', testName);
    filesAll = filesAll.concat(glob.sync(`**/${testName} (failed).png`));
    console.log('glob.sync(`**/${testName} (failed).png`): ', glob.sync(`**/${testName} (failed).png`));
    console.log('filesAll before cycle: ', filesAll);
    for (var i = 1; i <= retries; i++) {
      filesAll = filesAll.concat(glob.sync(`**/${testName} (failed) (attempt ${i + 1}).png`))
    }
    console.log('filesAll before resolve: ', filesAll);
    resolve(filesAll);
  });
};

const getFilesizeInBytes = (filename) => {
  var stats = fs.statSync(filename);
  var fileSizeInBytes = stats.size;
  return fileSizeInBytes;
}

const writeJsonToFile = (folderName, fileName, obj) => {
  fs.mkdir(folderName, { recursive: true }, (err) => {
    if (err) throw err;
    fs.writeFile(`${folderName}/${fileName}`, JSON.stringify(obj, null, 4), 'utf8', function (err) {
      if (err) {
        console.log("An error occured while writing JSON Object to File.");
        return console.log(err);
      }
      console.log(`JSON file ${fileName} has been saved.`);
    });
  });
}

const getTotalSpecs = ({
  ignoreTestFiles,
  testFiles,
  integrationFolder,
  fixturesFolder,
  supportFile,
}) => {
  const specConfig = Object.assign(
    {},
    DEFAULT_SPEC_CONFIG,
    ignoreTestFiles && { ignoreTestFiles },
    testFiles && { testFiles },
    integrationFolder && { integrationFolder },
    fixturesFolder && { fixturesFolder },
    supportFile && { supportFile },
  );

  const fixturesFolderPath = path.join(specConfig.fixturesFolder, '**', '*');

  const supportFilePath = specConfig.supportFile || [];

  const options = {
    sort: true,
    absolute: true,
    nodir: true,
    cwd: specConfig.integrationFolder,
    ignore: [supportFilePath, fixturesFolderPath],
  };

  const ignorePatterns = [].concat(specConfig.ignoreTestFiles);

  const doesNotMatchAllIgnoredPatterns = (file) =>
    ignorePatterns.every((pattern) => !minimatch(file, pattern, { dot: true, matchBase: true }));

  const testFilesPatterns = [].concat(specConfig.testFiles);

  const globResult = testFilesPatterns.reduce(
    (files, pattern) => files.concat(glob.sync(pattern, options) || []),
    [],
  );

  return globResult.filter(doesNotMatchAllIgnoredPatterns).length;
};

module.exports = {
  getObjectAsString,
  getFailedScreenshot,
  getFilesizeInBytes,
  writeJsonToFile,
  sleep,
  getTotalSpecs
}