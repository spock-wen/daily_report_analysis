/**
 * Wiki B trending raw 加载器
 * - 日：{base}/raw/trending/YYYY-MM-DD.json
 * - 周：{base}/raw/trending-weekly/{week_start周一 YYYY-MM-DD}.json
 * - 月：{base}/raw/trending-monthly/{YYYY-MM}.json
 * 映射为报告站 scrape 内部形状。
 * 缺失 / 空 / 不可解析：抛错；禁止回落 HTML 自采。
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

const DEFAULT_WIKI_BASE = '/srv/www/github-trending-wiki';

const PERIOD_DIRS = {
  daily: 'trending',
  weekly: 'trending-weekly',
  monthly: 'trending-monthly'
};

/**
 * @returns {string} wiki 根路径（可用 env 覆盖，便于本地测）
 */
function getWikiTrendingBase() {
  return (
    process.env.WIKI_TRENDING_BASE ||
    process.env.GITHUB_TRENDING_WIKI_BASE ||
    DEFAULT_WIKI_BASE
  );
}

/**
 * @param {string} period
 * @returns {string}
 */
function normalizePeriod(period) {
  const p = String(period || 'daily').toLowerCase();
  if (!PERIOD_DIRS[p]) {
    throw new Error(`wiki trending raw 不支持的 period：${period}`);
  }
  return p;
}

/**
 * @param {string|Date} [date]
 * @returns {string} YYYY-MM-DD（默认本机本地日，box 已为 Asia/Singapore）
 */
function resolveDate(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = date instanceof Date ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 解析为该周周一 YYYY-MM-DD（本地时区）。
 * @param {string|Date} [date]
 * @returns {string}
 */
function resolveWeekStartMonday(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T12:00:00`);
    const day = d.getDay(); // 0=Sun … 6=Sat
    const offset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + offset);
    return resolveDate(d);
  }
  const d = date instanceof Date ? new Date(date.getTime()) : new Date();
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return resolveDate(d);
}

/**
 * @param {string|Date} [date]
 * @returns {string} YYYY-MM
 */
function resolveMonthKey(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}$/.test(date)) {
    return date;
  }
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date.slice(0, 7);
  }
  const d = date instanceof Date ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * 按 period 解析 raw 文件名键。
 * @param {string} period
 * @param {string|Date} [date]
 * @returns {string}
 */
function resolvePeriodKey(period, date) {
  const p = normalizePeriod(period);
  if (p === 'weekly') return resolveWeekStartMonday(date);
  if (p === 'monthly') return resolveMonthKey(date);
  return resolveDate(date);
}

/**
 * @param {string} base
 * @param {string} key 文件名键（无 .json）
 * @param {string} [period='daily']
 * @returns {string}
 */
function rawFilePath(base, key, period = 'daily') {
  const p = normalizePeriod(period);
  return path.join(base, 'raw', PERIOD_DIRS[p], `${key}.json`);
}

/**
 * 将 wiki raw 单项目映射为 scrape 内部 repo 形状。
 * forks / topics 不编造，留给后续 API 富化。
 * 日：stars_today → todayStars；周/月：stars_this_period → todayStars。
 * @param {Object} project
 * @param {string} [period='daily']
 * @returns {Object}
 */
function mapWikiProject(project, period = 'daily') {
  const fullName = String(project.repo || '').trim();
  if (!fullName || !fullName.includes('/')) {
    throw new Error(`wiki raw 项目 repo 无效：${JSON.stringify(project && project.repo)}`);
  }
  const [owner, name] = fullName.split('/');
  if (!owner || !name) {
    throw new Error(`wiki raw 项目 repo 无法拆分 owner/name：${fullName}`);
  }

  const p = normalizePeriod(period);
  let periodStars;
  if (p === 'daily') {
    periodStars = Number(project.stars_today) || 0;
  } else {
    // 周/月契约字段 stars_this_period；兼容误写 stars_today
    periodStars = Number(
      project.stars_this_period != null ? project.stars_this_period : project.stars_today
    ) || 0;
  }

  const mapped = {
    fullName,
    owner,
    name,
    description: project.description != null ? String(project.description) : '',
    language: project.language != null ? String(project.language) : '',
    stars: Number(project.total_stars) || 0,
    todayStars: periodStars,
    url: project.url || `https://github.com/${fullName}`
  };

  if (project.rank != null) {
    mapped.rank = Number(project.rank) || project.rank;
  }

  return mapped;
}

/**
 * 将 wiki raw JSON 转为与 GitHubTrendingParser.standardize 对齐的结构。
 * @param {Object} raw
 * @param {string} dateHint
 * @param {string} [period='daily']
 * @returns {Object}
 */
