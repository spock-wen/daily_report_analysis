const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch;

const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelay: 5 * 60 * 1000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EPROTO'
  ],
  retryableStatusCodes: [429, 500, 502, 503, 504],
  nonRetryableStatusCodes: [400, 401, 403, 404, 410]
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error, config) {
  if (config.retryableErrors.includes(error.code)) {
    return true;
  }
  if (error.errno && config.retryableErrors.includes(error.errno)) {
    return true;
  }
  return false;
}

function isRetryableStatus(statusCode, config) {
  return config.retryableStatusCodes.includes(statusCode);
}

function isNonRetryableStatus(statusCode, config) {
  return config.nonRetryableStatusCodes.includes(statusCode);
}

async function fetchWithRetry(url, options = {}) {
  const config = { ...RETRY_CONFIG, ...options.retryConfig };
  let lastError = null;
  let lastResponse = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`🌐 请求中 (${attempt}/${config.maxRetries}): ${url}`);

      const response = await fetch(url, {
        ...options,
        timeout: options.timeout || 30000
      });

      lastResponse = response;

      if (isNonRetryableStatus(response.status, config)) {
        console.log(`⏭️ 永久性错误 (HTTP ${response.status})，不重试`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (isRetryableStatus(response.status, config)) {
        console.log(`⏳ 服务器错误 (HTTP ${response.status})，${config.retryDelay / 1000}s 后重试...`);
        if (attempt < config.maxRetries) {
          await sleep(config.retryDelay);
        }
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;

    } catch (error) {
      lastError = error;

      if (isRetryableError(error, config)) {
        console.log(`⏳ 网络错误 (${error.code || error.message})，${config.retryDelay / 1000}s 后重试...`);
        if (attempt < config.maxRetries) {
          await sleep(config.retryDelay);
        }
        continue;
      }

      console.error(`❌ 不可重试的错误: ${error.message}`);
      throw error;
    }
  }

  throw lastError || new Error('请求失败');
}

module.exports = {
  fetchWithRetry,
  sleep,
  RETRY_CONFIG
};
