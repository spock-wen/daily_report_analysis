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

module.exports = {
  listHtml,
  latestFile,
  latestReportHref,
  wikiIndexHref,
  todaySingapore,
  homePeriodKind,
};