function mapWikiRawToScrapeShape(raw, dateHint, period = 'daily') {
  if (!raw || typeof raw !== 'object') {
    throw new Error('wiki raw 不可解析：顶层非对象');
  }

  const p = normalizePeriod(period);
  const projects = raw.projects;
  if (!Array.isArray(projects)) {
    throw new Error('wiki raw 不可解析：缺少 projects 数组');
  }
  if (projects.length === 0) {
    throw new Error('wiki raw 为空：projects 长度为 0');
  }

  const repositories = projects.map((proj) => mapWikiProject(proj, p));

  let date = dateHint;
  if (p === 'monthly') {
    if (typeof raw.date === 'string' && /^\d{4}-\d{2}$/.test(raw.date)) {
      date = raw.date;
    } else if (typeof raw.month === 'string' && /^\d{4}-\d{2}$/.test(raw.month)) {
      date = raw.month;
    }
  } else if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    date = raw.date;
  } else if (p === 'weekly' && typeof raw.week_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.week_start)) {
    date = raw.week_start;
  }

  let scrapedAt;
  if (typeof raw.scraped_at === 'string' && raw.scraped_at.trim()) {
    const parsed = new Date(raw.scraped_at);
    scrapedAt = Number.isNaN(parsed.getTime())
      ? new Date().toISOString()
      : parsed.toISOString();
  } else {
    scrapedAt = new Date().toISOString();
  }

  const out = {
    success: true,
    count: repositories.length,
    scrapedAt,
    date,
    source: 'wiki-trending-raw',
    language: 'all',
    period: p,
    repositories,
    projects: repositories
  };

  if (p === 'weekly') {
    if (typeof raw.week_start === 'string') out.week_start = raw.week_start;
    if (typeof raw.week_end === 'string') out.week_end = raw.week_end;
  }
  if (p === 'monthly') {
    out.month = (typeof raw.month === 'string' && raw.month) || date;
  }

  return out;
}

/**
 * 读取并映射 wiki B raw。文件缺失/空/坏 JSON → 抛错（调用方不得回落 HTML）。
 * @param {Object} [options]
 * @param {string|Date} [options.date]
 * @param {string} [options.base] wiki 根路径
 * @param {string} [options.period='daily'] daily|weekly|monthly
 * @returns {Promise<Object>} scrape 形状数据
 */
async function loadWikiTrendingRaw(options = {}) {
  const base = options.base || getWikiTrendingBase();
  const period = normalizePeriod(options.period || 'daily');
  const key = resolvePeriodKey(period, options.date);
  const filePath = rawFilePath(base, key, period);

  logger.info(`[WikiTrendingRaw] 读取 ${period} raw`, { base, key, filePath, period });

  if (!fs.existsSync(filePath)) {
    const msg = `wiki trending raw 缺失：${filePath}`;
    logger.error(`[WikiTrendingRaw] ${msg}`);
    const err = new Error(msg);
    err.code = 'WIKI_TRENDING_RAW_MISSING';
    err.filePath = filePath;
    throw err;
  }

  let text;
  try {
    text = await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    const msg = `wiki trending raw 读取失败：${filePath}（${error.message}）`;
    logger.error(`[WikiTrendingRaw] ${msg}`);
    const err = new Error(msg);
    err.code = 'WIKI_TRENDING_RAW_READ';
    err.filePath = filePath;
    err.cause = error;
    throw err;
  }

  if (!text || !String(text).trim()) {
    const msg = `wiki trending raw 为空文件：${filePath}`;
    logger.error(`[WikiTrendingRaw] ${msg}`);
    const err = new Error(msg);
    err.code = 'WIKI_TRENDING_RAW_EMPTY';
    err.filePath = filePath;
    throw err;
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const msg = `wiki trending raw 不可解析（JSON）：${filePath}（${error.message}）`;
    logger.error(`[WikiTrendingRaw] ${msg}`);
    const err = new Error(msg);
    err.code = 'WIKI_TRENDING_RAW_PARSE';
    err.filePath = filePath;
    err.cause = error;
    throw err;
  }

  try {
    const data = mapWikiRawToScrapeShape(raw, key, period);
    logger.success(`[WikiTrendingRaw] ${period} raw 加载完成`, {
      date: data.date,
      count: data.count,
      source: data.source,
      period: data.period
    });
    return data;
  } catch (error) {
    logger.error(`[WikiTrendingRaw] 映射失败：${error.message}`, { filePath });
    error.code = error.code || 'WIKI_TRENDING_RAW_MAP';
    error.filePath = filePath;
    throw error;
  }
}

module.exports = {
  DEFAULT_WIKI_BASE,
  PERIOD_DIRS,
  getWikiTrendingBase,
  normalizePeriod,
  resolveDate,
  resolveWeekStartMonday,
  resolveMonthKey,
  resolvePeriodKey,
  rawFilePath,
  mapWikiProject,
  mapWikiRawToScrapeShape,
  loadWikiTrendingRaw
};
