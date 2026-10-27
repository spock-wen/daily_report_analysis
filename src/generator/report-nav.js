'use strict';

const fs = require('fs');
const nodePath = require('path');
const history = require('../metrics/history');
const paths = require('../utils/path');

function listHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.html')).sort().reverse();
}

function latestFile(subdir, re) {
  const files = listHtml(nodePath.join(paths.REPORTS_DIR, subdir));
  for (const file of files) {
    if (re.test(file)) return file;
  }
  return null;
}

// 读者向周/月链接只认正式 HTML。文件名 *.FAIL.html 不匹配正式名。
// CSS 里的 .fail-banner 规则不算红条（例如 W43 仅有样式）。
const PERIOD_ID = {
  weekly: /^\d{4}-W\d{2}$/,
  monthly: /^\d{4}-\d{2}$/,
};

const PERIOD_FILE_RE = {
  weekly: /^github-weekly-(\d{4}-W\d{2})\.html$/,
  monthly: /^github-monthly-(\d{4}-\d{2})\.html$/,
};

function periodRel(kind, id) {
  if (kind === 'weekly') return `weekly/github-weekly-${id}.html`;
  if (kind === 'monthly') return `monthly/github-monthly-${id}.html`;
  return null;
}

function hasReaderFailChrome(html) {
  return /class="fail-banner"/.test(html) || /内容核查未通过（FAIL）/.test(html);
}

/**
 * 正式 HTML 在盘上且正文没有 FAIL 红条时，返回相对 reports 根的路径；否则 null。
 * 不把 fallback 文件名当成读者链接。
 */
function readerPeriodHref(kind, id) {
  if (!PERIOD_ID[kind] || !PERIOD_ID[kind].test(id)) return null;
  const rel = periodRel(kind, id);
  const abs = nodePath.join(paths.reportsDir(), rel);
  if (!fs.existsSync(abs)) return null;
  const html = fs.readFileSync(abs, 'utf8');
  if (hasReaderFailChrome(html)) return null;
  return rel;
}

/**
 * 从新到旧找第一份可给读者的正式周/月报。
 * @param {'weekly'|'monthly'} kind
 * @param {{ prefix?: string }} [opts] prefix 默认 ''；日报/周报页用 '../'
 * @returns {string|null}
 */
function latestReaderPeriodHref(kind, opts = {}) {
  if (!PERIOD_FILE_RE[kind]) return null;
  const prefix = opts.prefix == null ? '' : opts.prefix;
  const dirName = kind === 'weekly' ? 'weekly' : 'monthly';
  const dir = nodePath.join(paths.reportsDir(), dirName);
  if (!fs.existsSync(dir)) return null;
  const ids = fs.readdirSync(dir)
    .map(name => {
      const match = PERIOD_FILE_RE[kind].exec(name);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort()
    .reverse();
  for (const id of ids) {
    const href = readerPeriodHref(kind, id);
    if (href) return `${prefix}${href}`;
  }
  return null;
}

function latestReaderPeriodId(kind) {
  const href = latestReaderPeriodHref(kind);
  if (!href || !PERIOD_FILE_RE[kind]) return null;
  const match = PERIOD_FILE_RE[kind].exec(nodePath.basename(href));
  return match ? match[1] : null;
}

/**
 * 顶栏/互链：优先报告目录最新具体篇；无文件时回退到已知期次文件名（勿链裸目录）。
 * @param {'daily'|'weekly'|'monthly'} kind
 * @param {{ prefix?: string, fallbackId?: string|null }} [opts]
 *   prefix: 相对前缀，日报/周月页用 '../'，首页用 ''
 */
function latestReportHref(kind, opts = {}) {
  const prefix = opts.prefix == null ? '../' : opts.prefix;
  const fallbackId = opts.fallbackId || null;
  if (kind === 'daily') {
    const file = latestFile('daily', /^github-ai-trending-\d{4}-\d{2}-\d{2}\.html$/);
    if (file) return `${prefix}daily/${file}`;
    if (fallbackId) return `${prefix}daily/github-ai-trending-${fallbackId}.html`;
    return `${prefix}daily/`;
  }
  if (kind === 'weekly') {
    const file = latestFile('weekly', /^github-weekly-\d{4}-W\d{2}\.html$/);
    if (file) return `${prefix}weekly/${file}`;
    if (fallbackId) return `${prefix}weekly/github-weekly-${fallbackId}.html`;
    return `${prefix}weekly/`;
  }
  if (kind === 'monthly') {
    const file = latestFile('monthly', /^github-monthly-\d{4}-\d{2}\.html$/);
    if (file) return `${prefix}monthly/${file}`;
    if (fallbackId) return `${prefix}monthly/github-monthly-${fallbackId}.html`;
    return `${prefix}monthly/`;
  }
  return `${prefix}`;
}

function wikiIndexHref(prefix = '../') {
  return `${prefix}wiki-index.html`;
}

/** Asia/Singapore 日历日 YYYY-MM-DD */
function todaySingapore(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
}

/**
 * 首页卡 kind：相对日历标本周/上周、本月/上月（勿写死本周/本月）。
 * @param {'weekly'|'monthly'} kind
 * @param {string} periodId ISO week 或 YYYY-MM
 * @param {Date} [now]
 */
function homePeriodKind(kind, periodId, now = new Date()) {
  const today = todaySingapore(now);
  if (kind === 'weekly') {
    const current = history.getISOWeekId(today);
    if (!periodId) return '周报';
    if (periodId === current) return '本周 · 周报';
    if (periodId < current) return '上周 · 周报';
    return '下周 · 周报';
  }
  if (kind === 'monthly') {
    const current = today.slice(0, 7);
    if (!periodId) return '月报';
    if (periodId === current) return '本月 · 月报';
    if (periodId < current) return '上月 · 月报';
    return '下月 · 月报';
  }
  return '';
}


/**
 * 四页主导航同一数据源：首页·日报·周报·月报（无 Wiki）。
 * @param {'home'|'daily'|'weekly'|'monthly'} active
 * @param {{ home: string, daily: string, weekly: string, monthly: string }} paths
 */
function buildNav(active, paths) {
  const items = [
    { key: 'home', label: '首页', href: paths.home },
    { key: 'daily', label: '日报', href: paths.daily },
    { key: 'weekly', label: '周报', href: paths.weekly },
    { key: 'monthly', label: '月报', href: paths.monthly },
  ];
  return items.map(item => ({
    ...item,
    cur: item.key === active,
  }));
}

module.exports = {
  listHtml,
  latestFile,
  latestReportHref,
  hasReaderFailChrome,
  readerPeriodHref,
  latestReaderPeriodHref,
  latestReaderPeriodId,
  wikiIndexHref,
  todaySingapore,
  homePeriodKind,
  buildNav,
};
