'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildLineIndex,
  lineAt,
  stripHtmlWithLineMap,
  splitSentences,
  parseJsonWithPositions,
  flattenStrings,
  collectStringsUnder,
  normalize,
} = require('./text');

function buildCharLineMap(text) {
  const map = new Array(text.length);
  let line = 1;
  for (let i = 0; i < text.length; i += 1) {
    map[i] = line;
    if (text[i] === '\n') line += 1;
  }
  return map;
}

/** 标识符字段：仓库/项目名等，跨期合法重复，不得当作 B6 散文句。 */
const IDENTIFIER_KEY_RE = /^(fullName|project_name|projectName|repo|name|projects|keyProjects)$/;

function leafKeyFromPath(pathStr) {
  if (!pathStr) return '';
  const parts = String(pathStr).split('.');
  const last = parts[parts.length - 1] || '';
  return last.replace(/\[\d+\]/g, '');
}

function isIdentifierString(item) {
  return IDENTIFIER_KEY_RE.test(leafKeyFromPath(item && item.path));
}

function createJsonDocument(filePath, data, role, options = {}) {
  const raw = options.raw !== undefined ? options.raw : JSON.stringify(data, null, 2);
  const synthetic = Boolean(options.synthetic);
  const parsed = parseJsonWithPositions(raw);
  const strings = flattenStrings(parsed.root);
  if (synthetic) {
    for (const item of strings) item.line = null;
  }
  const proseStrings = strings.filter(item => !isIdentifierString(item));
  const lineStarts = parsed.lineStarts;
  return {
    path: filePath,
    role,
    kind: 'json',
    raw,
    lineStarts,
    json: data,
    root: parsed.root,
    nodeByPath: parsed.nodeByPath,
    strings,
    text: strings.map(item => item.value).join('\n'),
    sentences: proseStrings.flatMap(item =>
      splitSentences(item.value, () => item.line).map(sentence => ({ ...sentence, line: item.line, path: item.path }))
    ),
    lineAtOffset(offset) {
      return lineAt(lineStarts, offset);
    },
    findLine(needle) {
      const index = raw.indexOf(needle);
      return index < 0 ? null : lineAt(lineStarts, index);
    },
    getNode(nodePath) {
      return parsed.nodeByPath.get(nodePath) || null;
    },
    containerText(container) {
      if (!container) return '';
      const node = parsed.nodeByPath.get(container);
      if (!node) return '';
      return collectStringsUnder(node).join('\n');
    },
  };
}

function loadJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function createHtmlDocument(filePath, raw, role) {
  const { text, lineMap } = stripHtmlWithLineMap(raw);
  const lineStarts = buildLineIndex(raw);
  return {
    path: filePath,
    role,
    kind: 'html',
    raw,
    lineStarts,
    text,
    lineMap,
    sentences: splitSentences(text, offset => lineMap[offset] || lineMap[lineMap.length - 1] || 1),
    findLine(needle) {
      const index = raw.indexOf(needle);
      return index < 0 ? null : lineAt(lineStarts, index);
    },
    lineAtOffset(offset) {
      return lineAt(lineStarts, offset);
    },
  };
}

function createMarkdownDocument(filePath, raw, role) {
  const lineStarts = buildLineIndex(raw);
  const lineMap = buildCharLineMap(raw);
  return {
    path: filePath,
    role,
    kind: 'md',
    raw,
    lineStarts,
    text: raw,
    lineMap,
    sentences: splitSentences(raw, offset => lineMap[offset] || lineMap[lineMap.length - 1] || 1),
    findLine(needle) {
      const index = raw.indexOf(needle);
      return index < 0 ? null : lineAt(lineStarts, index);
    },
    lineAtOffset(offset) {
      return lineAt(lineStarts, offset);
    },
  };
}

function loadDocument(filePath, role) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return createJsonDocument(filePath, JSON.parse(raw), role, { raw });
  }
  if (ext === '.html' || ext === '.htm') {
    return createHtmlDocument(filePath, raw, role);
  }
  if (ext === '.md' || ext === '.markdown') {
    return createMarkdownDocument(filePath, raw, role);
  }
  return createMarkdownDocument(filePath, raw, role);
}

function detectDocumentTarget(filePath) {
  const base = path.basename(filePath);
  const ext = path.extname(base).toLowerCase();
  let match;

  if (ext === '.json') {
    match = /^insights-(\d{4}-\d{2}-\d{2})\.json$/.exec(base);
    if (match) return { level: 'daily', period: match[1], role: 'insights' };
    match = /^insights-(\d{4}-W\d{2})\.json$/.exec(base);
    if (match) return { level: 'weekly', period: match[1], role: 'insights' };
    match = /^insights-(\d{4}-\d{2})\.json$/.exec(base);
    if (match) return { level: 'monthly', period: match[1], role: 'insights' };
    match = /^data-(\d{4}-\d{2}-\d{2})\.json$/.exec(base);
    if (match) return { level: 'daily', period: match[1], role: 'brief' };
    match = /^data-weekly-(\d{4}-W\d{2})\.json$/.exec(base);
    if (match) return { level: 'weekly', period: match[1], role: 'brief' };
    match = /^data-month-(\d{4}-\d{2})\.json$/.exec(base);
    if (match) return { level: 'monthly', period: match[1], role: 'brief' };
    return null;
  }

  if (ext === '.html' || ext === '.htm') {
    match = /^github-ai-trending-(\d{4}-\d{2}-\d{2})\.html$/.exec(base);
    if (match) return { level: 'daily', period: match[1], role: 'html' };
    match = /^github-weekly-(\d{4}-W\d{2})\.html$/.exec(base);
    if (match) return { level: 'weekly', period: match[1], role: 'html' };
    match = /^github-monthly-(\d{4}-\d{2})\.html$/.exec(base);
    if (match) return { level: 'monthly', period: match[1], role: 'html' };
    return null;
  }

  if (ext === '.md' || ext === '.markdown') {
    match = /^weekly-(\d{4}-\d{2}-\d{2})\.md$/.exec(base);
    if (match) return { level: 'weekly', date: match[1], role: 'md' };
    match = /^monthly-(\d{4}-\d{2})\.md$/.exec(base);
    if (match) return { level: 'monthly', period: match[1], role: 'md' };
    match = /^daily-(\d{4}-\d{2}-\d{2})\.md$/.exec(base);
    if (match) return { level: 'daily', period: match[1], role: 'md' };
    return null;
  }

  return null;
}

function documentContains(doc, needle) {
  if (!needle) return false;
  if (doc.kind === 'json') return doc.text.includes(needle);
  return doc.text.includes(needle);
}

function documentNormalizedText(doc) {
  return normalize(doc.text || '');
}

module.exports = {
  createJsonDocument,
  createHtmlDocument,
  createMarkdownDocument,
  loadDocument,
  loadJsonFile,
  detectDocumentTarget,
  documentContains,
  documentNormalizedText,
  isIdentifierString,
  leafKeyFromPath,
};
