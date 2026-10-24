/**
 * Wiki B trending raw 加载器
 * 日榜从 {base}/raw/trending/YYYY-MM-DD.json 读取，映射为报告站 scrape 内部形状。
 * 缺失 / 空 / 不可解析：抛错；禁止回落 HTML 自采。
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const logger = require('../utils/logger');

const DEFAULT_WIKI_BASE = '/srv/www/github-trending-wiki';

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
 * @param {string} base
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
function rawFilePath(base, date) {
  return path.join(base, 'raw', 'trending', `${date}.json`);
}

/**
 * 将 wiki raw 单项目映射为 scrape 内部 repo 形状。
 * forks / topics 不编造，留给后续 API 富化。
 * @param {Object} project
 * @returns {Object}
 */
function mapWikiProject(project) {
  const fullName = String(project.repo || '').trim();
  if (!fullName || !fullName.includes('/')) {
    throw new Error(`wiki raw 项目 repo 无效：${JSON.stringify(project && project.repo)}`);
  }
  const [owner, name] = fullName.split('/');
  if (!owner || !name) {
    throw new Error(`wiki raw 项目 repo 无法拆分 owner/name：${fullName}`);
  }

  const mapped = {
    fullName,
    owner,
    name,
    description: project.description != null ? String(project.description) : '',
    language: project.language != null ? String(project.language) : '',
    stars: Number(project.total_stars) || 0,
    todayStars: Number(project.stars_today) || 0,
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
 * @returns {Object}
 */
function mapWikiRawToScrapeShape(raw, dateHint) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('wiki raw 不可解析：顶层非对象');
  }

  const projects = raw.projects;
  if (!Array.isArray(projects)) {
    throw new Error('wiki raw 不可解析：缺少 projects 数组');
  }
  if (projects.length === 0) {
    throw new Error('wiki raw 为空：projects 长度为 0');
  }

  const repositories = projects.map(mapWikiProject);
  const date = (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date))
    ? raw.date
    : dateHint;

  let scrapedAt;
  if (typeof raw.scraped_at === 'string' && raw.scraped_at.trim()) {
    const parsed = new Date(raw.scraped_at);
    scrapedAt = Number.isNaN(parsed.getTime())
      ? new Date().toISOString()
      : parsed.toISOString();
  } else {
    scrapedAt = new Date().toISOString();
  }

  return {
    success: true,
    count: repositories.length,
    scrapedAt,
    date,
    source: 'wiki-trending-raw',
    language: 'all',
    period: 'daily',
    repositories,
    projects: repositories
  };
}

/**
 * 读取并映射当日 wiki B raw。文件缺失/空/坏 JSON → 抛错（调用方不得回落 HTML）。
 * @param {Object} [options]
 * @param {string|Date} [options.date]
 * @param {string} [options.base] wiki 根路径
 * @returns {Promise<Object>} scrape 形状数据
 */
async function loadWikiTrendingRaw(options = {}) {
  const base = options.base || getWikiTrendingBase();
  const date = resolveDate(options.date);
  const filePath = rawFilePath(base, date);

  logger.info('[WikiTrendingRaw] 读取日榜 raw', { base, date, filePath });

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
    const data = mapWikiRawToScrapeShape(raw, date);
    logger.success('[WikiTrendingRaw] 日榜 raw 加载完成', {
      date: data.date,
      count: data.count,
      source: data.source
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
  getWikiTrendingBase,
  resolveDate,
  rawFilePath,
  mapWikiProject,
  mapWikiRawToScrapeShape,
  loadWikiTrendingRaw
};
