/** 安全补推与流水线共用的 WeLink 回执判据、报告链接解析。 */

'use strict';

const DEFAULT_REPORT_BASE_URL = 'https://report.wenspock.com';
const SITE_HOST = 'report.wenspock.site';
const COM_HOST = 'report.wenspock.com';
const EXPECTED_WELINK_GROUP_COUNT = 2;

/**
 * 解析报告根地址。默认 .com；若 REPORT_BASE_URL 写成 .site 则改写为 .com。
 * @param {string} [raw]
 * @returns {{ baseUrl: string, rewritten: boolean, source: string, original?: string }}
 */
function resolveReportBaseUrl(raw = process.env.REPORT_BASE_URL) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed || trimmed === '${REPORT_BASE_URL}') {
    return { baseUrl: DEFAULT_REPORT_BASE_URL, rewritten: false, source: 'default' };
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      baseUrl: DEFAULT_REPORT_BASE_URL,
      rewritten: true,
      source: 'invalid',
      originalHost: 'unparseable'
    };
  }

  if (url.protocol !== 'https:') {
    return {
      baseUrl: DEFAULT_REPORT_BASE_URL,
      rewritten: true,
      source: 'invalid-protocol',
      originalHost: url.hostname
    };
  }

  if (url.hostname === SITE_HOST || url.hostname.endsWith('.wenspock.site')) {
    return {
      baseUrl: `https://${COM_HOST}`,
      rewritten: true,
      source: 'env-rewritten-from-site',
      originalHost: url.hostname
    };
  }

  return { baseUrl: url.origin, rewritten: false, source: 'env' };
}

/**
 * @param {'daily'|'weekly'|'monthly'|'papers'} type
 * @param {string} reportId
 * @param {string} [baseUrl]
 */
function buildReportUrl(type, reportId, baseUrl = DEFAULT_REPORT_BASE_URL) {
  const root = String(baseUrl).replace(/\/+$/, '');
  switch (type) {
    case 'daily':
      return `${root}/daily/github-ai-trending-${reportId}.html`;
    case 'weekly':
      return `${root}/weekly/github-weekly-${reportId}.html`;
    case 'monthly':
      return `${root}/monthly/github-monthly-${reportId}.html`;
    case 'papers':
      return `${root}/papers/papers-${reportId}.html`;
    default:
      throw new Error(`未知的报告类型：${type}`);
  }
}

function rewriteSiteUrls(text, baseUrl = DEFAULT_REPORT_BASE_URL) {
  if (typeof text !== 'string') return text;
  const root = String(baseUrl).replace(/\/+$/, '');
  return text.replace(/https:\/\/report\.wenspock\.site/g, root);
}

function apiBodyFrom(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const bags = [entry.result, entry, entry.result && entry.result.result];
  for (const bag of bags) {
    if (bag && typeof bag === 'object' && (bag.code !== undefined || bag.errcode !== undefined)) {
      return bag;
    }
  }
  return null;
}

function extractReceiptCode(entry) {
  const body = apiBodyFrom(entry);
  if (!body) return undefined;
  return body.code !== undefined ? body.code : body.errcode;
}

function hasReceipt(entry) {
  return extractReceiptCode(entry) !== undefined;
}

function isSuccessfulGroup(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.success !== true) return false;
  if (!hasReceipt(entry)) return false;
  const code = extractReceiptCode(entry);
  return code === 0 || code === '0';
}

function normalizeWeLinkEntries(results) {
  if (results == null) return [];
  if (Array.isArray(results)) {
    return results.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      if (item.platform === 'feishu') return false;
      return item.platform === 'welink' || item.webhookIndex !== undefined || item.platform == null;
    });
  }
  if (typeof results === 'object') {
    if (Array.isArray(results.welink)) return results.welink;
    if (results.platform === 'feishu') return [];
    if (results.platform === 'welink' || results.skipped || results.error) return [results];
  }
  return [];
}

/**
 * 成功当且仅当期望数量的群都返回成功且带服务端回执（code/errcode）。
 * 不把流水线里的 notificationSent / 结果数组非空当作成功。
 * @param {any} results sendWeLink / sendAll / sendWeeklyAll 的返回值
 * @param {{ expectedGroupCount?: number }} [options]
 */
function evaluateWeLinkReceipts(results, options = {}) {
  const expectedGroupCount = options.expectedGroupCount ?? EXPECTED_WELINK_GROUP_COUNT;
  const entries = normalizeWeLinkEntries(results);
  const groups = entries.map((entry, index) => {
    const code = extractReceiptCode(entry);
    return {
      webhookIndex: entry && entry.webhookIndex != null ? entry.webhookIndex : index,
      success: isSuccessfulGroup(entry),
      hasReceipt: hasReceipt(entry),
      code: code !== undefined ? code : null
    };
  });
  const okCount = groups.filter((group) => group.success && group.hasReceipt).length;

  let reason = null;
  let ok = false;
  if (results == null) {
    reason = '无推送结果';
  } else if (entries.length === 0) {
    reason = '无 WeLink 回执';
  } else if (groups.length !== expectedGroupCount) {
    reason = `群数 ${groups.length}，要求 ${expectedGroupCount}`;
  } else if (okCount !== expectedGroupCount) {
    reason = `成功回执 ${okCount}/${expectedGroupCount}`;
  } else {
    ok = true;
  }

  return {
    ok,
    okCount,
    groupCount: groups.length,
    expectedGroupCount,
    groups,
    reason
  };
}

function evaluatePipelineNotification(notificationResults, options) {
  return evaluateWeLinkReceipts(notificationResults, options);
}

function formatReceiptSummary(verdict) {
  const groups = (verdict.groups || []).map((group) => (
    `群${group.webhookIndex + 1}: success=${group.success}, code=${group.code}, hasReceipt=${group.hasReceipt}`
  ));
  return {
    WELINK_OK: `${verdict.okCount}/${verdict.expectedGroupCount}`,
    ok: verdict.ok,
    reason: verdict.reason,
    groups
  };
}

module.exports = {
  DEFAULT_REPORT_BASE_URL,
  EXPECTED_WELINK_GROUP_COUNT,
  resolveReportBaseUrl,
  buildReportUrl,
  rewriteSiteUrls,
  evaluateWeLinkReceipts,
  evaluatePipelineNotification,
  formatReceiptSummary,
  extractReceiptCode,
  hasReceipt
};
