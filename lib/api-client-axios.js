const axios = require('axios')
const getObjectAsString = require('./utils').getObjectAsString

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

    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        // set config defaults when creating the instance
        this.axiosClient = axios.create({
            baseURL: baseUrl,
            headers: {}
        });
    }

    callPost(url, body, headers, log = false) {
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