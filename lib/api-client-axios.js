const axios = require('axios')
const { getObjectAsString } = require('./utils')
const path = require('path')

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

    constructor(configResolver, logger) {
        this.configResolver = configResolver;
        this.logger = logger;
        this.baseUrl = configResolver.getReportingServerHostname();
        // set config defaults when creating the instance
        this.axiosClient = axios.create({
            baseURL: this.baseUrl,
            headers: {}
        });
    }

    callGet(url, headers, disableLog = false) {
        let config = { 
            headers: headers
        }

        var getPromise = this.axiosClient.get(url, config)
        getPromise
        .then(res => {
            this.logger.info(path.basename(__filename), `GET relative url: ${url}`)
            // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
            this.logger.info(path.basename(__filename), `RESPONSE status: ${res.status}`)
            if(!disableLog) {
                this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(res.data)}`)
            }
        })
        .catch(error => {
            this.logger.info(path.basename(__filename), `GET relative url: ${url}`)
            // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
            if(error.response) {
                this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
            } else if(error.data) {
                this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data)
            } else {
                this.logger.error(path.basename(__filename), error)
            }
            // reject(error)
        })
        return getPromise;
    }

    callPost(url, body, headers, disableLog = false) {
        let config = { 
            headers: headers
        }

        var postPromise = this.axiosClient.post(url, body, config)
        postPromise
        .then(res => {
            this.logger.info(path.basename(__filename), `POST relative url: ${url}`)
            // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
            if(!disableLog) {
                this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`)
            }
            this.logger.info(path.basename(__filename), `RESPONSE status: ${res.status}`)
            if(!disableLog) {
                this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(res.data)}`)
            }
        })
        .catch(error => {
            this.logger.info(path.basename(__filename), `POST relative url: ${url}`)
            // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
            if(!disableLog) {
                this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`)
            }
            if(error.response) {
                this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
            } else if(error.data) {
                this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data)
            } else {
                this.logger.error(path.basename(__filename), error)
            }
            // reject(error)
        })
        return postPromise;
    }

    callPut(url, body, headers, disableLog = false) {
        let config = { 
            headers: headers
        }

        var putPromise = this.axiosClient.put(url, body, config)
        putPromise
        .then(res => {
            this.logger.info(path.basename(__filename), `PUT relative URL: ${url}`)
            // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
            if(!disableLog) {
                this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`)
            }
            this.logger.info(path.basename(__filename), `RESPONSE status: ${res.status}`)
            if(!disableLog) {
                this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(res.data)}`)
            }
        })
        .catch(error => {
            this.logger.info(path.basename(__filename), `PUT relative url: ${url}`)
            // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
            if(!disableLog) {
                this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`)
            }
            if(error.response) {
                this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
            } else if(error.data) {
                this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data)
            } else {
                this.logger.error(path.basename(__filename), console.error(error))
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