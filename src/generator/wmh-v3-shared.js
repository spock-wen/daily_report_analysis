'use strict';

const fs = require('fs');
const nodePath = require('path');
const { buildNav } = require('./report-nav');

const TEMPLATE_DIR = nodePath.join(__dirname, '..', '..', 'templates', 'wmh-v3');
const CSS_PATH = nodePath.join(TEMPLATE_DIR, 'site.css');

const TRACK_MAP = {
  agent: 'Agent / 工具链',
  llm: '模型推理',
  rag: '数据 / 检索',
  data: '数据 / 检索',
  database: '数据 / 检索',
  speech: '语音 / 多模态',
  vision: '视觉 / 多模态',
  code: '开发者体验',
  devtool: '开发者体验',
  devtools: '开发者体验',
  platform: '平台 / 基建',
  infrastructure: '平台 / 基建',
  security: '安全',
  education: '教育',
  browser: '浏览器',
  general: '其他',
  other: '其他',
};

function readCss() {
  return fs.readFileSync(CSS_PATH, 'utf8');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function formatPct(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

function formatPt(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(0)}pt`;
}

function clsDelta(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) === 0) return '';
  return Number(value) > 0 ? 'up' : 'dn';
}

function projectKey(project) {
  return project?.fullName || project?.repo || project?.name || '';
}

function projectBlurb(project) {
  const text = project?.descZh || project?.description || project?.desc || '';
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 72);
}

function trackOf(project) {
  const raw = (project?.analysis?.type || project?.type || project?.category || 'other').toString().toLowerCase();
  return TRACK_MAP[raw] || TRACK_MAP.other;
}

function trackLabelOfType(type) {
  const raw = String(type || 'other').toLowerCase();
  return TRACK_MAP[raw] || TRACK_MAP.other;
}

function oneLiner(theme) {
  if (!theme) return '';
  if (typeof theme === 'string') return theme.trim();
  return String(theme.oneLiner || theme.detailed || '').trim();
}

function detailed(theme) {
  if (!theme) return '';
  if (typeof theme === 'string') return theme.trim();
  return String(theme.detailed || theme.oneLiner || '').trim();
}

function takeTextList(items, limit) {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      return String(item.text || item.point || item.title || item.summary || item.reason || '').trim();
    })
    .filter(Boolean)
    .slice(0, limit);
}

module.exports = {
  TEMPLATE_DIR,
  CSS_PATH,
  TRACK_MAP,
  readCss,
  escapeHtml,
  formatCount,
  formatPct,
  formatPt,
  clsDelta,
  projectKey,
  projectBlurb,
  trackOf,
  trackLabelOfType,
  buildNav,
  oneLiner,
  detailed,
  takeTextList,
};
