'use strict';

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../checker/config');
const {
  wordSections,
  wordRegex,
  stripExempt,
  isCountEnumeration,
} = require('../checker/rules/b18');

const SENTENCE_CHUNK_RE = /[^。！？\n]+[。！？\n]?/g;

function sentenceChunks(text) {
  const source = String(text || '');
  const chunks = [];
  let match;
  while ((match = SENTENCE_CHUNK_RE.exec(source)) !== null) {
    chunks.push(match[0]);
  }
  return chunks;
}

function selfWrittenWords(sentence, regex, config) {
  const cleaned = stripExempt(sentence, config.metricNameExempt || []);
  const words = [];
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    if (isCountEnumeration(cleaned, match.index, match[0])) continue;
    words.push(match[0]);
  }
  return words;
}

function isR5Insights(insights) {
  return Boolean(insights && typeof insights === 'object'
    && (insights.version === 'r5'
      || insights.version === 'r9'
      || (insights.slots && typeof insights.slots === 'object' && !Array.isArray(insights.slots))));
}

function sanitizeInsights(insights, options = {}) {
  if (isR5Insights(insights)) return { insights, deleted: [] };
  const config = options.config || loadConfig();
  const sections = wordSections(config);
  const regex = wordRegex(sections);
  const deleted = [];

  const sanitizeString = (value, fieldPath) => {
    if (!regex) return value;
    const chunks = sentenceChunks(value);
    const kept = [];
    for (const chunk of chunks) {
      const sentence = chunk.trim();
      if (!sentence) continue;
      const words = selfWrittenWords(sentence, regex, config);
      if (words.length === 0) {
        kept.push(chunk);
        continue;
      }
      for (const word of new Set(words)) {
        deleted.push({ path: fieldPath, sentence, word });
      }
    }
    return kept.join('').trim();
  };

  const walk = (value, fieldPath) => {
    if (typeof value === 'string') return sanitizeString(value, fieldPath);
    if (Array.isArray(value)) {
      const result = [];
      value.forEach((item, index) => {
        const next = walk(item, `${fieldPath}[${index}]`);
        if (typeof next === 'string' && !next.trim()) return;
        result.push(next);
      });
      return result;
    }
    if (value && typeof value === 'object') {
      const result = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = walk(item, fieldPath ? `${fieldPath}.${key}` : key);
      }
      return result;
    }
    return value;
  };

  return {
    insights: walk(insights, ''),
    deleted,
  };
}

function deletedSentencesPath({ outDir, level, period }) {
  return path.join(outDir, 'check', `deleted-sentences-${level}-${period}.json`);
}

function writeDeletedSentences({ outDir, level, period, deleted }) {
  const filePath = deletedSentencesPath({ outDir, level, period });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({
    level,
    period,
    count: deleted.length,
    deleted,
  }, null, 2)}\n`, 'utf8');
  return filePath;
}

module.exports = {
  sanitizeInsights,
  writeDeletedSentences,
  deletedSentencesPath,
};
