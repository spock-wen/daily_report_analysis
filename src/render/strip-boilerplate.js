'use strict';

const { loadConfig } = require('../checker/config');

// 周主题里「全面爆发」是整句里的一个词，删掉会把前后粘成病句。
// 换成不在禁词表里的说法，其余固定句仍整段删除。
const WORD_REPLACEMENTS = {
  '全面爆发': '集中出现',
};

const ANALYSIS_KEYS = ['coreFunctions', 'useCases', 'trends'];

function lists(config) {
  const source = config || loadConfig();
  return {
    phrases: (source.fixedPhrases || []).filter(Boolean),
    words: (source.bannedWords || []).filter(Boolean),
  };
}

function cleanupResidue(value) {
  const text = String(value)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t,，、;；:：\-—]+/, '')
    .replace(/[ \t,，、;；:：\-—]+$/, '')
    .trim();
  if (!/[\u4e00-\u9fa5A-Za-z0-9]/.test(text)) return '';
  return text;
}

function stripBoilerplateText(text, config) {
  if (typeof text !== 'string' || !text) return text;
  const { phrases, words } = lists(config);
  let value = text;
  for (const [from, to] of Object.entries(WORD_REPLACEMENTS)) {
    if (words.includes(from)) value = value.split(from).join(to);
  }
  for (const phrase of phrases) {
    if (phrase && value.includes(phrase)) value = value.split(phrase).join('');
  }
  for (const word of words) {
    if (!word || WORD_REPLACEMENTS[word]) continue;
    if (value.includes(word)) value = value.split(word).join('');
  }
  return cleanupResidue(value);
}

function stripStringList(values, config) {
  if (!Array.isArray(values)) return values;
  return values
    .map(item => (typeof item === 'string' ? stripBoilerplateText(item, config) : item))
    .filter(item => typeof item !== 'string' || item.trim());
}

function stripAnalysis(analysis, config) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  const next = { ...analysis };
  for (const key of ANALYSIS_KEYS) {
    if (Array.isArray(next[key])) next[key] = stripStringList(next[key], config);
    else if (typeof next[key] === 'string') next[key] = stripBoilerplateText(next[key], config);
  }
  return next;
}

function stripProjectAnalysis(project, config) {
  if (!project || typeof project !== 'object' || !project.analysis) return project;
  return { ...project, analysis: stripAnalysis(project.analysis, config) };
}

function stripBoilerplateValue(value, config) {
  if (typeof value === 'string') return stripBoilerplateText(value, config);
  if (Array.isArray(value)) {
    return value
      .map(item => stripBoilerplateValue(item, config))
      .filter(item => !(typeof item === 'string' && !item.trim()));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = stripBoilerplateValue(item, config);
    }
    return result;
  }
  return value;
}

function stripWeekThemes(weekThemes, config) {
  if (!Array.isArray(weekThemes)) return weekThemes;
  return weekThemes.map(item => {
    if (!item || typeof item !== 'object' || typeof item.theme !== 'string') return item;
    return { ...item, theme: stripBoilerplateText(item.theme, config) };
  });
}

module.exports = {
  WORD_REPLACEMENTS,
  ANALYSIS_KEYS,
  stripBoilerplateText,
  stripAnalysis,
  stripProjectAnalysis,
  stripBoilerplateValue,
  stripWeekThemes,
};
