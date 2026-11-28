/** 只读已有 brief、只发 WeLink 的安全补推入口（不写页、不发飞书）。 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  resolveReportBaseUrl,
  buildReportUrl,
  rewriteSiteUrls,
  evaluateWeLinkReceipts,
  formatReceiptSummary,
  EXPECTED_WELINK_GROUP_COUNT
} = require('./welink-receipts');

function parseArgs(argv) {
  const flags = new Set();
  const positional = [];
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') flags.add('help');
    else if (arg === '--dry-run' || arg === '--dryrun') flags.add('dry-run');
    else if (arg === '--send') flags.add('send');
    else if (arg.startsWith('--')) throw new Error(`未知参数：${arg}`);
    else positional.push(arg);
  }
  if (flags.has('dry-run') && flags.has('send')) {
    throw new Error('不能同时使用 --dry-run 与 --send');
  }
  return {
    help: flags.has('help'),
    send: flags.has('send'),
    dryRun: !flags.has('send'),
    reportType: positional[0],
    reportId: positional[1]
  };
}

function listBriefCandidates(reportType, reportId) {
  switch (reportType) {
    case 'daily':
      return [path.join('data', 'briefs', 'daily', `data-${reportId}.json`)];
    case 'weekly':
      return [path.join('data', 'briefs', 'weekly', `data-weekly-${reportId}.json`)];
    case 'monthly':
      return [
        path.join('data', 'briefs', 'monthly', `data-month-${reportId}.json`),
        path.join('data', 'briefs', 'monthly', `data-monthly-${reportId}.json`)
      ];
    case 'papers':
      return [path.join('data', 'papers', 'daily', `papers-${reportId}.json`)];
    default:
      throw new Error(`未知的报告类型：${reportType}`);
  }
}

function listInsightCandidates(reportType, reportId) {
  if (reportType === 'weekly') {
    return [path.join('data', 'insights', 'weekly', `insights-${reportId}.json`)];
  }
  if (reportType === 'monthly') {
    return [path.join('data', 'insights', 'monthly', `insights-${reportId}.json`)];
  }
  if (reportType === 'daily') {
    return [path.join('data', 'insights', 'daily', `insights-${reportId}.json`)];
  }
  return [];
}

function readJsonIfExists(fsImpl, cwd, relPath) {
  const abs = path.isAbsolute(relPath) ? relPath : path.join(cwd, relPath);
  if (!fsImpl.existsSync(abs)) return { exists: false, path: abs };
  const raw = fsImpl.readFileSync(abs, 'utf8');
  return { exists: true, path: abs, data: JSON.parse(raw) };
}

function loadExistingData(fsImpl, cwd, reportType, reportId) {
  const briefTried = listBriefCandidates(reportType, reportId);
  let brief = null;
  for (const rel of briefTried) {
    const loaded = readJsonIfExists(fsImpl, cwd, rel);
    if (loaded.exists) {
      brief = loaded;
      break;
    }
  }
  if (!brief) {
    throw new Error(`未找到已有 brief：${briefTried.join(' 或 ')}（不重生、不写页）`);
  }

  let insights = null;
  let insightsPath = null;
  for (const rel of listInsightCandidates(reportType, reportId)) {
    const loaded = readJsonIfExists(fsImpl, cwd, rel);
    if (loaded.exists) {
      insights = loaded.data;
      insightsPath = loaded.path;
      break;
    }
  }
  if (!insights && brief.data && brief.data.aiInsights) {
    insights = brief.data.aiInsights;
  }
  return { briefPath: brief.path, insightsPath, data: brief.data, insights };
}

function assertNoSiteUrl(value, label) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text && text.includes('wenspock.site')) {
    throw new Error(`${label} 仍包含写死的 .site 地址`);
  }
}

function protectSender(sender) {
  const forbidden = (name) => async function forbiddenChannel() {
    throw new Error(`${name} 被补推入口禁止调用（只发 WeLink，不发飞书、不走 sendAll）`);
  };
  return {
    generateNotificationContent: sender.generateNotificationContent
      ? sender.generateNotificationContent.bind(sender)
      : undefined,
    sendWeLink: (...args) => sender.sendWeLink(...args),
    sendFeishu: forbidden('sendFeishu'),
    sendAll: forbidden('sendAll'),
    sendWeeklyAll: forbidden('sendWeeklyAll'),
    sendMonthlyAll: forbidden('sendMonthlyAll')
  };
}

function createDefaultSender() {
  const MessageSender = require('./message-sender');
  return new MessageSender();
}

function buildWeLinkOptions({ reportType, reportId, data, insights, baseUrl, sender }) {
  const reportUrl = buildReportUrl(reportType, reportId, baseUrl);
  const typeNames = { daily: '日报', weekly: '周报', monthly: '月报', papers: '论文' };

  let generated = null;
  if (typeof sender.generateNotificationContent === 'function' && reportType !== 'papers') {
    generated = sender.generateNotificationContent(reportType, data, insights);
  }

  const title = (generated && generated.title)
    || `GitHub ${typeNames[reportType] || reportType}报告`;
  const top5 = generated && generated.top5;
  const insight = generated && generated.insight;
  const summary = generated && generated.summary;

  let content;
  if (generated && typeof generated.welink === 'string') {
    content = rewriteSiteUrls(generated.welink, baseUrl);
  }

  const options = {
    type: reportType,
    title,
    reportUrl,
    top5,
    insight,
    summary
  };
  if (content) options.content = content;
  assertNoSiteUrl(options, 'WeLink 消息选项');
  return options;
}

/**
 * @param {object} params
 * @param {string} params.reportType
 * @param {string} params.reportId
 * @param {boolean} [params.send] 默认 false，只干跑
 * @param {string} [params.cwd]
 * @param {typeof fs} [params.fsImpl]
 * @param {NodeJS.ProcessEnv} [params.env]
 * @param {object} [params.sender]
 * @param {Function} [params.createSender]
 */
