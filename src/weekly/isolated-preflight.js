'use strict';

const fs = require('fs');
const path = require('path');
const { resetHistoryCache } = require('../metrics/history');

const ENV_KEYS = [
  'REPORT_DATA_DIR',
  'REPORT_OUT_DIR',
  'REPORT_NO_WIKI',
  'REPORT_NO_PUSH',
  'WELINK_ENABLED',
  'FEISHU_ENABLED',
];

function snapshotEnv() {
  const saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;
  }
  return saved;
}

function restoreEnv(saved) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetHistoryCache();
}

function samePath(left, right) {
  if (!left || !right) return false;
  return path.resolve(left) === path.resolve(right);
}

function stageFormalData(formalDataDir, isolatedDataDir) {
  fs.rmSync(isolatedDataDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(isolatedDataDir), { recursive: true });
  if (formalDataDir && fs.existsSync(formalDataDir)) {
    fs.cpSync(formalDataDir, isolatedDataDir, { recursive: true, dereference: true });
    const locks = path.join(isolatedDataDir, '.locks');
    fs.rmSync(locks, { recursive: true, force: true });
  } else {
    fs.mkdirSync(isolatedDataDir, { recursive: true });
  }
}

/**
 * 在临时数据目录跑一次周报流水线。
 * 调用方必须关掉 HTML / 首页 / 通知；这里再次强制这些开关，并复制正式 data 只供读取。
 * 不把结果写回正式目录。
 */
async function runIsolatedWeeklyPreflight(options = {}) {
  const { snapshot, isolatedRoot, formalDataDir, formalReportsDir } = options;
  if (!snapshot || !snapshot.ready || !isolatedRoot) {
    return { pass: false, code: 'PREFLIGHT_NOT_ISOLATED', findings: [] };
  }
  if (samePath(isolatedRoot, formalDataDir) || samePath(isolatedRoot, formalReportsDir)) {
    return { pass: false, code: 'PREFLIGHT_NOT_ISOLATED', findings: [] };
  }

  const isolatedDataDir = path.join(isolatedRoot, 'data');
  const isolatedReportsDir = path.join(isolatedRoot, 'reports');
  const saved = snapshotEnv();
  stageFormalData(formalDataDir, isolatedDataDir);
  fs.mkdirSync(isolatedReportsDir, { recursive: true });
  process.env.REPORT_DATA_DIR = isolatedDataDir;
  process.env.REPORT_OUT_DIR = isolatedReportsDir;
  process.env.REPORT_NO_WIKI = '1';
  process.env.REPORT_NO_PUSH = '1';
  process.env.WELINK_ENABLED = 'false';
  process.env.FEISHU_ENABLED = 'false';

  try {
    const createWorkflow = options.createWorkflow
      || require('../scraper/complete-workflow').createWorkflow;
    const workflow = createWorkflow({
      enableScheduler: false,
      enableAI: true,
      enableHTML: false,
      enableIndex: false,
      enableNotification: false,
      contentCheck: true,
    });
    const data = {
      ...snapshot.mapped,
      weekStart: snapshot.isoWeek,
      __weeklyAdmission: {
        purpose: 'isolated-preflight',
        rawHash: snapshot.hash,
      },
    };
    const result = await workflow.triggerManual('weekly', {
      data,
      weeklyPreflight: true,
    });
    if (!result || result.success !== true) {
      return {
        pass: false,
        code: (result && result.errorCode) || 'CONTENT_CHECK_FAILED',
        findings: (result && result.findings) || [],
        failPaths: (result && result.failPaths) || null,
      };
    }
    return {
      pass: true,
      findings: [],
      content: {
        rawHash: snapshot.hash,
        isoWeek: snapshot.isoWeek,
        weekStart: snapshot.weekStart,
        insights: result.insights || null,
        reportData: result.data || null,
      },
    };
  } finally {
    restoreEnv(saved);
  }
}

module.exports = {
  runIsolatedWeeklyPreflight,
  snapshotEnv,
  restoreEnv,
};
