'use strict';

/**
 * 文本、数字、句子与 JSON 位置解析工具。
 * 只依赖 Node 内置能力，供核查规则共用。
 */

const SENTENCE_BREAK = /[。！？\n]/;
const CLAUSE_BREAK = /[。！？\n，,；;、]/;
const MAX_SENTENCE_UNITS = 2000;

function normalize(text) {
  return String(text === undefined || text === null ? '' : text).replace(/\s+/g, '');
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLineIndex(raw) {
  const starts = [0];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineAt(lineStarts, pos) {
  if (!lineStarts || lineStarts.length === 0) return 1;
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lineStarts[mid] <= pos) low = mid;
    else high = mid - 1;
  }
  return low + 1;
}

const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text) {
  return String(text)
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITY_MAP[m] || m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * 去掉 script/style 与标签，保留换行；同时返回每个输出字符对应的原始行号。
 */
function stripHtmlWithLineMap(raw) {
  const cleaned = String(raw).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, m => m.replace(/[^\n]/g, ' '));
  const out = [];
  const lineMap = [];
  let line = 1;
  let last = 0;
  const tagRe = /<[^>]*>/g;
  const pushText = (text) => {
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      out.push(ch);
      lineMap.push(line);
      if (ch === '\n') line += 1;
    }
  };
  let match;
  while ((match = tagRe.exec(cleaned)) !== null) {
    pushText(cleaned.slice(last, match.index));
    out.push('\n');
    lineMap.push(line);
    const newlines = match[0].match(/\n/g);
    if (newlines) line += newlines.length;
    last = match.index + match[0].length;
  }
  pushText(cleaned.slice(last));
  return { text: decodeEntities(out.join('')), lineMap };
}

function stripHtml(raw) {
  return stripHtmlWithLineMap(raw).text;
}

/**
 * 按 cr_dup.py 的方式切句：以 。！？换行 分隔，去掉空白，长度 ≥ minLength，去重。
 */
function splitSentences(text, resolveLine, minLength = 12) {
  const source = String(text || '');
  const results = [];
  const seen = new Set();
  let start = 0;
  for (let i = 0; i <= source.length; i += 1) {
    const isEnd = i === source.length || SENTENCE_BREAK.test(source[i]);
    if (!isEnd) continue;
    const piece = source.slice(start, i);
    const normalized = normalize(piece);
    if (normalized.length >= minLength && !seen.has(normalized)) {
      seen.add(normalized);
      results.push({ text: normalized, line: resolveLine(start) });
    }
    start = i + 1;
  }
  return results;
}

function splitClauses(text) {
  return String(text || '')
    .split(CLAUSE_BREAK)
    .map(part => part.trim())
    .filter(Boolean);
}

function splitSentenceUnits(text) {
  return String(text || '')
    .split(SENTENCE_BREAK)
    .map(part => part.trim())
    .filter(Boolean);
}

const STAR_UNIT = {
  亿: 1e8,
  万: 1e4,
  千: 1e3,
  k: 1e3,
  K: 1e3,
  w: 1e4,
  W: 1e4,
};

const STAR_CONTEXT_RE = /星|★|Stars|stars/;
const AGGREGATE_MARKER_RE = /合计|上周|全周|环比|换血率/;
const THRESHOLD_MARKER_RE = /门槛|基准|阈值/;
const COMPARATOR_MARKER_RE = /超过|高于|低于|跌破|≥|≤/;
const CUMULATIVE_MARKER_RE = /总星数|累计星|累计|总计/;
const TODAY_MARKER_RE = /当期|期内|今日|当天|单日|日增|新增|todayStars/i;

function hasStarContext(text) {
  return STAR_CONTEXT_RE.test(String(text || ''));
}

/**
 * 从含「星」语义的句子里提取数字（含 万/亿/千/k/w 单位）。
 * options.hasStarContext 可由调用方传入整句的「星」语义，用于分句后单句不含「星」的情况。
 */
