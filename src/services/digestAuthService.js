// digestAuthService.js
const axios = require('axios');
const FormData = require('form-data');

let DigestFetch; // will import dynamically

class DigestAuthService {
  constructor(baseURL, username, password) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.username = username;
    this.password = password;
  }

  // Initialize digest-fetch client dynamically
  async init() {
    if (!DigestFetch) {
      const module = await import('digest-fetch');
      DigestFetch = module.default;
    }
    this.client = new DigestFetch(this.username, this.password, { timeout: process.env.NETWORK_TIMEOUT || 30000 });
  }

  // Helper: full URL
  url(endpoint) {
    return `${this.baseURL}${endpoint}`;
  }

  // Generic request (handles JSON objects or FormData)
  async request(method, endpoint, body = {}, headers = {}) {
    await this.init();

    let requestHeaders = { ...headers };
    let requestBody = body;
    if (body && typeof body.getHeaders === 'function') {
      // ✅ FormData: merge headers
      requestHeaders = { ...requestHeaders, ...body.getHeaders() };
    } else if (body && typeof body === 'object') {
      // ✅ JSON object: stringify & set Content-Type
      requestHeaders = { ...requestHeaders, 'Content-Type': 'application/json' };
      requestBody = JSON.stringify(body);
    }

    try {
      const response = await this.client.fetch(this.url(endpoint), {
        method,
        headers: requestHeaders,
        body: requestBody
      });

      const contentType = response.headers.get('Content-Type') || '';
      let resData;
      if (contentType.includes('application/json')) {
        resData = await response.json();
      } else {
        resData = await response.text();
      }

      return { success: response.ok, status: response.status, data: resData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Convenience methods for JSON endpoints
  get(endpoint, headers = {}) {
    return this.request('GET', endpoint, null, headers);
  }

  post(endpoint, data = {}, headers = {}) {
    return this.request('POST', endpoint, data, headers);
  }

  put(endpoint, data = {}, headers = {}) {
    return this.request('PUT', endpoint, data, headers);
  }

  delete(endpoint, data = {}, headers = {}) {
    return this.request('DELETE', endpoint, data, headers);
  }

  // Convenience methods for FormData (or any raw body)
  rawPost(endpoint, formData, headers = {}) {
    return this.request('POST', endpoint, formData, headers);
  }

  rawPut(endpoint, formData, headers = {}) {
    return this.request('PUT', endpoint, formData, headers);
  }

  rawDelete(endpoint, formData, headers = {}) {
    return this.request('DELETE', endpoint, formData, headers);
  }
}

// Factory function
function createDigestAuthService(device) {
  const port = device.port_http ? `:${device.port_http}` : '';
  const baseURL = `http://${device.address_ip}${port}`;
  return new DigestAuthService(baseURL, device.user, device.password);
}

module.exports = { DigestAuthService, createDigestAuthService };
