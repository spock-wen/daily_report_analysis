/**
 * Scraper Module - 抓取器模块统一导出
 * 
 * 提供完整的 GitHub Trending 抓取功能，包括：
 * - 基础抓取器（BaseScraper）
 * - GitHub 专用抓取器（GitHubScraper）
 * - 策略类（Daily/Weekly/MonthlyScraper）
 * - 重试处理器（RetryHandler）
 * - 定时任务调度器（ScraperScheduler）
 * - 解析器（GitHubTrendingParser）
 * - 报告流水线（ReportPipeline）
 * - 完整工作流（CompleteWorkflow）
 */

// 基础类
const BaseScraper = require('./base-scraper');
const RetryHandler = require('./retry-handler');
const ScraperScheduler = require('./scheduler');

// GitHub 抓取器
const GitHubScraper = require('./github-scraper');

// 策略类
const DailyScraper = require('./strategies/daily-scraper');
const WeeklyScraper = require('./strategies/weekly-scraper');
const MonthlyScraper = require('./strategies/monthly-scraper');

// 解析器
const GitHubTrendingParser = require('./parsers/github-trending-parser');

// 报告生成模块
const ReportPipeline = require('./report-pipeline');
const { CompleteWorkflow, createWorkflow } = require('./complete-workflow');

/**
 * 创建抓取器工厂函数
 * @param {string} type - 抓取器类型 (daily/weekly/monthly)
 * @param {Object} options - 配置选项
 * @returns {GitHubScraper|DailyScraper|WeeklyScraper|MonthlyScraper} 抓取器实例
 */
function createScraper(type, options = {}) {
  switch (type) {
    case 'daily':
      return new DailyScraper(options);
    case 'weekly':
      return new WeeklyScraper(options);
    case 'monthly':
      return new MonthlyScraper(options);
    default:
      // 返回通用 GitHubScraper
      return new GitHubScraper({ ...options, type });
  }
}

/**
 * 获取所有可用的抓取器类型
 * @returns {Array<string>} 抓取器类型数组
 */
function getAvailableScrapers() {
  return ['daily', 'weekly', 'monthly'];
}

/**
 * 获取抓取器配置信息
 * @param {string} type - 抓取器类型
 * @returns {Object} 配置信息
 */
function getScraperConfig(type) {
  const scraper = createScraper(type);
  
  return {
    type: scraper.getType(),
    name: scraper.name,
    schedule: scraper.getSchedule(),
    url: scraper.url,
    language: scraper.getLanguage() || 'all',
    outputDir: scraper.getOutputDir ? scraper.getOutputDir() : 'data',
    fileName: scraper.getFileName ? scraper.getFileName() : 'unknown'
  };
}

/**
 * 批量创建所有类型的抓取器
 * @param {Object} options - 通用配置选项
 * @returns {Object} 包含所有抓取器的对象
 */
function createAllScrapers(options = {}) {
  return {
    daily: new DailyScraper(options),
    weekly: new WeeklyScraper(options),
    monthly: new MonthlyScraper(options)
  };
}

module.exports = {
  // 基础类
  BaseScraper,
  RetryHandler,
  ScraperScheduler,
  
  // GitHub 抓取器
  GitHubScraper,
  
  // 策略类
  DailyScraper,
  WeeklyScraper,
  MonthlyScraper,
  
  // 解析器
  GitHubTrendingParser,
  
  // 报告生成模块
  ReportPipeline,
  CompleteWorkflow,
  createWorkflow,
  
  // 工厂函数
  createScraper,
  createAllScrapers,
  
  // 辅助函数
  getAvailableScrapers,
  getScraperConfig
};
