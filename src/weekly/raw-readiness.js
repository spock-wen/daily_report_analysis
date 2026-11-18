'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { addDays, getISOWeekId } = require('../metrics/history');
const {
  mapWikiRawToScrapeShape,
  rawFilePath,
  resolveWeekStartMonday,
} = require('../loader/wiki-trending-raw-loader');

function resolveExpectedWeekStart(options = {}) {
  if (options.weekStart) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.weekStart)) {
      return { ok: false, code: 'WEEK_START_INVALID' };
    }
    const monday = resolveWeekStartMonday(options.weekStart);
    if (monday !== options.weekStart) {
      return { ok: false, code: 'WEEK_START_NOT_MONDAY', monday };
    }
    return { ok: true, weekStart: options.weekStart };
  }
  return { ok: true, weekStart: resolveWeekStartMonday(options.asOf || new Date()) };
}

function notReady(code, extra = {}) {
  return { ready: false, pass: false, code, ...extra };
}

function assessWeeklyRawText(text, expectedWeekStart) {
  if (text == null || !String(text).trim()) {
    return notReady('RAW_EMPTY');
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return notReady('RAW_PARTIAL', { reason: error.message });
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return notReady('RAW_PARTIAL');
  }

  const weekStart = typeof raw.week_start === 'string' ? raw.week_start : '';
  if (weekStart !== expectedWeekStart) {
    return notReady('PERIOD_MISMATCH', { actualWeekStart: weekStart || null });
  }
  if (typeof raw.date === 'string' && raw.date !== expectedWeekStart) {
    return notReady('PERIOD_MISMATCH', { actualDate: raw.date });
  }
  if (raw.period != null && raw.period !== 'weekly') {
    return notReady('PERIOD_MISMATCH', { actualPeriod: raw.period });
  }
  if (typeof raw.week_end === 'string' && raw.week_end !== addDays(expectedWeekStart, 6)) {
    return notReady('PERIOD_MISMATCH', { actualWeekEnd: raw.week_end });
  }
  if (!Array.isArray(raw.projects) || raw.projects.length === 0) {
    return notReady('RAW_INCOMPLETE');
  }
  if (typeof raw.count === 'number' && raw.count !== raw.projects.length) {
    return notReady('RAW_INCOMPLETE');
  }

  let mapped;
  try {
    mapped = mapWikiRawToScrapeShape(raw, expectedWeekStart, 'weekly');
  } catch (error) {
    return notReady('RAW_INCOMPLETE', { reason: error.message });
  }

  return {
    ready: true,
    pass: false,
    code: 'RAW_READY',
    weekStart: expectedWeekStart,
    isoWeek: getISOWeekId(expectedWeekStart),
    mapped,
  };
}

function assessWeeklyRaw(options = {}) {
  const resolved = resolveExpectedWeekStart(options);
  if (!resolved.ok) {
    return notReady(resolved.code, { monday: resolved.monday || null });
  }
  const filePath = options.filePath || rawFilePath(options.wikiBase, resolved.weekStart, 'weekly');
  if (!fs.existsSync(filePath)) {
    return notReady('RAW_MISSING', {
      filePath,
      weekStart: resolved.weekStart,
      isoWeek: getISOWeekId(resolved.weekStart),
    });
  }

  let text;
  try {
    text = options.readFile
      ? options.readFile(filePath)
      : fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return notReady('RAW_PARTIAL', { filePath, reason: error.message });
  }

  const assessed = assessWeeklyRawText(text, resolved.weekStart);
  const hash = crypto.createHash('sha256').update(Buffer.from(String(text), 'utf8')).digest('hex');
  return {
    ...assessed,
    filePath,
    hash,
    weekStart: assessed.weekStart || resolved.weekStart,
    isoWeek: assessed.isoWeek || getISOWeekId(resolved.weekStart),
  };
}

module.exports = {
  assessWeeklyRaw,
  assessWeeklyRawText,
  resolveExpectedWeekStart,
};
