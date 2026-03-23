const GitHubScraper = require('../github-scraper');
const logger = require('../../utils/logger');

/**
 * DailyScraper - 每日趋势抓取器
 * 继承 GitHubScraper，专门用于抓取 GitHub 每日趋势数据
 */
class DailyScraper extends GitHubScraper {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.language - 筛选的编程语言（可选）
   */
  constructor(options = {}) {
    super({
      type: 'daily',
      language: options.language,
      name: 'DailyScraper',
      timeout: options.timeout
    });
  }

  /**
   * 获取抓取器类型
   * @returns {string} 类型标识
   */
  getType() {
    return 'daily';
  }

  /**
   * 获取调度 cron 表达式
   * 默认每天早上 8 点执行
   * @returns {string} Cron 表达式
   */
  getSchedule() {
    // Cron 格式：秒 分 时 日 月 星期
    // 每天早上 8:00 执行
    return process.env.DAILY_SCHEDULE || '0 0 8 * * *';
  }

  /**
   * 生成输出文件名
   * 格式：github-trending-daily-YYYY-MM-DD.json
   * @param {Date} date - 日期对象（可选，默认当前日期）
   * @returns {string} 文件名
   */
  getFileName(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const languageSuffix = this.language ? `-${this.language.toLowerCase().replace(/\s+/g, '-')}` : '';
    
    return `github-trending-daily${languageSuffix}-${year}-${month}-${day}.json`;
  }

  /**
   * 获取输出目录
   * @returns {string} 输出目录路径
   */
  getOutputDir() {
    return 'data/daily';
  }

  /**
   * 获取完整输出路径
   * @param {string} baseDir - 基础目录
   * @param {Date} date - 日期对象（可选）
   * @returns {string} 完整路径
   */
  getOutputPath(baseDir = process.cwd(), date = new Date()) {
    const path = require('path');
    return path.join(baseDir, this.getOutputDir(), this.getFileName(date));
  }

  /**
   * 获取抓取器描述信息
   * @returns {Object} 描述信息
   */
  getDescription() {
    return {
      name: this.name,
      type: this.getType(),
      description: 'GitHub 每日趋势抓取器',
      schedule: this.getSchedule(),
      language: this.language || 'all',
      url: this.url
    };
  }
}

module.exports = DailyScraper;
