'use strict';

const fs = require('fs');
const path = require('path');
const history = require('../metrics/history');
const weeklyMetrics = require('../metrics/weekly-metrics');
const monthlyMetrics = require('../metrics/monthly-metrics');

const weeklyCache = new Map();
const monthlyCache = new Map();

function ensureDataDir(dataDir) {
  if (!dataDir) return history.getDataDir();
  const resolved = path.resolve(dataDir);
  const current = process.env.REPORT_DATA_DIR ? path.resolve(process.env.REPORT_DATA_DIR) : null;
  if (current !== resolved) {
    process.env.REPORT_DATA_DIR = resolved;
    history.resetHistoryCache();
    weeklyCache.clear();
    monthlyCache.clear();
  }
  return resolved;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function defaultRenderMapPath(dataDir, level, period) {
  return path.join(dataDir, 'render', `render_map-${level}-${period}.json`);
}

function defaultFactsPath(dataDir, level, period) {
  return path.join(dataDir, 'facts', `facts-${level}-${period}.json`);
}

function normalizeRenderMap(value) {
  if (!value) return null;
  if (Array.isArray(value)) return { entries: value };
  if (typeof value === 'object' && Array.isArray(value.entries)) return value;
  return null;
}

function resolveRenderMap(options, dataDir, level, period) {
  if (options.renderMap !== undefined && options.renderMap !== null) {
    const normalized = normalizeRenderMap(options.renderMap);
    if (normalized) return normalized;
  }
  const explicit = options.renderMapPath;
  const filePath = explicit ? path.resolve(explicit) : defaultRenderMapPath(dataDir, level, period);
  const data = readJson(filePath);
  if (data) return normalizeRenderMap(data) || { entries: [] };
  if (explicit) throw new Error(`渲染记录不存在或无法解析：${filePath}`);
  return null;
}

function resolveFacts(options, dataDir, level, period) {
  if (options.facts !== undefined && options.facts !== null) return options.facts;
  const explicit = options.factsPath;
  const filePath = explicit ? path.resolve(explicit) : defaultFactsPath(dataDir, level, period);
  const data = readJson(filePath);
  if (data) return data;
  if (explicit) throw new Error(`事实表不存在或无法解析：${filePath}`);
  return null;
}

function readBriefFromDisk(level, period) {
  const base = history.getBriefsDir();
  if (level === 'daily') return readJson(path.join(base, 'daily', `data-${period}.json`));
  if (level === 'weekly') return readJson(path.join(base, 'weekly', `data-weekly-${period}.json`));
  if (level === 'monthly') return readJson(path.join(base, 'monthly', `data-month-${period}.json`));
  return null;
}

function readInsightsFromDisk(level, period) {
  const base = history.getInsightsDir();
  return readJson(path.join(base, level, `insights-${period}.json`));
}

function readDailyInsights(date) {
  return readJson(path.join(history.getInsightsDir(), 'daily', `insights-${date}.json`));
}

function getWeeklyMetrics(period, brief) {
  if (!period) return null;
  if (!weeklyCache.has(period)) {
    const metrics = weeklyMetrics.computeWeeklyMetrics(period, brief ? { brief } : {});
    weeklyCache.set(period, metrics);
  }
  return weeklyCache.get(period);
}

function getMonthlyMetrics(period) {
  if (!period) return null;
  if (!monthlyCache.has(period)) {
    monthlyCache.set(period, monthlyMetrics.computeMonthlyMetrics(period));
  }
  return monthlyCache.get(period);
}

function resetCaches() {
  weeklyCache.clear();
  monthlyCache.clear();
}

function normalizeProjects(level, brief, metrics) {
  if (level === 'monthly') {
    const items = metrics?.top || [];
    return items.map(item => ({
      fullName: item.fullName,
      name: item.fullName.split('/')[1] || item.fullName,
      stars: item.lastStars || 0,
      todayStars: item.monthStars || 0,
      monthStars: item.monthStars || 0,
      daysOnList: item.daysOnList || 0,
      isAI: Boolean(item.isAI),
      project: item,
    }));
  }

  const projects = brief?.projects || [];
  return projects.map(project => ({
    fullName: project.fullName || project.repo || project.name,
    name: project.name || String(project.fullName || '').split('/')[1] || '',
    stars: Number(project.stars) || 0,
    todayStars: Number(project.todayStars) || 0,
    isAI: Boolean(project.isAI),
    project,
  }));
}

function buildContext(options = {}) {
  const level = options.level;
  const period = options.period;
  const dataDir = ensureDataDir(options.dataDir);
  const brief = options.brief !== undefined ? options.brief : readBriefFromDisk(level, period);
  const insights = options.insights !== undefined ? options.insights : readInsightsFromDisk(level, period);
  const rawRenderMap = options.renderMap !== undefined
    ? options.renderMap
    : resolveRenderMap(options, dataDir, level, period);
  const renderMap = rawRenderMap ? (normalizeRenderMap(rawRenderMap) || { entries: [] }) : null;
  const facts = options.facts !== undefined ? options.facts : resolveFacts(options, dataDir, level, period);
  const r3 = Boolean(options.r3 || renderMap || facts);

  const metrics = level === 'weekly'
    ? getWeeklyMetrics(period, brief)
    : level === 'monthly'
      ? getMonthlyMetrics(period)
      : null;

  const projects = normalizeProjects(level, brief, metrics);
  const projectMap = new Map();
  const fullNames = new Set();
  for (const project of projects) {
    if (!project.fullName) continue;
    projectMap.set(project.fullName, project);
    fullNames.add(project.fullName);
  }

  const daysOnList = new Map();
  if (level === 'monthly' && metrics?.top) {
    for (const item of metrics.top) daysOnList.set(item.fullName, item.daysOnList);
  }

  // 周报 D2 允许名单 = 周榜 fullName ∪ 当周日报 fullName（与 B3 一致）
  const allowedFullNames = new Set(fullNames);
  if (level === 'weekly' && period) {
    for (const date of history.getISOWeekDates(period)) {
      const dailyBrief = history.readDailyBrief(date);
      for (const name of history.getProjectNames(dailyBrief)) {
        allowedFullNames.add(name);
      }
    }
  }

  if (level === 'monthly' && period) {
    const prevMonth = history.getPrevMonth(period);
    if (prevMonth) {
      const prevMetrics = getMonthlyMetrics(prevMonth);
      for (const item of prevMetrics?.top || []) {
        if (item.fullName) allowedFullNames.add(item.fullName);
      }
    }
  }

  return {
    level,
    period,
    dataDir,
    brief,
    insights,
    metrics,
    projects,
    projectMap,
    fullNames,
    allowedFullNames,
    daysOnList,
    r3,
    renderMap,
    facts,
    readDailyInsights,
    getPreviousDailyInsights(date, count = 1) {
      const results = [];
      let cursor = date;
      for (let i = 0; i < count; i += 1) {
        const previous = history.getPreviousDailyDate(cursor);
        if (!previous) break;
        results.push({ date: previous, insights: readDailyInsights(previous) });
        cursor = previous;
      }
      return results;
    },
    recentDailyDates(date, count = 3) {
      const dates = [];
      let cursor = date;
      for (let i = 0; i < count; i += 1) {
        const previous = history.getPreviousDailyDate(cursor);
        if (!previous) break;
        dates.push(previous);
        cursor = previous;
      }
      return dates;
    },
    listDailyDates: history.listDailyDates,
    readDailyBrief: history.readDailyBrief,
  };
}

module.exports = {
  ensureDataDir,
  readBriefFromDisk,
  readInsightsFromDisk,
  readDailyInsights,
  buildContext,
  resolveRenderMap,
  resolveFacts,
  normalizeRenderMap,
  resetCaches,
};