async function resendWeLinkOnly(params) {
  const {
    reportType,
    reportId,
    send = false,
    cwd = process.cwd(),
    fsImpl = fs,
    env = process.env,
    sender: injectedSender = null,
    createSender = null
  } = params;

  if (!reportType || !reportId) {
    throw new Error('缺少报告类型或标识');
  }

  const resolved = resolveReportBaseUrl(env.REPORT_BASE_URL);
  const baseUrl = resolved.baseUrl;
  const loaded = loadExistingData(fsImpl, cwd, reportType, reportId);

  const sender = protectSender(
    injectedSender || (createSender ? createSender() : createDefaultSender())
  );
  const options = buildWeLinkOptions({
    reportType,
    reportId,
    data: loaded.data,
    insights: loaded.insights,
    baseUrl,
    sender
  });

  const plan = {
    reportType,
    reportId,
    reportUrl: options.reportUrl,
    baseUrl,
    baseUrlSource: resolved.source,
    briefPath: loaded.briefPath,
    dryRun: !send,
    FEISHU_CALLED: 'no',
    WRITE_PAGE: 'no',
    channel: 'welink-only'
  };

  if (!send) {
    return {
      success: true,
      dryRun: true,
      plan,
      options,
      verdict: null,
      FEISHU_CALLED: 'no'
    };
  }

  if (env.REPORT_NO_PUSH === '1' || env.REPORT_NO_PUSH === 'true') {
    throw new Error('REPORT_NO_PUSH 已设置，拒绝真实发送');
  }

  const results = await sender.sendWeLink(options);
  const verdict = evaluateWeLinkReceipts(results, {
    expectedGroupCount: EXPECTED_WELINK_GROUP_COUNT
  });

  return {
    success: verdict.ok,
    dryRun: false,
    plan,
    options,
    verdict,
    summary: formatReceiptSummary(verdict),
    FEISHU_CALLED: 'no'
  };
}

function helpText() {
  return `
安全补推入口（只发 WeLink，不写页，不发飞书）

用法:
  node scripts/resend-push.js <type> <id> [--dry-run|--send]

参数:
  type      报告类型：daily, weekly, monthly, papers
  id        报告标识：
            - daily/papers: YYYY-MM-DD
            - weekly:       YYYY-Www
            - monthly:      YYYY-MM

选项:
  --dry-run  默认。只读已有 brief，构建消息与链接，不调用 WeLink/飞书，不写页
  --send     向配置的 WeLink 群补推；成功以两个群都返回成功且有回执为准
  -h, --help 显示帮助

链接使用 https://report.wenspock.com。若 REPORT_BASE_URL 写成 .site，会被改写为 .com。
成功判据看两个群的 WeLink 回执，不相信流水线里的 notificationSent。
`.trim();
}

module.exports = {
  parseArgs,
  helpText,
  resendWeLinkOnly,
  loadExistingData,
  buildWeLinkOptions,
  protectSender
};
