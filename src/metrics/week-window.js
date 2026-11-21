'use strict';

const history = require('./history');

const RANGE_RE = /(20\d{2}-\d{2}-\d{2})\s*[—–-]\s*(20\d{2}-\d{2}-\d{2})/;

/**
 * 从可见文本里抽出「YYYY-MM-DD — YYYY-MM-DD」周窗口。
 */
function parseRangeText(text) {
  const match = String(text || '').match(RANGE_RE);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

function datesFromRange(range) {
  if (!range || !range.start || !range.end) return [];
  if (range.end < range.start) return [];
  const dates = [];
  let cursor = range.start;
  while (cursor <= range.end) {
    dates.push(cursor);
    cursor = history.addDays(cursor, 1);
    if (dates.length > 31) break;
  }
  return dates;
}

/**
 * 对照 ISO 周窗口。observed 可以是日期数组、{start,end}，或含范围句的文本。
 * 一个错数（例如 W46 读成 11-08..11-14）必须失败；正确窗口放行。
 */
function checkWeekWindow(weekId, observed) {
  const expected = history.getISOWeekDates(weekId);
  if (!expected.length) {
    return { ok: false, weekId, expected, observed: [], reason: `无效周次 ${weekId}` };
  }
  let dates = [];
  if (Array.isArray(observed)) {
    dates = observed.filter(Boolean);
  } else if (observed && typeof observed === 'object' && observed.start && observed.end) {
    dates = datesFromRange(observed);
  } else if (typeof observed === 'string') {
    const range = parseRangeText(observed);
    if (!range) {
      return { ok: false, weekId, expected, observed: [], reason: '文本中没有 YYYY-MM-DD — YYYY-MM-DD 周窗口' };
    }
    dates = datesFromRange(range);
  } else {
    return { ok: false, weekId, expected, observed: [], reason: '没有可对照的观察窗口' };
  }
  const expectedKey = expected.join(',');
  const observedKey = dates.join(',');
  if (observedKey !== expectedKey) {
    return {
      ok: false,
      weekId,
      expected,
      observed: dates,
      reason: `${weekId} 期望 ${expected[0]}..${expected[expected.length - 1]}，实际 ${dates[0] || '—'}..${dates[dates.length - 1] || '—'}`,
    };
  }
  return { ok: true, weekId, expected, observed: dates, reason: null };
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDay(value) {
  const match = DAY_RE.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

/**
 * 收集 insights 任意层级 `evidence` 数组里每一条的 day。
 * 返回 [{ path, day }]：对象条目 path 指向 `.day`；条目缺 day 或不是对象时 path 指向条目本身、day 为 undefined。
 */
function collectEvidenceDays(insights) {
  const entries = [];
  const walk = (node, nodePath) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${nodePath}[${index}]`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      const value = node[key];
      const childPath = nodePath ? `${nodePath}.${key}` : key;
      if (key === 'evidence' && Array.isArray(value)) {
        value.forEach((item, index) => {
          const itemPath = `${childPath}[${index}]`;
          const hasDay = item && typeof item === 'object' && !Array.isArray(item)
            && Object.prototype.hasOwnProperty.call(item, 'day');
          entries.push(hasDay ? { path: `${itemPath}.day`, day: item.day } : { path: itemPath, day: undefined });
        });
      }
      walk(value, childPath);
    }
  };
  walk(insights, '');
  return entries;
}

/**
 * 逐条判断 evidence.day 是否落在 ISO 周窗口内（集合包含，不要求齐 7 天）。
 * 与 checkWeekWindow 的「整窗相等」语义不同：这里窗内任意子集都放行，越窗 / 缺 day / 非 YYYY-MM-DD / 非法日历日记违规。
 */
function checkEvidenceDays(weekId, entries) {
  const expected = history.getISOWeekDates(weekId);
  const window = new Set(expected);
  const range = expected.length ? `${expected[0]}..${expected[expected.length - 1]}` : null;
  const violations = [];
  for (const entry of entries || []) {
    const day = entry ? entry.day : undefined;
    let reason = null;
    if (!range) reason = `无效周次 ${weekId}`;
    else if (day === undefined || day === null || day === '') reason = 'evidence 缺少 day';
    else if (typeof day !== 'string' || !isCalendarDay(day)) reason = `evidence.day「${day}」不是 YYYY-MM-DD 日历日`;
    else if (!window.has(day)) reason = `evidence.day ${day} 不在 ${weekId} 窗口 ${range} 内`;
    if (reason) violations.push({ path: entry ? entry.path : null, day, reason });
  }
  return { ok: violations.length === 0, weekId, expected, violations };
}

module.exports = {
  parseRangeText,
  datesFromRange,
  checkWeekWindow,
  collectEvidenceDays,
  checkEvidenceDays,
};
