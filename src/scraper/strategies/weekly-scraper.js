const GitHubScraper = require('../github-scraper');
const logger = require('../../utils/logger');

/**
 * WeeklyScraper - 每周趋势抓取器
 * 继承 GitHubScraper，专门用于抓取 GitHub 每周趋势数据
 */
class WeeklyScraper extends GitHubScraper {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.language - 筛选的编程语言（可选）
   */
  constructor(options = {}) {
    super({
      type: 'weekly',
      language: options.language,
      name: 'WeeklyScraper',
      timeout: options.timeout
    });
  }

  /**
   * 获取抓取器类型
   * @returns {string} 类型标识
   */
  getType() {
    return 'weekly';
  }

  /**
   * 获取调度 cron 表达式
   * 默认每周一早上 9 点执行
   * @returns {string} Cron 表达式
   */
  getSchedule() {
    // Cron 格式：秒 分 时 日 月 星期
    // 每周一 9:00 执行（星期 1 = 周一）
    return process.env.WEEKLY_SCHEDULE || '0 0 9 * * 1';
  }

  /**
   * 生成输出文件名
   * 格式：github-trending-weekly-YYYY-Www.json (ISO 周数)
   * @param {Date} date - 日期对象（可选，默认当前日期）
   * @returns {string} 文件名
   */
  getFileName(date = new Date()) {
    const year = date.getFullYear();
    
    // 计算 ISO 周数
    const weekNumber = this.getISOWeek(date);
    const weekStr = String(weekNumber).padStart(2, '0');
    
    const languageSuffix = this.language ? `-${this.language.toLowerCase().replace(/\s+/g, '-')}` : '';
    
    return `github-trending-weekly${languageSuffix}-${year}-W${weekStr}.json`;
  }

  /**
   * 获取输出目录
   * @returns {string} 输出目录路径
   */
  getOutputDir() {
    return 'data/weekly';
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
      description: 'GitHub 每周趋势抓取器',
      schedule: this.getSchedule(),
      language: this.language || 'all',
      url: this.url
    };
  }

  /**
   * 计算 ISO 周数
   * @param {Date} date - 日期对象
   * @returns {number} ISO 周数
   */
  getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
}

module.exports = WeeklyScraper;
