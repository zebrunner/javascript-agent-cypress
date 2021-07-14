const glob = require('glob');

const PLATFORMS = require('./constants').PLATFORMS

function getZebrunnerPlatform() {
    let nodePlatform = process.platform
    return PLATFORMS[nodePlatform]
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
    const pattern = `**/*${testTitle.replace(/[",',:]/g, '')} (failed).png`;
    const files = glob.sync(pattern);
    return files.length ? files[0] : undefined;
};

module.exports = {
    getZebrunnerPlatform,
    uuidv4,
    logObject,
    getObjectAsString,
    getFailedScreenshot,
    sleep
}