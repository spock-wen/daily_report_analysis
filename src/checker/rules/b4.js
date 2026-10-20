'use strict';

const fs = require('fs');
const path = require('path');
const history = require('../../metrics/history');
const { normalize, splitSentences } = require('../text');
const { loadDocument, createJsonDocument } = require('../document');
const { makeFinding } = require('./util');

function collectExclusions(ctx, briefs) {
  const names = new Set();
  const descriptions = [];

  const addBrief = (brief) => {
    for (const project of brief?.projects || []) {
      const fullName = project.fullName || project.repo || project.name;
      if (fullName) {
        names.add(fullName);
        const short = project.name || String(fullName).split('/')[1];
        if (short) names.add(short);
      }
      if (project.descZh) descriptions.push(normalize(project.descZh));
      if (project.description) descriptions.push(normalize(project.description));
    }
  };

  addBrief(ctx.brief);
  for (const brief of briefs) addBrief(brief);

  return { names, descriptions };
}

function comparableForm(sentence, exclusions) {
  const normalized = normalize(sentence);
  if (!normalized) return null;
  for (const description of exclusions.descriptions) {
    if (description && description.includes(normalized)) return null;
  }
  let stripped = normalized;
  const names = Array.from(exclusions.names).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (!name || !stripped.includes(name)) continue;
    stripped = stripped.split(name).join('');
  }
  return stripped.length >= 12 ? stripped : null;
}

function loadDailyCorpus(ctx, doc) {
  const dates = history.getISOWeekDates(ctx.period);
  const dailyBriefs = [];
  const dailySentences = new Set();
  const documents = [];

  const htmlMode = doc.kind === 'html';
  const baseDir = htmlMode ? path.dirname(path.dirname(doc.path)) : path.dirname(path.dirname(doc.path));
  const dailyDir = path.join(baseDir, 'daily');

  for (const date of dates) {
    const fileName = htmlMode ? `github-ai-trending-${date}.html` : `insights-${date}.json`;
    const filePath = path.join(dailyDir, fileName);
    if (!fs.existsSync(filePath)) continue;

    let dailyDoc;
    try {
      dailyDoc = loadDocument(filePath, 'insights');
    } catch (error) {
      continue;
    }
    documents.push(dailyDoc);
    dailyBriefs.push(history.readDailyBrief(date));
  }

  return { dates, dailyBriefs, dailySentences, documents };
}

function check(ctx, doc) {
  const findings = [];
  if (!history.getISOWeekDates(ctx.period).length) return findings;

  const corpus = loadDailyCorpus(ctx, doc);
  if (corpus.documents.length === 0) return findings;

  const exclusions = collectExclusions(ctx, corpus.dailyBriefs);

  const dailySentences = new Set();
  for (const dailyDoc of corpus.documents) {
    for (const sentence of dailyDoc.sentences) {
      const form = comparableForm(sentence.text, exclusions);
      if (form) dailySentences.add(form);
    }
  }

  for (const sentence of doc.sentences) {
    const form = comparableForm(sentence.text, exclusions);
    if (!form) continue;
    if (!dailySentences.has(form)) continue;
    findings.push(makeFinding('B4', doc, {
      field: 'document',
      line: sentence.line,
      quote: sentence.text,
      message: '与本周日报正文完全相同的 12 字以上句子（不含项目名与 descZh）',
    }));
  }

  return findings;
}

module.exports = {
  id: 'B4',
  applies: (ctx, doc) => ctx.level === 'weekly' && (doc.role === 'html' || doc.role === 'insights'),
  check,
};
