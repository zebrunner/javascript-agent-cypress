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

class HttpClient {

    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        // set config defaults when creating the instance
        this.axiosClient = axios.create({
            baseURL: baseUrl,
            headers: {}
        });
    }

    callPost(url, body, headers) {
        let config = { 
            headers: headers
        }

        return new Promise((resolve, reject) => {
            this.axiosClient
            .post(url, body, config)
            .then(res => {
                console.log(`POST relative url: ${url}`)
                // console.log(`headers: ${getObjectAsString(headers)}`)
                // console.log(`request body: ${getObjectAsString(body)}`)
                console.log(`RESPONSE status: ${res.status}`)
                // console.log(`response body: ${getObjectAsString(res.data)}`)
                resolve(res)
            })
            .catch(error => {
                console.log(`POST relative url: ${url}`)
                // console.log(`headers: ${getObjectAsString(headers)}`)
                // console.log(`request body: ${getObjectAsString(body)}`)
                console.error(`RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
                console.error((error.data) ? error.data : error.response.data)
                // reject(error)
            })
        })
    }

    callPut(url, body, headers) {
        let config = { 
            headers: headers
        }

        return new Promise((resolve, reject) => {
            this.axiosClient
            .put(url, body, config)
            .then(res => {
                console.log(`PUT relative URL: ${url}`)
                // console.log(`headers: ${getObjectAsString(headers)}`)
                // console.log(`request body: ${getObjectAsString(body)}`)
                console.log(`RESPONSE status: ${res.status}`)
                // console.log(`response body: ${getObjectAsString(res.data)}`)
                resolve(res)
            })
            .catch(error => {
                console.log(`PUT relative url: ${url}`)
                // console.log(`headers: ${getObjectAsString(headers)}`)
                // console.log(`request body: ${getObjectAsString(body)}`)
                console.error(`RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
                console.error((error.data) ? error.data : error.response.data)
                // reject(error)
            })
        })

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
    imageHeaders
}