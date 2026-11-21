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

module.exports = {
  parseRangeText,
  datesFromRange,
  checkWeekWindow,
};
