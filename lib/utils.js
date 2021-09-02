const glob = require('glob');
const fs = require('fs');

const {platfroms} = require('./constants')

function getZebrunnerPlatform() {
    let nodePlatform = process.platform
    return platfroms[nodePlatform]
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function logObject(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

function getObjectAsString(obj) {
  return JSON.stringify(obj, null, 2)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getFailedScreenshot(testTitle) {
    const pattern = `**/*${testTitle.replace(/[",',:,<,>]/g, '')} (failed).png`;
    const files = glob.sync(pattern);
    return files.length ? files[0] : undefined;
};

function getVideoFilePath(specFileName) {
  // console.log(`---SPEC FILE NAME ${specFileName}`)
  const pattern = `**/*${specFileName.split('/')[specFileName.split('/').length - 1]}.mp4`;
  const files = glob.sync(pattern);
  return files.length ? files[0] : undefined;
};

function getFilesizeInBytes(filename) {
  var stats = fs.statSync(filename);
  var fileSizeInBytes = stats.size;
  return fileSizeInBytes;
}

function writeJsonToFile(folderName, fileName, obj) {
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

function logToFile(msg) {
  fs.appendFileSync('cypress/zbr-report/worker.log', `${new Date().toISOString()} - ${msg}\n`)
}

module.exports = {
    getZebrunnerPlatform,
    uuidv4,
    logObject,
    getObjectAsString,
    getFailedScreenshot,
    getVideoFilePath,
    getFilesizeInBytes,
    writeJsonToFile,
    sleep,
    logToFile
}