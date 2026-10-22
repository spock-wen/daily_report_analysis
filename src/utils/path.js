/**
 * 统一路径配置模块
 * 提供所有路径相关的辅助函数
 *
 * 注意：DATA_DIR / REPORTS_DIR 等目录在模块加载时求值会在部分流程里固化
 * （generate-sample.js 先 require history→path，之后才设 REPORT_OUT_DIR），
 * 导致 .FAIL.html 落进仓库 reports/。因此这里一律改为「用时读取」环境变量。
 */

const path = require('path');

// 项目根目录（当前文件的上级目录）
const ROOT_DIR = path.join(__dirname, '../..');

// 基础目录：每次调用都重新读环境变量，避免模块加载时被固化
function dataDir() {
  return process.env.REPORT_DATA_DIR
    ? path.resolve(process.env.REPORT_DATA_DIR)
    : path.join(ROOT_DIR, 'data');
}

function reportsDir() {
  return process.env.REPORT_OUT_DIR
    ? path.resolve(process.env.REPORT_OUT_DIR)
    : path.join(ROOT_DIR, 'reports');
}

function briefsDir() {
  return path.join(dataDir(), 'briefs');
}

function insightsDir() {
  return path.join(dataDir(), 'insights');
}

function configDir() {
  return path.join(ROOT_DIR, 'config');
}

function srcDir() {
  return path.join(ROOT_DIR, 'src');
}

// 论文数据目录
function papersDataDir() {
  return path.join(dataDir(), 'papers');
}

function papersDailyDir() {
  return path.join(papersDataDir(), 'daily');
}

function papersInsightsDir() {
  return path.join(papersDataDir(), 'insights');
}

// 日报路径辅助函数
function getDailyBriefPath(date) {
  return path.join(briefsDir(), 'daily', `data-${date}.json`);
}

function getDailyInsightPath(date) {
  return path.join(insightsDir(), 'daily', `insights-${date}.json`);
}

function getDailyReportPath(date) {
  return path.join(reportsDir(), 'daily', `github-ai-trending-${date}.html`);
}

// 周报路径辅助函数
function getWeeklyBriefPath(week) {
  return path.join(briefsDir(), 'weekly', `data-weekly-${week}.json`);
}

function getWeeklyInsightPath(week) {
  return path.join(insightsDir(), 'weekly', `insights-${week}.json`);
}

function getWeeklyReportPath(week) {
  return path.join(reportsDir(), 'weekly', `github-weekly-${week}.html`);
}

// 月报路径辅助函数
function getMonthlyBriefPath(month) {
  return path.join(briefsDir(), 'monthly', `data-month-${month}.json`);
}

function getMonthlyInsightPath(month) {
  return path.join(insightsDir(), 'monthly', `insights-${month}.json`);
}

function getMonthlyReportPath(month) {
  return path.join(reportsDir(), 'monthly', `github-monthly-${month}.html`);
}

// AI 洞察路径辅助函数
function getAIInsightsPath(type, identifier) {
  return path.join(insightsDir(), type, `insights-${identifier}.json`);
}

// 主页路径
function getIndexReportPath() {
  return path.join(reportsDir(), 'index.html');
}

// 论文数据路径辅助函数
function getPaperDataPath(date) {
  return path.join(papersDailyDir(), `papers-${date}.json`);
}

function getPaperLatestPath() {
  return path.join(papersDailyDir(), 'papers-latest.json');
}

function getPaperInsightsPath(date) {
  return path.join(papersInsightsDir(), `papers-${date}.json`);
}

function getPaperReportPath(date) {
  return path.join(reportsDir(), 'papers/daily', `papers-${date}.html`);
}

// 导出所有路径配置
module.exports = {
  // 基础目录
  ROOT_DIR,

  // 惰性目录函数（每次调用重新读环境变量，推荐使用）
  dataDir,
  reportsDir,
  briefsDir,
  insightsDir,
  configDir,
  srcDir,
  papersDataDir,
  papersDailyDir,
  papersInsightsDir,

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
  getPaperDataPath,
  getPaperLatestPath,
  getPaperInsightsPath,
  getPaperReportPath,
};

// 兼容旧用法：DATA_DIR / REPORTS_DIR 等常量改为 getter，用时才求值。
for (const [name, getter] of Object.entries({
  DATA_DIR: dataDir,
  REPORTS_DIR: reportsDir,
  BRIEFS_DIR: briefsDir,
  INSIGHTS_DIR: insightsDir,
  CONFIG_DIR: configDir,
  SRC_DIR: srcDir,
  PAPERS_DATA_DIR: papersDataDir,
  PAPERS_DAILY_DIR: papersDailyDir,
  PAPERS_INSIGHTS_DIR: papersInsightsDir,
})) {
  Object.defineProperty(module.exports, name, { get: getter, enumerable: true });
}
