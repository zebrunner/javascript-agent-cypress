const glob = require('glob');
const fs = require('fs');


function getObjectAsString(obj) {
  return JSON.stringify(obj, null, 2)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getFailedScreenshot(screenshotFileBaseName, retries) {
  return new Promise(resolve => {
    var filesAll = []
    const testName = screenshotFileBaseName.replace(/[",:,<,>]/g, '');
    filesAll = filesAll.concat(glob.sync(`**/${testName} (failed).png`))
    for (var i = 1; i <= retries; i++) {
      filesAll = filesAll.concat(glob.sync(`**/${testName} (failed) (attempt ${i + 1}).png`))
    }
    resolve(filesAll);
  });
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

module.exports = {
  getObjectAsString,
  getFailedScreenshot,
  getFilesizeInBytes,
  writeJsonToFile,
  sleep
}