function parseStarNumbers(text, options = {}) {
  const source = String(text || '');
  const starContext = options.hasStarContext === undefined
    ? hasStarContext(source)
    : Boolean(options.hasStarContext);
  if (!starContext) return [];
  const results = [];
  const re = /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(亿|万|千|[kKwW])?/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const rawNumber = match[1];
    const unit = match[2] || '';
    const value = Number(rawNumber.replace(/,/g, '')) * (STAR_UNIT[unit] || 1);
    if (!unit && value < 1000) continue;
    results.push({
      raw: match[0].trim(),
      number: Number(rawNumber.replace(/,/g, '')),
      unit,
      value,
      approximate: Boolean(unit),
    });
  }
  return results;
}

/**
 * 按 J25/J26/J27 判断分句内每个数字的口径与豁免：
 * - 合计/上周/全周/环比/换血率标记：整个分句视为汇总；
 * - 累计类词：只在该分句同时存在期内数时逐数字比较口径；
 * - 门槛/基准/阈值：仅豁免对应数字；
 * - 比较词不整句跳过，只有分句无法归属项目时才豁免比较基准数字。
 */
function analyzeStarClause(clause, numbers, config) {
  const source = String(clause || '');
  const cumulativeWords = ((config && config.cumulativeWords) || []).filter(Boolean);
  const aggregateMarker = AGGREGATE_MARKER_RE.test(source);
  const positions = [];
  let cursor = 0;

  for (const number of numbers || []) {
    const found = source.indexOf(number.raw, cursor);
    const start = found < 0 ? cursor : found;
    const end = start + number.raw.length;
    positions.push({ number, start, end, before: source.slice(cursor, start) });
    cursor = end;
  }

  const items = positions.map((entry, index) => {
    const nextStart = index + 1 < positions.length ? positions[index + 1].start : source.length;
    const after = source.slice(entry.end, nextStart);
    const cumulative = CUMULATIVE_MARKER_RE.test(entry.before)
      || cumulativeWords.some(word => entry.before.includes(word));
    const today = TODAY_MARKER_RE.test(entry.before);
    return {
      number: entry.number,
      cumulative,
      today: !cumulative || today,
      threshold: THRESHOLD_MARKER_RE.test(entry.before)
        || (index === positions.length - 1 && THRESHOLD_MARKER_RE.test(after)),
      comparator: COMPARATOR_MARKER_RE.test(entry.before),
    };
  });

  const hasCumulative = items.some(item => item.cumulative);
  const hasToday = items.some(item => item.today && !item.cumulative);

  return {
    aggregate: aggregateMarker && !(hasCumulative && hasToday),
    cumulativeOnly: hasCumulative && !hasToday,
    items,
  };
}

function numberTolerance(parsed) {
  if (!parsed.unit) return 0.5;
  const unitValue = STAR_UNIT[parsed.unit] || 1;
  return unitValue * 0.05;
}

function matchesStarValue(parsed, expected) {
  if (!Number.isFinite(expected)) return false;
  return Math.abs(parsed.value - Number(expected)) <= numberTolerance(parsed);
}

