/**
 * 配置加载工具模块
 * 统一加载和管理配置，支持环境变量替换
 */

require('dotenv').config();

const rawConfig = require('../../config/config.json');

/**
 * 替换配置文件中的环境变量
 * 支持 ${VAR_NAME} 语法
 * @param {any} obj - 要处理的对象
 * @returns {any} 替换后的对象
 */
function replaceEnvVars(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, key) => {
      return process.env[key] || match;
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(item => replaceEnvVars(item));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      result[key] = replaceEnvVars(obj[key]);
    }
    return result;
  }
  return obj;
}

// 缓存处理后的配置
let cachedConfig = null;

/**
 * 获取配置对象
 * @param {boolean} forceReload - 是否强制重新加载
 * @returns {Object} 配置对象
 */
function getConfig(forceReload = false) {
  if (!cachedConfig || forceReload) {
    cachedConfig = replaceEnvVars(rawConfig);
  }
  return cachedConfig;
}

/**
 * 获取环境变量（带默认值）
 * @param {string} key - 环境变量名
 * @param {any} defaultValue - 默认值
 * @returns {any} 环境变量值
 */
function getEnv(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

/**
 * 获取布尔型环境变量
 * @param {string} key - 环境变量名
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean} 布尔值
 */
function getEnvBool(key, defaultValue = false) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * 获取数字型环境变量
 * @param {string} key - 环境变量名
 * @param {number} defaultValue - 默认值
 * @returns {number} 数字值
 */
function getEnvNumber(key, defaultValue = 0) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

module.exports = {
  getConfig,
  getEnv,
  getEnvBool,
  getEnvNumber,
  replaceEnvVars
};
