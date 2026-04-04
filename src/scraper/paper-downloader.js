const logger = require('../utils/logger');

const LATEST_PAPERS_URL = 'https://raw.githubusercontent.com/spock-wen/Daily-HuggingFace-AI-Papers/main/data/latest.json';

/**
 * 下载 Latest.json
 * @returns {Promise<Object>} 包含原始数据和清洗后的数据
 */
async function downloadLatestPapers() {
  logger.info('[paper-downloader] 开始下载 HuggingFace 最新论文数据...');

  try {
    const response = await fetch(LATEST_PAPERS_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
      throw new Error('latest.json 格式错误：期望数组类型');
    }

    const downloadedAt = new Date().toISOString();
    const downloadedDate = new Date().toISOString().split('T')[0];

    const papers = rawData.map(item => ({
      title: item.title,
      paper_url: item.paper_url,
      authors: item.authors || [],
      stars: parseInt(item.stars, 10) || 0,
      details: item.details || {},
      scraped_date: item.scraped_date || downloadedDate
    }));

    const result = {
      raw: rawData,
      papers,
      downloadedAt,
      downloadedDate
    };

    logger.success('[paper-downloader] 成功下载 ' + papers.length + ' 篇论文');
    return result;

  } catch (error) {
    logger.error('[paper-downloader] 下载失败', { error: error.message });
    throw error;
  }
}

/**
 * 保存原始数据到文件
 * @param {Object} data - 下载的数据
 * @param {string} filePath - 文件路径
 */
async function saveRawData(data, filePath) {
  const { writeJson } = require('./fs');
  await writeJson(filePath, data.raw);
  logger.info('[paper-downloader] 原始数据已保存到 ' + filePath);
}

module.exports = {
  downloadLatestPapers,
  saveRawData
};
