const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../..');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getDataDir() {
  return process.env.REPORT_DATA_DIR
    ? path.resolve(process.env.REPORT_DATA_DIR)
    : path.join(ROOT_DIR, 'data');
}

function getBriefsDir() {
  return path.join(getDataDir(), 'briefs');
}

function getInsightsDir() {
  return path.join(getDataDir(), 'insights');
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function getISOWeekId(dateStr) {
  const date = parseDate(dateStr);
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getISOWeekStart(weekStr) {
  const match = String(weekStr || '').match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  firstMonday.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  return formatDate(firstMonday);
}

function getISOWeekDates(weekStr) {
  const start = getISOWeekStart(weekStr);
  if (!start) return [];
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function shiftISOWeek(weekStr, delta) {
  const start = getISOWeekStart(weekStr);
  if (!start) return null;
  return getISOWeekId(addDays(start, delta * 7));
}

function getMonthDates(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const days = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) => {
    return `${match[1]}-${match[2]}-${String(index + 1).padStart(2, '0')}`;
  });
}

function getPrevMonth(month) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getWeeksInMonth(month) {
  const weeks = [];
  for (const date of getMonthDates(month)) {
    if (parseDate(date).getUTCDay() === 1) {
      weeks.push(getISOWeekId(date));
    }
  }
  return weeks;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

let dailyIndex = null;
const dailyBriefCache = new Map();

function getDailyIndex() {
  if (dailyIndex) return dailyIndex;
  dailyIndex = new Map();
  const dir = path.join(getBriefsDir(), 'daily');
  if (!fs.existsSync(dir)) return dailyIndex;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(dir, file);
    const brief = readJsonFile(filePath);
    if (brief && DATE_RE.test(brief.date)) {
      dailyIndex.set(brief.date, filePath);
    }
  }
  return dailyIndex;
}

function resetHistoryCache() {
  dailyIndex = null;
  dailyBriefCache.clear();
}

function readDailyBrief(date) {
  if (!DATE_RE.test(String(date || ''))) return null;
  if (dailyBriefCache.has(date)) return dailyBriefCache.get(date);

  const directPath = path.join(getBriefsDir(), 'daily', `data-${date}.json`);
  let brief = readJsonFile(directPath);
  if (!brief || (brief.date && brief.date !== date)) {
    const indexedPath = getDailyIndex().get(date);
    brief = indexedPath ? readJsonFile(indexedPath) : null;
  }

  if (brief && (!brief.date || brief.date === date)) {
    dailyBriefCache.set(date, brief);
    return brief;
  }
  return null;
}

function listDailyDates() {
  return Array.from(getDailyIndex().keys()).sort();
}

function getPreviousDailyDate(date) {
  const dates = listDailyDates();
  let previous = null;
  for (const candidate of dates) {
    if (candidate >= date) break;
    previous = candidate;
  }
  return previous;
}

function getPreviousDailyEntry(date) {
  let cursor = date;
  while (cursor) {
    const previous = getPreviousDailyDate(cursor);
    if (!previous) return null;
    const brief = readDailyBrief(previous);
    if (brief) return { date: previous, brief };
    cursor = previous;
  }
  return null;
}

function getRecentDailyEntries(date, days = 30) {
  const from = addDays(date, -days);
  const entries = [];
  for (const candidate of listDailyDates()) {
    if (candidate < from || candidate >= date) continue;
    const brief = readDailyBrief(candidate);
    if (brief) entries.push({ date: candidate, brief });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function getMonthDailyEntries(month) {
  const entries = [];
  for (const date of listDailyDates()) {
    if (!date.startsWith(`${month}-`)) continue;
    const brief = readDailyBrief(date);
    if (brief) entries.push({ date, brief });
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

function readWeeklyBrief(week) {
  return readJsonFile(path.join(getBriefsDir(), 'weekly', `data-weekly-${week}.json`));
}

function readWeeklyInsights(week) {
  return readJsonFile(path.join(getInsightsDir(), 'weekly', `insights-${week}.json`));
}

function readMonthlyBrief(month) {
  return readJsonFile(path.join(getBriefsDir(), 'monthly', `data-month-${month}.json`));
}

function readMonthlyInsights(month) {
  return readJsonFile(path.join(getInsightsDir(), 'monthly', `insights-${month}.json`));
}

function projectKey(project) {
  return project?.fullName || project?.repo || project?.name || null;
}

function getProjectNames(brief) {
  const names = [];
  for (const project of brief?.projects || []) {
    const key = projectKey(project);
    if (key && !names.includes(key)) names.push(key);
  }
  return names;
}

module.exports = {
  DATE_RE,
  getDataDir,
  getBriefsDir,
  getInsightsDir,
  parseDate,
  formatDate,
  addDays,
  getISOWeekId,
  getISOWeekStart,
  getISOWeekDates,
  shiftISOWeek,
  getMonthDates,
  getPrevMonth,
  getWeeksInMonth,
  resetHistoryCache,
  readDailyBrief,
  listDailyDates,
  getPreviousDailyDate,
  getPreviousDailyEntry,
  getRecentDailyEntries,
  getMonthDailyEntries,
  readWeeklyBrief,
  readWeeklyInsights,
  readMonthlyBrief,
  readMonthlyInsights,
  projectKey,
  getProjectNames,
};
