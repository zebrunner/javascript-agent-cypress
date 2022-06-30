const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const { getVideoDurationInSeconds } = require('get-video-duration')
const fs = require('fs')
const path = require('path');
const Spinnies = require('spinnies');
const { dots } = Spinnies;
const spinnies = new Spinnies({ spinner: dots });

const getSpecName = (suiteFileName) => {
  let lastSlashIndex = String(suiteFileName).lastIndexOf('/')
  return String(suiteFileName).slice(lastSlashIndex + 1, String(suiteFileName).length)
}

const getVideoName = (suiteFileName) => {
  return getSpecName(suiteFileName) + '.mp4'
}

const formatVideoName = (testTitle, suiteFileName) => {
  return testTitle.replace(/[^A-Za-z0-9]/g, '_') + '-' + getSpecName(suiteFileName).replace(/[^A-Za-z0-9]/g, '_') + '.mp4';
}

const ffmpegSplit = (videoFilePath, testStartingTime, testDuration, newSplitedVideoFullPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoFilePath)
      .inputOptions([`-ss ${testStartingTime}ms`])
      .outputOptions([`-t ${testDuration}ms`])
      .output(newSplitedVideoFullPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run()
  })
}

const splitFullVideoIntoParts = async (suiteTestsDurationsMap, logger) => {
  console.log('splitFullVideoIntoParts started.');
  for (let suiteInfo of suiteTestsDurationsMap.entries()) {
    let fullVideoFilePath = `${suiteInfo[0].videoFolder}/${suiteInfo[0].suiteFileName}.mp4`;
    let testsTimeSummary = 0;
    let startFilePath;

    function traverseDir(dir) {
      fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
           traverseDir(fullPath);
         } else {
          if (fullPath.endsWith(`${suiteInfo[0].suiteFileName}.mp4`)) {
            fullVideoFilePath = fullPath;
            startFilePath = fullPath.replace(`${suiteInfo[0].suiteFileName}.mp4`, '');
          }
         }
      });
    }

    if (!fs.existsSync(fullVideoFilePath)) {
      traverseDir(suiteInfo[0].videoFolder); // recursively try to find the full video if it doesn't exist in the current path
    }

    console.log('fullVideoFilePath', fullVideoFilePath);
    if (fs.existsSync(fullVideoFilePath)) {
      spinnies.add(suiteInfo[0].suiteFileName, { text: `Split video started. SuiteFileName: ${suiteInfo[0].suiteFileName}. Video to split path: ${fullVideoFilePath}` });
      logger.info(path.basename(__filename), `split video started`)
      logger.debug(path.basename(__filename), `video to split path: ${fullVideoFilePath}`)
      for (let i = suiteInfo[1].length - 1; i >= 0; i--) {
        await getVideoDurationInSeconds(fullVideoFilePath).then(async (videoDuration) => {
          videoDuration *= 1000; //seconds to milliseconds
          let testDuration = suiteInfo[1][i].duration
          testsTimeSummary += testDuration
          let testStartingTime = videoDuration - testsTimeSummary
          let splitedVideoFilePath = `${startFilePath || suiteInfo[0].videoFolder}/${suiteInfo[0].suiteFileName.substr(0, suiteInfo[0].suiteFileName.lastIndexOf('/'))}/${formatVideoName(suiteInfo[1][i].title, suiteInfo[0].suiteFileName)}`;
          await ffmpegSplit(fullVideoFilePath, testStartingTime, testDuration, splitedVideoFilePath)
            .then(() => {
              spinnies.succeed(suiteInfo[0].suiteFileName, { text: `Video part split completed. Splitted video part path: ${splitedVideoFilePath}` });
              logger.info(path.basename(__filename), `video part split completed`)
              logger.debug(path.basename(__filename), `splitted video part path: ${splitedVideoFilePath}`)
            })
            .catch((error) => {
              spinnies.fail(suiteInfo[0].suiteFileName, { text: `Cant split video. ffmpeg error: ${error}` });
              logger.info(path.basename(__filename), `cant split video. ffmpeg error: ${error}`)
            })
          suiteInfo[1][i].videoFilePath = splitedVideoFilePath
        })
      }
    }
  }
}

module.exports = { splitFullVideoIntoParts }