const glob = require('glob');
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

const getFilesizeInBytes = (filename) => {
  const stats = fs.statSync(filename);
  const fileSizeInBytes = stats.size;
  return fileSizeInBytes;
};

const writeJsonToFile = (folderName, fileName, obj) => {
  fs.mkdir(folderName, { recursive: true }, (err) => {
    if (err) throw err;
    fs.writeFile(`${folderName}/${fileName}`, JSON.stringify(obj, null, 4), 'utf8', (error) => {
      if (error) {
        console.log('An error occured while writing JSON Object to File.');
        return console.log(error);
      }
      console.log(`JSON file ${fileName} has been saved.`);
    });
  });
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
      console.error(`[ZEBRUNNER_CYPRESS_AGENT] ${description} error: ${error.message}`);

      return;
    }

    if (stderr) {
      console.error(`[ZEBRUNNER_CYPRESS_AGENT] ${description} stderr: ${stderr}`);

      return;
    }

    console.info(`[ZEBRUNNER_CYPRESS_AGENT] ${description} command was successfully executed, id: ${id}`);
  });
};

module.exports = {
  getObjectAsString,
  getFailedScreenshot,
  getFilesizeInBytes,
  writeJsonToFile,
  mapJsonReplacer,
  mapJsonReviver,
  executeShell,
};
