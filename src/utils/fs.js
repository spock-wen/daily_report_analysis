/**
 * 文件系统工具模块
 * 封装常用的文件操作
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * 确保目录存在，不存在则创建
 * @param {string} dirPath - 目录路径
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    logger.debug(`目录已确保存在：${dirPath}`);
  } catch (error) {
    logger.error(`创建目录失败：${dirPath}`, { error: error.message });
    throw error;
  }
}

/**
 * 读取 JSON 文件
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} JSON 对象
 */
async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logger.error(`读取 JSON 文件失败：${filePath}`, { error: error.message });
    throw error;
  }
}

/**
 * 写入 JSON 文件
 * @param {string} filePath - 文件路径
 * @param {Object} data - 数据对象
 * @param {Object} options - 选项
 */
async function writeJson(filePath, data, options = {}) {
  try {
    const { spaces = 2 } = options;
    await ensureDir(path.dirname(filePath));
    const content = JSON.stringify(data, null, spaces);
    await fs.writeFile(filePath, content, 'utf8');
    logger.debug(`JSON 文件已写入：${filePath}`);
  } catch (error) {
    logger.error(`写入 JSON 文件失败：${filePath}`, { error: error.message });
    throw error;
  }
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取文件
 * @param {string} filePath - 文件路径
 * @param {string} encoding - 编码
 * @returns {Promise<string|Buffer>} 文件内容
 */
async function readFile(filePath, encoding = 'utf8') {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (error) {
    logger.error(`读取文件失败：${filePath}`, { error: error.message });
    throw error;
  }
}

/**
 * 写入文件
 * @param {string} filePath - 文件路径
 * @param {string|Buffer} data - 数据
 * @param {Object} options - 选项
 */
async function writeFile(filePath, data, options = {}) {
  try {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, data, options.encoding || 'utf8');
    logger.debug(`文件已写入：${filePath}`);
  } catch (error) {
    logger.error(`写入文件失败：${filePath}`, { error: error.message });
    throw error;
  }
}

/**
 * 复制文件
 * @param {string} src - 源文件路径
 * @param {string} dest - 目标文件路径
 */
async function copyFile(src, dest) {
  try {
    await ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
    logger.debug(`文件已复制：${src} -> ${dest}`);
  } catch (error) {
    logger.error(`复制文件失败：${src} -> ${dest}`, { error: error.message });
    throw error;
  }
}

/**
 * 删除文件
 * @param {string} filePath - 文件路径
 */
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    logger.debug(`文件已删除：${filePath}`);
  } catch (error) {
    logger.error(`删除文件失败：${filePath}`, { error: error.message });
    throw error;
  }
}

/**
 * 列出目录内容
 * @param {string} dirPath - 目录路径
 * @returns {Promise<string[]>} 文件列表
 */
async function listDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch (error) {
    logger.error(`列出目录失败：${dirPath}`, { error: error.message });
    throw error;
  }
}

/**
 * 写入 HTML 文件
 * @param {string} filePath - 文件路径
 * @param {string} html - HTML 内容
 */
async function writeHtml(filePath, html) {
  try {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, html, 'utf8');
    logger.debug(`HTML 文件已写入：${filePath}`);
  } catch (error) {
    logger.error(`写入 HTML 文件失败：${filePath}`, { error: error.message });
    throw error;
  }
}

module.exports = {
  ensureDir,
  readJson,
  writeJson,
  fileExists,
  readFile,
  writeFile,
  copyFile,
  deleteFile,
  listDir,
  writeHtml,
};
