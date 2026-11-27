/**
 * 周报唯一正式入口。
 *
 * 顺序：当期 raw 完整且周期吻合 → 隔离预检（不写正式 data/HTML/index/wiki，不发通知）
 * → 通过后用同一份内容发布一次。
 * 缺数据、半写、错误周期都不是 PASS。等待有上限，不会常驻轮询。
 *
 *   node scripts/run-weekly-workflow.js
 *   node scripts/run-weekly-workflow.js --no-push
 *   node scripts/run-weekly-workflow.js --week-start 2026-11-02
 *   node scripts/run-weekly-workflow.js --as-of 2026-11-08
 *
 * 退出码：0 已发布或正式页已存在；2 raw 未就绪；3 内容核查失败；
 * 4 已有一次运行；5 预检后 raw 变了；1 其他失败。
 *
 * 默认同步等待 WEEKLY_RAW_WAIT_MS（180000）。这只覆盖采集与报告同一分钟启动的竞态，
 * 不能从周日 10:00 一直等到 12:00。
 */

const path = require('path');
const { runWeeklyAdmission } = require('../src/weekly/admission');
const { runIsolatedWeeklyPreflight } = require('../src/weekly/isolated-preflight');
const { DEFAULT_WIKI_BASE } = require('../src/loader/wiki-trending-raw-loader');
const {
  renderFormalWeeklyHtml,
  updateFormalIndex,
  writeFormalWiki,
  notifyFormalWeekly,
} = require('../src/weekly/formal-publish');
const logger = require('../src/utils/logger');

const NOT_READY = new Set([
  'RAW_MISSING',
  'RAW_EMPTY',
  'RAW_PARTIAL',
  'RAW_INCOMPLETE',
  'RAW_UNSTABLE',
  'RAW_NOT_READY',
  'PERIOD_MISMATCH',
  'WEEK_START_NOT_MONDAY',
  'WEEK_START_INVALID',
]);

function exitCodeFor(result) {
  if (result && result.success) return 0;
  const code = result && result.code;
  if (NOT_READY.has(code)) return 2;
  if (code === 'CONTENT_CHECK_FAILED') return 3;
  if (code === 'ALREADY_RUNNING') return 4;
  if (code === 'INPUT_CHANGED') return 5;
  return 1;
}

function readFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  return argv[index + 1];
}

function buildWeeklyAdmissionArgs(argv, env) {
  const noPush = argv.includes('--no-push') || env.REPORT_NO_PUSH === '1' || env.REPORT_NO_PUSH === 'true';
  const noWiki = env.REPORT_NO_WIKI === '1' || env.REPORT_NO_WIKI === 'true';
  const root = path.join(__dirname, '..');
  return {
    weekStart: readFlag(argv, '--week-start'),
    asOf: readFlag(argv, '--as-of'),
    wikiBase: env.WIKI_TRENDING_BASE || env.GITHUB_TRENDING_WIKI_BASE || DEFAULT_WIKI_BASE,
    formalDataDir: env.REPORT_DATA_DIR ? path.resolve(env.REPORT_DATA_DIR) : path.join(root, 'data'),
    formalReportsDir: env.REPORT_OUT_DIR ? path.resolve(env.REPORT_OUT_DIR) : path.join(root, 'reports'),
    noPush,
    enableNotification: !noPush,
    enableWiki: !noWiki,
    enableIndex: true,
    waitMs: env.WEEKLY_RAW_WAIT_MS != null && env.WEEKLY_RAW_WAIT_MS !== ''
      ? Number(env.WEEKLY_RAW_WAIT_MS)
      : 180000,
    pollMs: env.WEEKLY_RAW_POLL_MS != null && env.WEEKLY_RAW_POLL_MS !== ''
      ? Number(env.WEEKLY_RAW_POLL_MS)
      : 5000,
    settleMs: env.WEEKLY_RAW_SETTLE_MS != null && env.WEEKLY_RAW_SETTLE_MS !== ''
      ? Number(env.WEEKLY_RAW_SETTLE_MS)
      : 2000,
    preflight: (ctx) => runIsolatedWeeklyPreflight(ctx),
    htmlWriter: renderFormalWeeklyHtml,
    indexWriter: updateFormalIndex,
    wikiWriter: writeFormalWiki,
    notify: notifyFormalWeekly,
  };
}

async function runCli(argv, deps = {}) {
  const run = deps.runWeeklyAdmission || runWeeklyAdmission;
  const args = buildWeeklyAdmissionArgs(argv, process.env);
  if (args.noPush) {
    process.env.REPORT_NO_PUSH = '1';
    process.env.WELINK_ENABLED = 'false';
    process.env.FEISHU_ENABLED = 'false';
  }
  logger.info('============================================');
  logger.info('开始执行周报准入');
  if (args.weekStart) logger.info(`指定周期周一：${args.weekStart}`);
  if (args.noPush) logger.info('已禁用推送通知 (--no-push / REPORT_NO_PUSH=1)');
  logger.info('============================================');

  const result = await run(args);
  if (result.success) {
    logger.success(`周报准入结束：${result.code} ${result.htmlPath || ''}`);
  } else {
    logger.error(`周报准入未发布：${result.code || 'FAILED'} ${result.error || ''}`);
  }
  return exitCodeFor(result);
}

if (require.main === module) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  buildWeeklyAdmissionArgs,
  exitCodeFor,
  runCli,
};
