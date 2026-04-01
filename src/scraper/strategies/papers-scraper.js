const BaseScraper = require('../base-scraper');
const { downloadLatestPapers, saveRawData } = require('../paper-downloader');
const { getPaperDataPath, getPaperLatestPath } = require('../../utils/path');
const { writeJson } = require('../../utils/fs');
const logger = require('../../utils/logger');

/**
 * PapersScraper - HuggingFace 论文抓取器
 * 继承 BaseScraper，专门用于抓取 HuggingFace 最新论文数据
 */
class PapersScraper extends BaseScraper {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.minStars - 最小 Stars 数阈值（默认 10）
   */
  constructor(options = {}) {
    super({
      type: 'paper',
      name: 'PapersScraper',
      timeout: options.timeout
    });
    this.minStars = options.minStars || 10;
  }

  /**
   * 获取抓取器类型
   * @returns {string} 类型标识
   */
  getType() {
    return 'paper';
  }

  /**
   * 获取调度 cron 表达式
   * 默认每天早上 8 点执行
   * @returns {string} Cron 表达式
   */
  getSchedule() {
    return process.env.PAPER_SCHEDULE || '0 0 8 * * *';
  }

  /**
   * 获取输出文件名
   * @param {Date} date - 日期对象
   * @returns {string} 文件名
   */
  getFileName(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `papers-${year}-${month}-${day}.json`;
  }

  /**
   * 获取输出目录
   * @returns {string} 输出目录路径
   */
  getOutputDir() {
    return 'data/papers/daily';
  }

  /**
   * 获取完整输出路径
   * @param {string} baseDir - 基础目录
   * @param {Date} date - 日期对象
   * @returns {string} 完整路径
   */
  getOutputPath(baseDir = process.cwd(), date = new Date()) {
    const path = require('path');
    return path.join(baseDir, this.getOutputDir(), this.getFileName(date));
  }

  /**
   * 执行抓取
   * @param {Object} options - 选项
   * @param {boolean} options.saveToFile - 是否保存到文件
   * @returns {Promise<Object>} 抓取结果
   */
  async execute(options = {}) {
    logger.title('[PapersScraper] 开始抓取 HuggingFace 论文数据');

    // 步骤 1: 下载 latest.json
    const downloaded = await downloadLatestPapers();

    // 步骤 2: 过滤 Stars >= minStars 的论文
    const filteredPapers = downloaded.papers.filter(p => p.stars >= this.minStars);

    // 步骤 3: 保存完整数据（所有论文）
    const fullPath = this.getOutputPath(process.cwd(), new Date(downloaded.downloadedDate));
    await writeJson(fullPath, {
      scrapedAt: downloaded.downloadedAt,
      date: downloaded.downloadedDate,
      papers: downloaded.papers,
      stats: {
        totalCount: downloaded.papers.length,
        filteredCount: filteredPapers.length,
        minStars: this.minStars
      }
    });

    // 步骤 4: 保存 latest.json（原始数据）
    await saveRawData(downloaded, getPaperLatestPath());

    logger.success('[PapersScraper] 抓取完成', {
      total: downloaded.papers.length,
      filtered: filteredPapers.length,
      path: fullPath
    });

    return {
      success: true,
      data: downloaded,
      filteredPapers,
      path: fullPath
    };
  }

  /**
   * 获取抓取器描述
   * @returns {Object} 描述信息
   */
  getDescription() {
    return {
      name: this.name,
      type: this.getType(),
      description: 'HuggingFace 论文抓取器',
      schedule: this.getSchedule(),
      minStars: this.minStars
    };
  }
}

module.exports = PapersScraper;
