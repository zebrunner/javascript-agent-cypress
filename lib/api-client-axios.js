const axios = require('axios');
const path = require('path');
const { getObjectAsString } = require('./utils');

const jsonHeaders = {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
};

const imageHeaders = {
  headers: {
    'Content-Type': 'image/png',
  },
};

const multipartDataHeaders = {
  headers: {
    Accept: '*/*',
  },
};

class HttpClient {
  constructor(configResolver, logger) {
    this.configResolver = configResolver;
    this.logger = logger;
    this.baseUrl = configResolver.getReportingServerHostname();
    // set config defaults when creating the instance
    this.axiosClient = axios.create({
      baseURL: this.baseUrl,
      headers: {},
    });
  }

  async callGet(url, headers, disableLog = false) {
    try {
      const config = {
        headers,
      };

      const getPromise = await this.axiosClient.get(url, config);

      this.logger.info(path.basename(__filename), `GET relative url: ${url}`);
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      this.logger.info(path.basename(__filename), `RESPONSE status: ${getPromise.status}`);
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(getPromise.data)}`);
      }

      return getPromise;
    } catch (error) {
      console.log('GET Error', error);
      this.logger.info(path.basename(__filename), `GET relative url: ${url}`);
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (error.response) {
        this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`);
      } else if (error.data) {
        this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data);
      } else {
        this.logger.error(path.basename(__filename), error);
      }
      // reject(error)
    }
  }

  async callPost(url, body, headers, disableLog = false) {
    try {
      const config = {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      };

      const postPromise = await this.axiosClient.post(url, body, config);
      this.logger.info(path.basename(__filename), `POST relative url: ${url}`);
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`);
      }
      this.logger.info(path.basename(__filename), `RESPONSE status: ${postPromise.status}`);
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(postPromise.data)}`);
      }

      return postPromise;
    } catch (error) {
      console.log('POST Error', error);
      this.logger.info(path.basename(__filename), `POST relative url: ${url}`);
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`);
      }
      if (error.response) {
        this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`);
      } else if (error.data) {
        this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data);
      } else {
        this.logger.error(path.basename(__filename), error);
      }
      // reject(error)
    }
  }

  async callPut(url, body, headers, disableLog = false) {
    try {
      const config = {
        headers,
      };
      const putPromise = await this.axiosClient.put(url, body, config);

      this.logger.info(path.basename(__filename), `PUT relative URL: ${url}`);
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`);
      }
      this.logger.info(path.basename(__filename), `RESPONSE status: ${putPromise.status}`);
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(putPromise.data)}`);
      }

      return putPromise;
    } catch (error) {
      console.log('PUT Error', error);
      this.logger.info(path.basename(__filename), `PUT relative url: ${url}`);
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `request body: ${getObjectAsString(body)}`);
      }
      if (error.response) {
        this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`);
      } else if (error.data) {
        this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data);
      } else {
        this.logger.error(path.basename(__filename), console.error(error));
      }
      // reject(error)
    }
  }

  async callDelete(url, headers, disableLog = false) {
    try {
      const config = {
        headers,
      };

      const getPromise = await this.axiosClient.delete(url, config);

      this.logger.info(path.basename(__filename), `DELETE relative url: ${url}`);
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      this.logger.info(path.basename(__filename), `RESPONSE status: ${getPromise.status}`);
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `response body: ${getObjectAsString(getPromise.data)}`);
      }

      return getPromise;
    } catch (error) {
      console.log('DELETE Error', error);
      this.logger.info(path.basename(__filename), `DELETE relative url: ${url}`);
      // this.logger.info(path.basename(__filename), `headers: ${getObjectAsString(headers)}`)
      if (error.response) {
        this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`);
      } else if (error.data) {
        this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data);
      } else {
        this.logger.error(path.basename(__filename), error);
      }
      // reject(error)
    }
  }

  async callPatch(url, body, headers, disableLog = false) {
    try {
      const config = {
        headers,
      };
      const patchPromise = await this.axiosClient.patch(url, body, config);

      this.logger.info(path.basename(__filename), `PATCH relative URL: ${url}`);
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `PATCH request body: ${getObjectAsString(body)}`);
      }
      this.logger.info(path.basename(__filename), `RESPONSE STATUS: ${patchPromise.status}`);
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `RESPONSE body: ${getObjectAsString(patchPromise.data)}`);
      }

      return patchPromise;
    } catch (error) {
      console.log('PATCH Error', error);
      this.logger.info(path.basename(__filename), `PATCH relative URL: ${url}`);
      if (!disableLog) {
        this.logger.debug(path.basename(__filename), `PATCH request body: ${getObjectAsString(body)}`);
      }
      if (error.response) {
        this.logger.error(path.basename(__filename), `RESPONSE ERROR: ${error.response.status} ${error.response.statusText}`);
      } else if (error.data) {
        this.logger.error(path.basename(__filename), (error.data) ? error.data : error.response.data);
      } else {
        this.logger.error(path.basename(__filename), console.error(error));
      }
    }
  }
}

module.exports = {
  HttpClient,
  jsonHeaders,
  imageHeaders,
  multipartDataHeaders,
};
