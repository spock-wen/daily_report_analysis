/**
 * 统一路径配置模块
 * 提供所有路径相关的辅助函数
 */

const path = require('path');

// 项目根目录（当前文件的上级目录）
const ROOT_DIR = path.join(__dirname, '../..');

// 基础目录
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BRIEFS_DIR = path.join(DATA_DIR, 'briefs');
const INSIGHTS_DIR = path.join(DATA_DIR, 'insights');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// 论文数据目录
const PAPERS_DATA_DIR = path.join(DATA_DIR, 'papers');
const PAPERS_DAILY_DIR = path.join(PAPERS_DATA_DIR, 'daily');
const PAPERS_INSIGHTS_DIR = path.join(PAPERS_DATA_DIR, 'insights');

// 日报路径辅助函数
function getDailyBriefPath(date) {
  return path.join(BRIEFS_DIR, 'daily', `data-${date}.json`);
}

function getDailyInsightPath(date) {
  return path.join(INSIGHTS_DIR, 'daily', `insights-${date}.json`);
}

function getDailyReportPath(date) {
  return path.join(REPORTS_DIR, 'daily', `github-ai-trending-${date}.html`);
}

// 周报路径辅助函数
function getWeeklyBriefPath(week) {
  return path.join(BRIEFS_DIR, 'weekly', `data-weekly-${week}.json`);
}

function getWeeklyInsightPath(week) {
  return path.join(INSIGHTS_DIR, 'weekly', `insights-${week}.json`);
}

function getWeeklyReportPath(week) {
  return path.join(REPORTS_DIR, 'weekly', `github-weekly-${week}.html`);
}

// 月报路径辅助函数
function getMonthlyBriefPath(month) {
  return path.join(BRIEFS_DIR, 'monthly', `data-month-${month}.json`);
}

function getMonthlyInsightPath(month) {
  return path.join(INSIGHTS_DIR, 'monthly', `insights-${month}.json`);
}

function getMonthlyReportPath(month) {
  return path.join(REPORTS_DIR, 'monthly', `github-monthly-${month}.html`);
}

// AI 洞察路径辅助函数
function getAIInsightsPath(type, identifier) {
  return path.join(INSIGHTS_DIR, type, `insights-${identifier}.json`);
}

// 主页路径
function getIndexReportPath() {
  return path.join(REPORTS_DIR, 'index.html');
}

// 论文数据路径辅助函数
function getPaperDataPath(date) {
  return path.join(PAPERS_DAILY_DIR, `papers-${date}.json`);
}

function getPaperLatestPath() {
  return path.join(PAPERS_DAILY_DIR, 'papers-latest.json');
}

function getPaperInsightsPath(date) {
  return path.join(PAPERS_INSIGHTS_DIR, `papers-${date}.json`);
}

function getPaperReportPath(date) {
  return path.join(REPORTS_DIR, 'papers/daily', `papers-${date}.html`);
}

// 导出所有路径配置
module.exports = {
  // 基础目录
  ROOT_DIR,
  DATA_DIR,
  BRIEFS_DIR,
  INSIGHTS_DIR,
  REPORTS_DIR,
  CONFIG_DIR,
  SRC_DIR,
  
  // 日报路径
  getDailyBriefPath,
  getDailyInsightPath,
  getDailyReportPath,
  
  // 周报路径
  getWeeklyBriefPath,
  getWeeklyInsightPath,
  getWeeklyReportPath,
  
  // 月报路径
  getMonthlyBriefPath,
  getMonthlyInsightPath,
  getMonthlyReportPath,
  
  // AI 洞察路径
  getAIInsightsPath,
  
  // 主页路径
  getIndexReportPath,

  // 论文路径
  PAPERS_DATA_DIR,
  PAPERS_DAILY_DIR,
  PAPERS_INSIGHTS_DIR,
  getPaperDataPath,
  getPaperLatestPath,
  getPaperInsightsPath,
  getPaperReportPath,
};
