const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch;
const fs = require('fs');
const path = require('path');
const { fetchWithRetry } = require('./retry');
const { formatDate } = require('./utils');

const CACHE_DIR = path.join(__dirname, '..', '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'trending-cache.json');
const CACHE_TTL = 3600000;

const GITHUB_TRENDING_URL = 'https://github.com/trending';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidCache(cacheData) {
  if (!cacheData || !cacheData.timestamp) return false;
  const now = Date.now();
  return (now - cacheData.timestamp) < CACHE_TTL;
}

function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (isValidCache(cacheData)) {
        console.log('✅ 使用缓存数据');
        return cacheData.html;
      }
    }
  } catch (error) {
    console.warn('⚠️ 读取缓存失败:', error.message);
  }
  return null;
}

function writeCache(html) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cacheData = {
      html: html,
      timestamp: Date.now(),
      url: GITHUB_TRENDING_URL
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
    console.log('💾 已保存缓存');
  } catch (error) {
    console.warn('⚠️ 写入缓存失败:', error.message);
  }
}

function clearCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('🗑️ 已清除缓存');
    }
  } catch (error) {
    console.warn('⚠️ 清除缓存失败:', error.message);
  }
}

async function fetchTrending(maxRetries = 5, since = 'daily') {
  const baseUrl = GITHUB_TRENDING_URL.split('?')[0];
  const url = `${baseUrl}?since=${since}`;
  let lastError = null;

  const retryConfig = {
    maxRetries: maxRetries,
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

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🌐 正在获取 (${attempt}/${maxRetries}): ${url}`);

      const response = await fetchWithRetry(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 30000,
        size: 1024 * 1024,
        retryConfig
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`意外的内容类型：${contentType}`);
      }

      const html = await response.text();

      if (!html || html.length < 1000) {
        throw new Error(`HTML 内容过短：${html.length} 字符`);
      }

      const hasTrendingFeatures = html.includes('Trending repositories') ||
                                 html.includes('trending?since=') ||
                                 html.includes('/trending') ||
                                 (html.includes('repository') && html.includes('stars'));

      if (!hasTrendingFeatures) {
        throw new Error('HTML 内容不包含 GitHub Trending 特征');
      }

      console.log(`✅ 成功获取页面内容，长度：${html.length} 字符`);

      writeCache(html);

      return html;

    } catch (error) {
      lastError = error;
      console.error(`❌ 尝试 ${attempt}/${maxRetries} 失败：${error.message}`);

      if (attempt === maxRetries) {
        console.error('💥 所有重试均失败');
        break;
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error('⚠️ 网络连接错误，可能无法访问 GitHub');
        break;
      }

      console.log(`⏳ 等待 5 分钟后重试...`);
      await sleep(5 * 60 * 1000);
    }
  }

  console.warn('⚠️ 尝试使用缓存数据...');
  const cachedHtml = readCache();
  if (cachedHtml) {
    console.log('✅ 使用缓存数据作为备用');
    return cachedHtml;
  }

  throw new Error(`获取 GitHub Trending 失败：${lastError.message}`);
}

async function fetchTrendingForceRefresh(since = 'daily') {
  clearCache();
  return fetchTrending(5, since);
}

module.exports = {
  fetchTrending,
  fetchTrendingForceRefresh,
  clearCache,
  readCache
};
