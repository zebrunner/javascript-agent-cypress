const glob = require('glob');
const fs = require('fs');
const ZebrunnerApiClient = require('./zebr-api-client.js')

function uploadVideo() {
    var testsMap
    var runId
    var specResults

    fs.readFile('cypress.json', (err, data) => {
        if (err) throw err;

        const cypressConfig = JSON.parse(data);
        const zbrApiClient = new ZebrunnerApiClient(cypressConfig)

        fs.readFile('zbr-report/zbr-results.json', (err, data) => {
            if (err) throw err;
            runId = JSON.parse(data).runId
            testsMap = new Map(JSON.parse(data).testsMap)

            const pattern = 'zbr-report/**-spec-results.json';
            const videoFiles = glob.sync(pattern);
            videoFiles.forEach(file => {
                fs.readFile(file, (err, data) => {
                    if (err) throw err;
                    specResults = JSON.parse(data);
        
                    specResults.tests.forEach(test => {
                        if(test.state === 'failed') {
                            zbrApiClient.sendVideo(specResults.video, runId, testsMap.get(test.testId).zbrSessionId);
                        }
                    });
                });
            })
        });
    });
    
}

uploadVideo()