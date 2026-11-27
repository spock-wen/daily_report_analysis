'use strict';

const { execFile } = require('child_process');
const path = require('path');
const { promisify } = require('util');
const { snapshotEnv, restoreEnv } = require('./isolated-preflight');

const execFileAsync = promisify(execFile);
const ROOT = path.join(__dirname, '../..');

function reportDataFromContent(content) {
  const base = content.reportData && typeof content.reportData === 'object'
    ? { ...content.reportData }
    : {};
  const projects = base.projects || base.repositories || content.projects || [];
  return {
    ...base,
    week: content.isoWeek,
    weekStart: content.isoWeek,
    date: content.isoWeek,
    projects,
    trending_repos: projects,
    aiInsights: content.insights || base.aiInsights || null,
    facts: content.facts || base.facts || null,
  };
}

/**
 * 只渲染字符串，不写盘。正式文件名由 admission 用独占写提交。
 */
function renderFormalWeeklyHtml(content, ctx = {}) {
  const saved = snapshotEnv();
  if (ctx.formalDataDir) process.env.REPORT_DATA_DIR = ctx.formalDataDir;
  if (ctx.formalReportsDir) process.env.REPORT_OUT_DIR = ctx.formalReportsDir;
  process.env.REPORT_NO_WIKI = '1';
  process.env.REPORT_NO_PUSH = '1';
  try {
    const { renderWeeklyV3 } = require('../generator/weekly-v3-view-model');
    return renderWeeklyV3(reportDataFromContent(content));
  } finally {
    restoreEnv(saved);
  }
}

async function updateFormalIndex(ctx) {
  await execFileAsync(process.execPath, [path.join(ROOT, 'scripts', 'generate-index.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      REPORT_DATA_DIR: ctx.formalDataDir,
      REPORT_OUT_DIR: ctx.formalReportsDir,
      REPORT_NO_PUSH: '1',
      REPORT_NO_WIKI: '1',
      WELINK_ENABLED: 'false',
      FEISHU_ENABLED: 'false',
    },
  });
}

async function writeFormalWiki(content) {
  if (process.env.REPORT_NO_WIKI === '1' || process.env.REPORT_NO_WIKI === 'true') {
    return { skipped: true };
  }
  const ReportPipeline = require('../scraper/report-pipeline');
  const pipeline = new ReportPipeline({
    enableAI: false,
    enableHTML: false,
    enableIndex: false,
    enableNotification: false,
    contentCheck: false,
    skipContentRewrite: true,
  });
  const data = reportDataFromContent(content);
  await pipeline.updateProjectWikis(data, content.insights, 'weekly');
  return { skipped: false };
}

async function notifyFormalWeekly(content) {
  if (process.env.REPORT_NO_PUSH === '1' || process.env.REPORT_NO_PUSH === 'true') {
    return { skipped: true };
  }
  const MessageSender = require('../notifier/message-sender');
  const sender = new MessageSender();
  const data = reportDataFromContent(content);
  return sender.sendWeeklyAll(data, content.insights, { platforms: ['feishu', 'welink'] });
}

module.exports = {
  renderFormalWeeklyHtml,
  updateFormalIndex,
  writeFormalWiki,
  notifyFormalWeekly,
  reportDataFromContent,
};
