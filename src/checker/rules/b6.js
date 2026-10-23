'use strict';

const fs = require('fs');
const path = require('path');
const history = require('../../metrics/history');
const { loadDocument } = require('../document');
const { makeFinding } = require('./util');

function previousPeriod(level, period) {
  if (level === 'daily') return history.getPreviousDailyDate(period);
  if (level === 'weekly') return history.shiftISOWeek(period, -1);
  if (level === 'monthly') return history.getPrevMonth(period);
  return null;
}

function previousHtmlName(level, period) {
  if (level === 'daily') return `github-ai-trending-${period}.html`;
  if (level === 'weekly') return `github-weekly-${period}.html`;
  if (level === 'monthly') return `github-monthly-${period}.html`;
  return null;
}

function candidatePaths(ctx, doc, period) {
  const candidates = [];
  const dir = path.dirname(doc.path);
  if (doc.role === 'insights') candidates.push(path.join(dir, `insights-${period}.json`));
  if (doc.role === 'html') {
    const name = previousHtmlName(ctx.level, period);
    if (name) candidates.push(path.join(dir, name));
  }
  if (history.getInsightsDir) {
    candidates.push(path.join(history.getInsightsDir(), ctx.level, `insights-${period}.json`));
  }
  return candidates;
}

function loadPreviousDocument(ctx, doc, period) {
  for (const candidate of candidatePaths(ctx, doc, period)) {
    if (path.resolve(candidate) === path.resolve(doc.path)) continue;
    if (!fs.existsSync(candidate)) continue;
    try {
      return loadDocument(candidate, 'insights');
    } catch (error) {
      continue;
    }
  }
  return null;
}

function check(ctx, doc) {
  const findings = [];
  const period = previousPeriod(ctx.level, ctx.period);
  if (!period) return findings;

  const previous = loadPreviousDocument(ctx, doc, period);
  if (!previous) return findings;

  const previousSentences = new Set(previous.sentences.map(sentence => sentence.text));
  const seen = new Set();
  for (const sentence of doc.sentences) {
    if (!previousSentences.has(sentence.text)) continue;
    if (seen.has(sentence.text)) continue;
    seen.add(sentence.text);
    findings.push(makeFinding('B6', doc, {
      field: 'document',
      line: sentence.line,
      quote: sentence.text,
      message: `与上一期同层报告（${period}）整句完全相同`,
    }));
  }

  return findings;
}

module.exports = {
  id: 'B6',
  applies: (ctx, doc) => ctx.r3 && (doc.role === 'insights' || doc.role === 'html'),
  check,
  previousPeriod,
};