function findProjectMentions(text, projects) {
  const source = String(text || '');
  const hits = new Map();
  for (const project of projects || []) {
    if (!project || !project.fullName) continue;
    if (source.includes(project.fullName)) {
      hits.set(project.fullName, project);
      continue;
    }
    const name = project.name || project.fullName.split('/')[1];
    if (!name || name.length < 3) continue;
    const re = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(name)}(?![A-Za-z0-9_-])`);
    if (re.test(source)) hits.set(project.fullName, project);
  }
  return Array.from(hits.values());
}

function findLineInRaw(raw, needle, lineStarts, fromIndex = 0) {
  const index = String(raw).indexOf(needle, fromIndex);
  if (index < 0) return null;
  return lineAt(lineStarts || buildLineIndex(raw), index);
}

function isCommonSlashPair(owner, repo, commonWords) {
  if (!commonWords || commonWords.size === 0) return false;
  return commonWords.has(owner.toLowerCase()) && commonWords.has(repo.toLowerCase());
}

/**
 * 提取 owner/repo 形式的名字。
 * 只有命中当期 fullName（大小写不敏感）或形似仓库名且不属于常见词对时才返回；
 * 避免把 A/B、Windows/Linux、Code/Codex、Ghidra/Hopper 当成仓库名。
 */
function extractRepoRefs(text, options = {}) {
  const results = [];
  const known = options.knownFullNames || null;
  const commonWords = options.commonWords instanceof Set
    ? options.commonWords
    : new Set((options.commonWords || []).map(word => String(word).toLowerCase()));
  const re = /([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g;
  let match;
  while ((match = re.exec(String(text || ''))) !== null) {
    const owner = match[1];
    const repo = match[2].replace(/[.,;:!?]+$/, '');
    const raw = `${owner}/${repo}`;
    if (owner.includes('.')) continue;
    if (!/[A-Za-z]/.test(repo)) continue;
    if (known && known.has(raw.toLowerCase())) {
      results.push({ raw, owner, repo, known: true });
      continue;
    }
    if (owner.length < 2 || repo.length < 2) continue;
    if (/^\d+$/.test(owner)) continue;
    if (isCommonSlashPair(owner, repo, commonWords)) continue;
    results.push({ raw, owner, repo, known: false });
  }
  return results;
}

/**
 * 解析 JSON 并保留字符串/容器位置，用于定位行号与字段路径。
 */
function parseJsonWithPositions(raw) {
  const lineStarts = buildLineIndex(raw);
  let pos = 0;
  const nodeByPath = new Map();

  function skipWs() {
    while (pos < raw.length && /\s/.test(raw[pos])) pos += 1;
  }

  function register(node) {
    if (node.path) nodeByPath.set(node.path, node);
    return node;
  }

  function parseStringNode(path, container) {
    const start = pos;
    pos += 1;
    while (pos < raw.length) {
      const ch = raw[pos];
      if (ch === '\\') {
        pos += 2;
        continue;
      }
      if (ch === '"') {
        pos += 1;
        break;
      }
      pos += 1;
    }
    const value = JSON.parse(raw.slice(start, pos));
    return register({
      type: 'string',
      value,
      path,
      container,
      line: lineAt(lineStarts, start),
      start,
      end: pos,
    });
  }

  function parseValue(path, container) {
    skipWs();
    const ch = raw[pos];
    if (ch === '{') return parseObject(path, container);
    if (ch === '[') return parseArray(path, container);
    if (ch === '"') return parseStringNode(path, container);
    const start = pos;
    const re = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/;
    const match = re.exec(raw.slice(pos));
    if (!match) throw new Error(`JSON 解析失败：位置 ${pos}`);
    pos += match[0].length;
    let value = match[0];
    let type;
    if (value === 'true') {
      value = true;
      type = 'boolean';
    } else if (value === 'false') {
      value = false;
      type = 'boolean';
    } else if (value === 'null') {
      value = null;
      type = 'null';
    } else {
      value = Number(value);
      type = 'number';
    }
    return register({
      type,
      value,
      path,
      container,
      line: lineAt(lineStarts, start),
      start,
      end: pos,
    });
  }

  function parseArray(path, container) {
    const start = pos;
    pos += 1;
    const items = [];
    skipWs();
    if (raw[pos] === ']') {
      pos += 1;
      return register({ type: 'array', items, path, container, line: lineAt(lineStarts, start) });
    }
    while (pos < raw.length) {
      const itemPath = `${path}[${items.length}]`;
      items.push(parseValue(itemPath, itemPath));
      skipWs();
      if (raw[pos] === ',') {
        pos += 1;
        continue;
      }
      if (raw[pos] === ']') {
        pos += 1;
        break;
      }
      throw new Error(`JSON 数组解析失败：位置 ${pos}`);
    }
    return register({ type: 'array', items, path, container, line: lineAt(lineStarts, start) });
  }

  function parseObject(path, container) {
    const start = pos;
    pos += 1;
    const children = {};
    const keyLines = {};
    skipWs();
    if (raw[pos] === '}') {
      pos += 1;
      return register({ type: 'object', children, keyLines, path, container, line: lineAt(lineStarts, start) });
    }
    while (pos < raw.length) {
      skipWs();
      const keyStart = pos;
      if (raw[pos] !== '"') throw new Error(`JSON 对象键解析失败：位置 ${pos}`);
      const keyNode = parseStringNode(null, null);
      const key = keyNode.value;
      keyLines[key] = lineAt(lineStarts, keyStart);
      skipWs();
      if (raw[pos] !== ':') throw new Error(`JSON 对象缺少冒号：位置 ${pos}`);
      pos += 1;
      skipWs();
      const childPath = path ? `${path}.${key}` : key;
      children[key] = parseValue(childPath, container);
      skipWs();
      if (raw[pos] === ',') {
        pos += 1;
        continue;
      }
      if (raw[pos] === '}') {
        pos += 1;
        break;
      }
      throw new Error(`JSON 对象解析失败：位置 ${pos}`);
    }
    return register({
      type: 'object',
      children,
      keyLines,
      path,
      container,
      line: lineAt(lineStarts, start),
    });
  }

  skipWs();
  const root = parseValue('', null);
  assignContainers(root, null);
  return { root, nodeByPath, lineStarts };
}

/**
 * 重新标注字符串所属的「卡片/段落」容器：
 * 只把对象型数组项（如 longTermValue[0]、hot[0]）视为容器，
 * 数组里的原始字符串沿用上层容器。
 */
function assignContainers(node, container) {
  if (!node) return;
  if (!node.type || ['string', 'number', 'boolean', 'null'].includes(node.type)) {
    node.container = container;
    return;
  }
  if (node.type === 'array') {
    for (const item of node.items || []) {
      const itemContainer = item && item.type === 'object' ? item.path : container;
      assignContainers(item, itemContainer);
    }
    return;
  }
  if (node.type === 'object') {
    for (const key of Object.keys(node.children || {})) {
      assignContainers(node.children[key], container);
    }
  }
}

function flattenStrings(node, out = []) {
  if (!node) return out;
  if (node.type === 'string') {
    out.push({ path: node.path, value: node.value, line: node.line, container: node.container });
    return out;
  }
  if (node.type === 'array') {
    for (const item of node.items) flattenStrings(item, out);
    return out;
  }
  if (node.type === 'object') {
    for (const key of Object.keys(node.children)) flattenStrings(node.children[key], out);
  }
  return out;
}

function collectStringsUnder(node, out = []) {
  if (!node) return out;
  if (node.type === 'string') {
    out.push(node.value);
    return out;
  }
  if (node.type === 'array') {
    for (const item of node.items) collectStringsUnder(item, out);
    return out;
  }
  if (node.type === 'object') {
    for (const key of Object.keys(node.children)) collectStringsUnder(node.children[key], out);
  }
  return out;
}

function longestCommonSubstring(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return '';
  let bestLength = 0;
  let bestEnd = 0;
  let previous = new Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        current[j] = previous[j - 1] + 1;
        if (current[j] > bestLength) {
          bestLength = current[j];
          bestEnd = i;
        }
      }
    }
    previous = current;
  }
  return left.slice(bestEnd - bestLength, bestEnd);
}

function truncate(text, length = 120) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  return source.length > length ? `${source.slice(0, length)}…` : source;
}

module.exports = {
  MAX_SENTENCE_UNITS,
  normalize,
  escapeRegExp,
  buildLineIndex,
  lineAt,
  stripHtml,
  stripHtmlWithLineMap,
  decodeEntities,
  splitSentences,
  splitClauses,
  splitSentenceUnits,
  hasStarContext,
  parseStarNumbers,
  analyzeStarClause,
  matchesStarValue,
  numberTolerance,
  findProjectMentions,
  findLineInRaw,
  extractRepoRefs,
  parseJsonWithPositions,
  flattenStrings,
  collectStringsUnder,
  longestCommonSubstring,
  truncate,
};
