const axios = require('axios')
const { getObjectAsString } = require('./utils')
const path = require('path')

const jsonHeaders = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}

const imageHeaders = {
  headers: {
    'Content-Type': 'image/png'
  }
}

const multipartDataHeaders = {
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

  async callGet(url, headers, disableLog = false) {
    try {
      const config = {
        headers: headers
      }

      const getPromise = await this.axiosClient.get(url, config);

      this.logger.info(path.basename(__filename), `GET relative url: ${url}`)
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      this.logger.info(path.basename(__filename), `RESPONSE status: ${getPromise.status}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(getPromise.data)}`)
      }

      return getPromise
    } catch (error) {
      this.logger.info(path.basename(__filename), `GET relative url: ${url}`)
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (error.response) {
        this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
      } else if (error.data) {
        this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data)
      } else {
        this.logger.error(path.basename(__filename), error)
      }
      // reject(error)
    }
  }

  async callPost(url, body, headers, disableLog = false) {
    try {
      const config = {
        headers: headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }

      const postPromise = await this.axiosClient.post(url, body, config);

      this.logger.info(path.basename(__filename), `POST relative url: ${url}`)
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`)
      }
      this.logger.info(path.basename(__filename), `RESPONSE status: ${postPromise.status}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(postPromise.data)}`)
      }

      return postPromise;
    } catch (error) {
      this.logger.info(path.basename(__filename), `POST relative url: ${url}`)
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`)
      }
      if (error.response) {
        this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
      } else if (error.data) {
        this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data)
      } else {
        this.logger.error(path.basename(__filename), error)
      }
      // reject(error)
    }
  }

  async callPut(url, body, headers, disableLog = false) {
    try {
      const config = {
        headers: headers
      }
      const putPromise = await this.axiosClient.put(url, body, config)

      this.logger.info(path.basename(__filename), `PUT relative URL: ${url}`)
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`)
      }
      this.logger.info(path.basename(__filename), `RESPONSE status: ${putPromise.status}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(putPromise.data)}`)
      }

      return putPromise;
    } catch (error) {
      this.logger.info(path.basename(__filename), `PUT relative url: ${url}`)
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`)
      }
      if (error.response) {
        this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`)
      } else if (error.data) {
        this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data)
      } else {
        this.logger.error(path.basename(__filename), console.error(error))
      }
      // reject(error)
    }
  }
}

module.exports = {
  HttpClient,
  jsonHeaders,
  imageHeaders,
  multipartDataHeaders
}