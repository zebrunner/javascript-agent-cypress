const glob = require('glob');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const getObjectAsString = (obj) => JSON.stringify(obj, null, 2);

const getFailedScreenshot = (screenshotFileBaseName, retries) => new Promise((resolve) => {
  let filesAll = [];
  const testName = screenshotFileBaseName.replace(/[":<>|/?]/g, '');
  filesAll = filesAll.concat(glob.sync(`**/${testName} (failed).png`));
  for (let i = 1; i <= retries; i += 1) {
    filesAll = filesAll.concat(glob.sync(`**/${testName} (failed) (attempt ${i + 1}).png`));
  }
  resolve(filesAll);
});

const getNewestFilesFirst = (pathPattern) => glob
  .sync(pathPattern)
  .map((name) => ({ name, ctime: fs.statSync(name).ctime }))
  .sort((a, b) => b.ctime - a.ctime);

const getAbsolutePathByPattern = (pathPattern) => {
  const files = getNewestFilesFirst(pathPattern);

  return files.length ? files[0].name : undefined;
};

const getFullFileNameFromPath = (filePath) => path.parse(filePath).base;

const getFilesizeInBytes = (filename) => {
  const stats = fs.statSync(filename);
  const fileSizeInBytes = stats.size;
  return fileSizeInBytes;
};

const waitForFileExists = async (filePath, currentTime = 0, timeout = 10000, delay = 500) => {
  if (fs.existsSync(filePath)) return true;

  if (currentTime === timeout) return false;

  await new Promise((resolve) => setTimeout(() => resolve(true), delay));

  return waitForFileExists(filePath, currentTime + delay, timeout);
};

const createFile = (filePath, content) => {
  fs.writeFile(filePath, content, 'utf8', (error) => {
    if (error) {
      console.error('An error occured while writing to the file:', error);
    }
  });
};

const writeToFile = (folderName, fileName, content) => {
  if (folderName && folderName !== '') {
    fs.mkdir(folderName, { recursive: true }, (err) => {
      if (err) throw err;
      createFile(`${folderName}/${fileName}`, content);
    });
  } else {
    createFile(fileName, content);
  }
};

const writeJsonToFile = (folderName, fileName, obj) => {
  writeToFile(folderName, fileName, JSON.stringify(obj, null, 4));
};

const mapJsonReplacer = (key, value) => {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: [...value.entries()],
    };
  }

  return value;
};

const mapJsonReviver = (key, value) => {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
};

const executeShell = (shellCommand, description, id) => {
  (0, child_process.exec)(shellCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`[ZEBRUNNER_CYPRESS_AGENT] ${description} error: ${error.message}, code: ${error.code}`);

      return;
    }

    if (stderr) {
      console.error(`[ZEBRUNNER_CYPRESS_AGENT] ${description} stderr: ${stderr}`);

      return;
    }

    console.info(`[ZEBRUNNER_CYPRESS_AGENT] ${description} command was successfully executed, id: ${id}`);
  });
};

const isEmptyObject = (value) => Object.keys(value).length === 0 || Object.values(value).filter((prop) => prop).length === 0;

const isBlankString = (value) => !value || value.trim().length === 0;

module.exports = {
  getObjectAsString,
  getFailedScreenshot,
  getAbsolutePathByPattern,
  getFullFileNameFromPath,
  getFilesizeInBytes,
  waitForFileExists,
  writeToFile,
  writeJsonToFile,
  mapJsonReplacer,
  mapJsonReviver,
  executeShell,
  isEmptyObject,
  isBlankString,
};
