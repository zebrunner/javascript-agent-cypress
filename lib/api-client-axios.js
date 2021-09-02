const axios = require('axios')
const { getObjectAsString, logToFile } = require('./utils')

jsonHeaders = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
}

imageHeaders = {
    headers: {
        'Content-Type': 'image/png'
    }
}

multipartDataHeaders = {
    headers: {
        'Accept': '*/*'
    }
}

class HttpClient {

    constructor(configResolver) {
        this.configResolver = configResolver;
        this.baseUrl = configResolver.getReportingServerHostname();
        this.debugLogging = configResolver.getDebugLogging()
        // set config defaults when creating the instance
        this.axiosClient = axios.create({
            baseURL: this.baseUrl,
            headers: {}
        });
    }

    callPost(url, body, headers, log = false, forceDisableLog = false) {
        let config = { 
            headers: headers
        }

        var postPromise = this.axiosClient.post(url, body, config)
        postPromise
        .then(res => {
            console.log(`POST relative url: ${url}`)
            // console.log(`headers: ${getObjectAsString(headers)}`)
            if(log) {
                console.log(`request body: ${getObjectAsString(body)}`)
            }
            console.log(`RESPONSE status: ${res.status}`)
            if(log) {
                console.log(`response body: ${getObjectAsString(res.data)}`)
            }
            if(this.debugLogging) {
                logToFile(`POST relative url: ${url}`)
                if(!forceDisableLog)
                    logToFile(`request body: ${getObjectAsString(body)}`)
                logToFile(`RESPONSE status: ${res.status}`)
                if(!forceDisableLog)
                    logToFile(`response body: ${getObjectAsString(res.data)}`)
            }
        })
        .catch(error => {
            console.log(`POST relative url: ${url}`)
            // console.log(`headers: ${getObjectAsString(headers)}`)
            if(log) {
                console.log(`request body: ${getObjectAsString(body)}`)
            }
            if(error.response) {
                console.error(`RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
            } else if(error.data) {
                console.error((error.data) ? error.data : error.response.data)
            } else {
                console.error(error)
            }
            if(this.debugLogging) {
                logToFile(`POST relative url: ${url}`)
                if(!forceDisableLog)
                    logToFile(`request body: ${getObjectAsString(body)}`)
                if(error.response) {
                    logToFile(`RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
                }
            }
            // reject(error)
        })
        return postPromise;
    }

    callPut(url, body, headers, log = false) {
        let config = { 
            headers: headers
        }

        var putPromise = this.axiosClient.put(url, body, config)
        putPromise
        .then(res => {
            console.log(`PUT relative URL: ${url}`)
            // console.log(`headers: ${getObjectAsString(headers)}`)
            if(log) {
                console.log(`request body: ${getObjectAsString(body)}`)
            }
            console.log(`RESPONSE status: ${res.status}`)
            if(log) {
                console.log(`response body: ${getObjectAsString(res.data)}`)
            }

            if(this.debugLogging) {
                logToFile(`PUT relative url: ${url}`)
                if(!forceDisableLog)
                    logToFile(`request body: ${getObjectAsString(body)}`)
                logToFile(`RESPONSE status: ${res.status}`)
                if(!forceDisableLog)
                    logToFile(`response body: ${getObjectAsString(res.data)}`)
            }
        })
        .catch(error => {
            console.log(`PUT relative url: ${url}`)
            // console.log(`headers: ${getObjectAsString(headers)}`)
            if(log) {
                console.log(`request body: ${getObjectAsString(body)}`)
            }
            if(error.response) {
                console.error(`RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
            } else if(error.data) {
                console.error((error.data) ? error.data : error.response.data)
            } else {
                console.error(error)
            }
            if(this.debugLogging) {
                logToFile(`PUT relative url: ${url}`)
                if(!forceDisableLog)
                    logToFile(`request body: ${getObjectAsString(body)}`)
                if(error.response) {
                    logToFile(`RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
                }
            }
            // reject(error)
        })
        return putPromise;
    }

}

// new HttpClient('https://jsonplaceholder.typicode.com/todos/').this.httpClient.callPost("", 
// {
//     todo: 'THAT SHOULD WORK!'
// },
// imageHeaders.headers);

module.exports = {
    HttpClient,
    jsonHeaders,
    imageHeaders,
    multipartDataHeaders
}