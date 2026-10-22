'use strict';

const { loadConfig } = require('../checker/config');
const history = require('../metrics/history');

const SLOT_TYPES = {
  reason: { maxLength: 30 },
  descShortZh: { maxLength: 14 },
  descZh: { maxLength: 60 },
  oneSentence: { maxLength: 40 },
};

const DEFAULT_PHRASES = {
  reason: '可结合项目描述理解',
  heroReason: '结合当日榜单与项目描述理解',
  descShortZh: '暂无中文简介',
  descZh: '暂无中文说明',
};

const PROJECT_DEFAULT_TEXTS = [
  { pattern: /agent|代理/i, full: '面向编码代理的开发工具', short: '面向编码代理的工具', base: '编码代理' },
  { pattern: /求职|招聘|job/i, full: '面向求职流程的效率工具', short: '求职流程效率工具', base: '求职流程' },
  { pattern: /安全|审计|security/i, full: '面向代码安全的审计工具', short: '代码安全审计工具', base: '代码安全' },
  { pattern: /知识图谱|图谱|graph/i, full: '面向代码与文档的知识图谱工具', short: '代码知识图谱工具', base: '代码知识图谱' },
  { pattern: /推理|模型|llm|大模型|inference/i, full: '面向大模型的推理与服务工具', short: '大模型推理工具', base: '大模型推理' },
  { pattern: /界面|图形|ui|comfy/i, full: '面向模型工作流的图形界面', short: '模型工作流界面', base: '模型工作流' },
  { pattern: /数据|金融|行情/i, full: '面向数据分析的基础模型', short: '数据分析基础模型', base: '数据分析' },
  { pattern: /插件|plugin/i, full: '面向知识工作的插件合集', short: '知识工作插件合集', base: '知识工作插件' },
];
const PROJECT_DEFAULT_FALLBACK = { full: '面向开发者的开源工具', short: '面向开发者的工具', base: '开发工程' };

function cleanTypeName(project) {
  const typeName = project?.analysis?.typeName || project?.category || project?.analysis?.type || '';
  const match = PROJECT_DEFAULT_TEXTS.find(item => item.pattern.test(String(typeName)));
  if (match && match.base) return match.base;
  let raw = match ? match.short : String(typeName || '开发工程');
  raw = raw.replace(/^面向/, '').replace(/的?(工具|开发工具|基础模型|合集|界面|框架)$/, '').replace(/的$/, '').trim();
  return raw || '开发工程';
}

function hasConsecutiveDuplicate(text) {
  if (!text || typeof text !== 'string') return false;
  const match = /([\u4e00-\u9fa5]{2,})\1/.exec(text);
  if (match) {
    const word = match[1];
    if (word !== '一步' && word !== '一点') return true;
  }
  const engMatch = /\b([a-zA-Z]{2,})\s+\1\b/i.exec(text);
  if (engMatch) return true;
  return false;
}

function defaultProjectText(typeName, kind = 'descZh') {
  const name = String(typeName || '');
  const matched = PROJECT_DEFAULT_TEXTS.find(item => item.pattern.test(name));
  const entry = matched || PROJECT_DEFAULT_FALLBACK;
  if (kind === 'descShortZh') return entry.short;
  if (kind === 'oneSentence') {
    const base = cleanTypeName({ analysis: { typeName } });
    return `专注于${base}的工程实践方案`;
  }
  return entry.full;
}

function formatAttrs(lang, commLevel, variant = 0) {
  const l = String(lang || '').trim();
  let c = '';
  if (commLevel === '极高') c = '关注度极高';
  else if (commLevel === '高') c = '关注度很高';
  else if (commLevel === '中') c = '关注度良好';
  else if (commLevel === '低') c = '处于早期探索';

  const langPhrases = [
    l ? `用 ${l} 编写` : '',
    l ? `基于 ${l} 构建` : '',
    l ? `采用 ${l} 开发` : '',
    l ? `以 ${l} 实现` : '',
  ];
  const langClause = l ? langPhrases[variant % langPhrases.length] : '';

  if (langClause && c) {
    return `${langClause}、${c}`;
  }
  if (langClause) {
    return langClause;
  }
  if (c) {
    return c;
  }
  const defaultClauses = [
    '功能完整',
    '设计精炼',
    '开箱即用',
    '结构清晰',
    '易于扩展',
  ];
  return defaultClauses[variant % defaultClauses.length];
}

const DESC_ZH_TEMPLATES = [
  (t, l, c) => `一款${formatAttrs(l, c, 0)}的${t}开发工具`,
  (t, l, c) => `面向${t}场景打造、${formatAttrs(l, c, 1)}的实用工具箱`,
  (t, l, c) => `围绕${t}技术栈、${formatAttrs(l, c, 2)}的开源支持库`,
  (t, l, c) => `专注于${t}实践落地、${formatAttrs(l, c, 3)}的工程组件`,
  (t, l, c) => `为${t}开发者打造、${formatAttrs(l, c, 0)}的高效开发套件`,
  (t, l, c) => `深耕${t}方向、${formatAttrs(l, c, 1)}的应用基础设施`,
  (t, l, c) => `探索${t}创新应用、${formatAttrs(l, c, 2)}的开源解决方案`,
  (t, l, c) => `赋能${t}生态体系、${formatAttrs(l, c, 3)}的轻量级工具库`,
  (t, l, c) => `支撑${t}自动化运作、${formatAttrs(l, c, 0)}的专业工程框架`,
  (t, l, c) => `适用于${t}业务场景、${formatAttrs(l, c, 1)}的高效实用程序`,
  (t, l, c) => `助力${t}流程构建、${formatAttrs(l, c, 2)}的模块化工具集`,
  (t, l, c) => `立足${t}前沿探索、${formatAttrs(l, c, 3)}的现代开发框架`,
  (t, l, c) => `优化${t}交付体验、${formatAttrs(l, c, 0)}的实用支持套件`,
  (t, l, c) => `聚焦${t}核心能力、${formatAttrs(l, c, 1)}的轻量开源项目`,
  (t, l, c) => `针对${t}常见需求、${formatAttrs(l, c, 2)}的模块化开发库`,
  (t, l, c) => `加速${t}方案落地、${formatAttrs(l, c, 3)}的高性能基础库`,
];

function buildDefaultDescZh(project, usedSentences = new Set(), config = null, regex = null) {
  const baseType = cleanTypeName(project);
  const lang = String(project?.language || '').trim();
  const commLevel = project?.analysis?.community?.level || project?.community || '';

  for (let i = 0; i < DESC_ZH_TEMPLATES.length; i++) {
    const fn = DESC_ZH_TEMPLATES[i];
    const candidate = fn(baseType, lang, commLevel).replace(/\s+/g, ' ').trim();
    if (candidate.length > 60) continue;
    if (/\d/.test(candidate)) continue;
    if (hasConsecutiveDuplicate(candidate)) continue;
    if (usedSentences.has(candidate)) continue;
    if (regex && regex.test(stripMetricNames(candidate, config))) continue;
    return candidate;
  }
  return `一款专注于${baseType}的实用开发工具`;
}

const DESC_SHORT_TEMPLATES = [
  (t, l) => `${l ? l + ' ' : ''}${t}工具`,
  (t, l) => `${l ? l + ' ' : ''}${t}框架`,
  (t, l) => `${l ? l + ' ' : ''}${t}组件`,
  (t, l) => `${l ? l + ' ' : ''}${t}套件`,
  (t) => `开源${t}工具`,
  (t) => `实用${t}工具`,
  (t) => `${t}基础设施`,
  (t) => `${t}解决方案`,
];

function buildDefaultDescShortZh(project, usedSentences = new Set(), config = null, regex = null) {
  const baseType = cleanTypeName(project);
  const lang = String(project?.language || '').trim();
  for (let i = 0; i < DESC_SHORT_TEMPLATES.length; i++) {
    const fn = DESC_SHORT_TEMPLATES[i];
    const candidate = fn(baseType, lang).replace(/\s+/g, ' ').trim();
    if (candidate.length > 14) continue;
    if (/\d/.test(candidate)) continue;
    if (hasConsecutiveDuplicate(candidate)) continue;
    if (usedSentences.has(candidate)) continue;
    if (regex && regex.test(stripMetricNames(candidate, config))) continue;
    return candidate;
  }
  return `${baseType.slice(0, 4)}工具`;
}

const ONE_SENTENCE_TEMPLATES = [
  (t, l, c) => `旨在提升${t}效率、${formatAttrs(l, c, 2)}的实用套件`,
  (t, l, c) => `服务于${t}工作流、${formatAttrs(l, c, 3)}的效率组件`,
  (t, l, c) => `提供${t}完整方案、${formatAttrs(l, c, 0)}的工程组件`,
  (t, l, c) => `加速${t}业务落地、${formatAttrs(l, c, 1)}的开源项目`,
  (t, l, c) => `精简${t}操作流程、${formatAttrs(l, c, 2)}的辅助工具`,
  (t, l, c) => `支持${t}快速集成、${formatAttrs(l, c, 3)}的开发脚手架`,
  (t, l, c) => `拓宽${t}应用边界、${formatAttrs(l, c, 0)}的轻量方案`,
  (t, l, c) => `促进${t}团队协同、${formatAttrs(l, c, 1)}的实用程序`,
  (t, l, c) => `规范${t}工程实施、${formatAttrs(l, c, 2)}的基础架构`,
  (t, l, c) => `整合${t}底层能力、${formatAttrs(l, c, 3)}的模块化套件`,
  (t, l, c) => `驱动${t}系统运行、${formatAttrs(l, c, 0)}的专业工具箱`,
  (t, l, c) => `满足${t}多样需求、${formatAttrs(l, c, 1)}的开源组件`,
  (t, l, c) => `贯通${t}全链路流程、${formatAttrs(l, c, 2)}的实践方案`,
  (t, l, c) => `保障${t}稳定执行、${formatAttrs(l, c, 3)}的现代组件`,
  (t, l, c) => `强化${t}工程底座、${formatAttrs(l, c, 0)}的工具库`,
  (t, l, c) => `应对${t}复杂架构、${formatAttrs(l, c, 1)}的集成套件`,
];

function buildDefaultOneSentence(project, descZh, usedSentences = new Set(), config = null, regex = null) {
  const baseType = cleanTypeName(project);
  const lang = String(project?.language || '').trim();
  const commLevel = project?.analysis?.community?.level || project?.community || '';

  for (let i = 0; i < ONE_SENTENCE_TEMPLATES.length; i++) {
    const fn = ONE_SENTENCE_TEMPLATES[i];
    const candidate = fn(baseType, lang, commLevel).replace(/\s+/g, ' ').trim();
    if (candidate.length > 40) continue;
    if (/\d/.test(candidate)) continue;
    if (candidate === descZh) continue;
    if (hasConsecutiveDuplicate(candidate)) continue;
    if (usedSentences.has(candidate)) continue;
    if (regex && regex.test(stripMetricNames(candidate, config))) continue;
    return candidate;
  }
  return `服务于${baseType}工作流的开源套件`;
}

// 槽位 JSON 允许扁平点号键，也允许嵌套对象；统一摊平成 slotId -> 文本。
function flattenSlots(value, prefix = '', result = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [key, item] of Object.entries(value)) {
    const slotId = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      flattenSlots(item, slotId, result);
    } else if (typeof item === 'string') {
      result[slotId] = item;
    }
  }
  return result;
}

function truncateText(value, maxLength) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  return [...text].slice(0, maxLength).join('').replace(/[，。、；：,.;:\s]+$/, '');
}

function stripRepoPrefix(text, fullName) {
  if (!fullName) return String(text || '').trim();
  const escaped = escapeRegExp(fullName);
  return String(text || '')
    .replace(new RegExp(`^\\s*${escaped}\\s*[：:，,\\-—]?\\s*`), '')
    .trim();
}

// 热度口径：高热＝今日新增 > 100 星；再叠加当日新增合计相对 7 日均值的倍数。
function computeHypeIndex(input = {}) {
  const totalProjects = Number(input.totalProjects) || 0;
  const hotCount = Number(input.hotCount) || 0;
  const totalToday = Number(input.totalToday) || 0;
  const average = input.avgTotalToday === null || input.avgTotalToday === undefined
    ? null
    : Number(input.avgTotalToday);
  const hasAverage = Number.isFinite(average) && average > 0;
  const hotRatio = totalProjects > 0 ? hotCount / totalProjects : 0;

  let score = 1;
  if (hotRatio >= 0.5) score += 1;
  if (hotRatio >= 0.9) score += 1;
  if (hasAverage) {
    const ratio = totalToday / average;
    if (ratio >= 1.2) score += 1;
    if (ratio >= 2) score += 1;
  } else if (totalToday > 0) {
    score += 1;
  }
  score = Math.min(5, Math.max(1, score));

  const parts = [`高热项目 ${hotCount} 个，占全部 ${totalProjects} 个`];
  if (hasAverage) {
    parts.push(`当日新增合计为 7 日均值的 ${Math.round(totalToday / average * 10) / 10} 倍`);
  } else {
    parts.push(`当日新增合计 ${totalToday} 星`);
  }
  return { score, reason: `${parts.join('；')}。` };
}

const GLOBAL_SLOT_IDS = [
  'hero.reason',
  'trend.composition.reason',
  'trend.momentum.reason',
  'trend.hot.reason',
  'trend.churn.reason',
  'trend.streak.reason',
  'trend.distribution.reason',
  'analysis.composition.reason',
  'analysis.momentum.reason',
  'analysis.churn.reason',
  'analysis.streak.reason',
  'advice.1.reason',
  'advice.2.reason',
  'advice.3.reason',
  'churn.new.reason',
  'churn.drop.reason',
];

function slotTypeOf(slotId) {
  const suffix = String(slotId || '').split('.').pop();
  return Object.prototype.hasOwnProperty.call(SLOT_TYPES, suffix) ? suffix : null;
}

function slotSpecFor(slotId) {
  const type = slotTypeOf(slotId);
  return type ? { slotId, type, maxLength: SLOT_TYPES[type].maxLength } : null;
}

function textLength(value) {
  return [...String(value === undefined || value === null ? '' : value)].length;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function projectKey(project) {
  return project?.fullName || project?.repo || project?.name || null;
}

function projectNames(options = {}) {
  if (Array.isArray(options)) return options.map(item => (typeof item === 'string' ? item : projectKey(item))).filter(Boolean);
  if (Array.isArray(options.projects)) {
    return options.projects
      .map(item => (typeof item === 'string' ? item : projectKey(item)))
      .filter(Boolean);
  }
  return (options.brief?.projects || []).map(projectKey).filter(Boolean);
}

function buildSlotSpecs(options = {}) {
  const specs = GLOBAL_SLOT_IDS.map(slotSpecFor).filter(Boolean);
  for (const name of projectNames(options)) {
    specs.push(slotSpecFor(`project.${name}.descShortZh`));
    specs.push(slotSpecFor(`project.${name}.descZh`));
    specs.push(slotSpecFor(`project.${name}.oneSentence`));
  }
  return specs;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordRegex(config) {
  const words = (config?.directionStatusWords || [])
    .map(item => item && item.word)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  if (words.length === 0) return null;
  return new RegExp(words.map(escapeRegExp).join('|'));
}

function stripMetricNames(text, config) {
  let result = String(text || '');
  for (const word of [...(config?.metricNameExempt || [])].sort((left, right) => right.length - left.length)) {
    if (!word) continue;
    result = result.split(word).join('');
  }
  return result;
}

function checkSlotText(value, spec, config, regex) {
  if (!hasValue(value)) return { ok: false, reason: '为空' };
  const text = String(value).trim();
  if (spec && textLength(text) > spec.maxLength) {
    return { ok: false, reason: `超长（${textLength(text)}>${spec.maxLength}）` };
  }
  if (/\d/.test(text)) return { ok: false, reason: '含数字' };
  if (regex && regex.test(stripMetricNames(text, config))) {
    return { ok: false, reason: '含方向/状态词' };
  }
  return { ok: true, text };
}

function resolveSlots(slots, specs, options = {}) {
  const config = options.config || loadConfig();
  const logger = options.logger || require('../utils/logger');
  const regex = options.regex || wordRegex(config);
  const text = {};
  const usedDefaults = [];

  for (const spec of specs) {
    if (spec.slotId.startsWith('project.')) continue;
    const check = checkSlotText(slots?.[spec.slotId], spec, config, regex);
    if (check.ok) {
      text[spec.slotId] = check.text;
      continue;
    }
    text[spec.slotId] = DEFAULT_PHRASES[spec.type];
    usedDefaults.push({ slotId: spec.slotId, reason: check.reason });
    if (typeof logger.warn === 'function') {
      logger.warn(`[daily-v3-text] 槽位${check.reason}，使用缺省短语：${spec.slotId}`);
    }
  }

  return { text, usedDefaults };
}

function factList(facts) {
  if (Array.isArray(facts)) return facts;
  if (Array.isArray(facts?.facts)) return facts.facts;
  return [];
}

function indexFacts(facts) {
  const list = factList(facts);
  const byId = new Map();
  for (const fact of list) {
    if (fact && fact.id !== undefined && fact.id !== null) byId.set(String(fact.id), fact);
  }

  const find = predicate => list.find(predicate) || null;

  return {
    list,
    byId,
    total(role) {
      return find(fact => fact.role === role && !fact.project);
    },
    project(role, name) {
      return find(fact => fact.role === role && fact.project === name);
    },
    direction(metric, labelPart) {
      return find(fact => fact.role === 'direction'
        && fact.comparison?.metric === metric
        && (!labelPart || String(fact.label || '').includes(labelPart)));
    },
    maxStreak() {
      let best = null;
      for (const fact of list) {
        if (fact.role !== 'streak') continue;
        const value = Number(fact.value);
        if (!Number.isFinite(value) || value < 2) continue;
        if (!best || value > Number(best.value)) best = fact;
      }
      return best;
    },
    role(role) {
      return find(fact => fact.role === role);
    },
    average(metric) {
      for (const fact of list) {
        const match = /^avg(\d+)_(.+)$/.exec(String(fact.role || ''));
        if (match && match[2] === metric) {
          return { fact, window: Number(match[1]) };
        }
      }
      return null;
    },
  };
}

function averagePhrase(index, write, average) {
  if (!average) return null;
  if (!Number.isFinite(average.window) || average.window >= 7) return '较 7 日均';
  const windowFact = index.role('avg_window');
  if (!windowFact || Number(windowFact.value) !== average.window) return null;
  return `较近 ${write.num(windowFact)} 日均`;
}

function determinePrevDate(brief, options, index) {
  if (options && options.prevDate) return options.prevDate;
  if (brief && brief.dailyDiff && brief.dailyDiff.prevDate) return brief.dailyDiff.prevDate;
  if (brief && brief.stats && brief.stats.prevDate) return brief.stats.prevDate;
  if (index && Array.isArray(index.list)) {
    const factWithSource = index.list.find(f => /briefs\/daily\/data-(\d{4}-\d{2}-\d{2})\.json/.test(String(f && f.source || '')));
    if (factWithSource) {
      const m = /briefs\/daily\/data-(\d{4}-\d{2}-\d{2})\.json/.exec(factWithSource.source);
      if (m) return m[1];
    }
  }
  const scrapedAt = brief && (brief.scrapedAt || brief.generatedAt);
  if (scrapedAt && typeof history.getBaselineSnapshot === 'function') {
    const baseline = history.getBaselineSnapshot(scrapedAt);
    if (baseline && baseline.date) return baseline.date;
  }
  const date = (brief && brief.date) || (options && options.date);
  if (date && typeof history.getPreviousDailyDate === 'function') {
    return history.getPreviousDailyDate(date);
  }
  return null;
}

function isPrevYesterday(date, prevDate) {
  if (!date || !prevDate) return true;
  const d = new Date(date + 'T00:00:00Z');
  const p = new Date(prevDate + 'T00:00:00Z');
  const diffDays = Math.round((d.getTime() - p.getTime()) / (24 * 3600 * 1000));
  return diffDays === 1;
}

function comparisonClause(index, write, { metric, unit = '', withAverage = true, prevLabel = '较昨日' }) {
  const parts = [];
  const dayDelta = index.role(`delta_day_${metric}`);
  if (dayDelta) {
    parts.push(`${prevLabel} ${write.signed(dayDelta)}${unit}`);
  } else {
    const previous = index.role(`prev_${metric}`);
    if (previous) parts.push(`${prevLabel} ${write.num(previous)}${unit}`);
  }

  if (withAverage) {
    const average = index.average(metric);
    if (average) {
      const phrase = averagePhrase(index, write, average);
      const reference = index.role(`delta_avg_${metric}`) || average.fact;
      if (phrase && reference) parts.push(`${phrase} ${write.signed(reference)}${unit}`);
    }
  }

  return parts.length ? `，${parts.join('、')}` : '';
}

function makeSentence(writer) {
  const entries = [];
  const write = {
    num(fact) {
      if (!fact) return '';
      const text = String(fact.value);
      entries.push({ factId: fact.id, role: fact.role || null, text });
      return text;
    },
    signed(fact) {
      if (!fact) return '';
      const value = Number(fact.value);
      const text = Number.isFinite(value) && value > 0 ? `+${fact.value}` : String(fact.value);
      entries.push({ factId: fact.id, role: fact.role || null, text });
      return text;
    },
    abs(fact) {
      if (!fact) return '';
      const value = Math.abs(Number(fact.value));
      const text = Number.isFinite(value) ? String(value) : String(fact.value).replace(/^[+\-−]/, '');
      entries.push({ factId: fact.id, role: fact.role || null, text });
      return text;
    },
    dir(fact) {
      return fact && hasValue(fact.value) ? String(fact.value) : '';
    },
  };
  return { base: writer(write), entries };
}

function finalize(item, path, slotText) {
  for (const entry of item.entries) entry.path = path;
  return {
    text: `${item.base}，${slotText}。`,
    slotIds: item.slotIds || [],
    entries: item.entries,
  };
}

function buildTrendCandidates(index, prevLabel = '较昨日') {
  const candidates = [];

  const total = index.total('total_projects');
  const ai = index.total('ai_projects');
  if (total && ai) {
    candidates.push({
      ...makeSentence(w => `今日 ${w.num(total)} 个上榜项目中，AI 项目 ${w.num(ai)} 个`
        + comparisonClause(index, w, { metric: 'ai_projects', unit: ' 个', prevLabel })),
      slotId: 'trend.composition.reason',
    });
  }

  const totalToday = index.total('total_today');
  if (totalToday) {
    candidates.push({
      ...makeSentence(w => `当日新增星合计 ${w.num(totalToday)} 星`
        + comparisonClause(index, w, { metric: 'total_today', unit: ' 星', prevLabel })),
      slotId: 'trend.momentum.reason',
    });
  }

  const hotCount = index.total('hot_count');
  if (hotCount) {
    candidates.push({
      ...makeSentence(w => `高热项目 ${w.num(hotCount)} 个`
        + comparisonClause(index, w, { metric: 'hot_count', unit: ' 个', prevLabel })),
      slotId: 'trend.hot.reason',
    });
  }

  const newCount = index.total('new');
  const dropped = index.total('dropped');
  const kept = index.total('kept');
  const retention = index.total('retention_rate');
  if (newCount && dropped && kept && retention) {
    candidates.push({
      ...makeSentence(w => {
        const newDelta = index.role('delta_day_new');
        const droppedDelta = index.role('delta_day_dropped');
        const newPrev = index.role('prev_new');
        const droppedPrev = index.role('prev_dropped');

        let newPart = `新进 ${w.num(newCount)} 个`;
        if (newDelta) {
          newPart += `（${prevLabel} ${w.signed(newDelta)}）`;
        } else if (newPrev) {
          newPart += `（${prevLabel} ${w.num(newPrev)}）`;
        }

        let dropPart = `掉榜 ${w.num(dropped)} 个`;
        if (droppedDelta) {
          dropPart += `（${prevLabel} ${w.signed(droppedDelta)}）`;
        } else if (droppedPrev) {
          dropPart += `（${prevLabel} ${w.num(droppedPrev)}）`;
        }

        return `${newPart}、${dropPart}，连续在榜 ${w.num(kept)} 个，留存率 ${w.num(retention)}%`;
      }),
      slotId: 'trend.churn.reason',
    });
  }

  const maxStreak = index.total('max_streak') || index.maxStreak();
  if (maxStreak) {
    candidates.push({
      ...makeSentence(w => `连续在榜最长 ${w.num(maxStreak)} 天`
        + comparisonClause(index, w, { metric: 'max_streak', unit: ' 天', prevLabel })),
      slotId: 'trend.streak.reason',
    });
  }

  const categoryShare = index.total('category_share');
  const languageShare = index.total('language_share');
  const share = categoryShare || languageShare;
  if (share) {
    const metric = categoryShare ? 'category_share' : 'language_share';
    const shift = index.total(`${metric === 'category_share' ? 'category' : 'language'}_shift`);
    const nameMatch = /「(.+?)」/.exec(String(share.label || ''));
    const name = nameMatch ? nameMatch[1] : '头部';
    candidates.push({
      ...makeSentence(w => {
        let base = `头部${categoryShare ? '类目' : '语言'}「${name}」份额 ${w.num(share)}%`;
        if (shift) base += `，${prevLabel} ${w.signed(shift)} 个百分点`;
        return base;
      }),
      slotId: 'trend.distribution.reason',
    });
  }

  return candidates;
}

function buildAnalysisCandidates(index, prevLabel = '较昨日') {
  const candidates = [];

  const total = index.total('total_projects');
  const ai = index.total('ai_projects');
  if (total && ai) {
    candidates.push({ ...makeSentence(w => `今日榜单共 ${w.num(total)} 个项目，其中 AI 项目 ${w.num(ai)} 个`), slotId: 'analysis.composition.reason' });
  }

  const totalToday = index.total('total_today');
  if (totalToday) {
    const dayDelta = index.role('delta_day_total_today');
    const avgDelta = index.role('delta_avg_total_today');
    const previous = index.total('prev_total_today');
    const average = index.total('avg7_total_today');
    const prevTarget = prevLabel === '较昨日' ? '昨日' : '上期';

    candidates.push({
      ...makeSentence(w => {
        let base = `当日新增星合计 ${w.num(totalToday)} 星`;
        if (dayDelta && avgDelta) {
          const dVal = Number(dayDelta.value);
          const aVal = Number(avgDelta.value);
          const dWord = dVal >= 0 ? '多' : '少';
          const aWord = aVal >= 0 ? '多' : '少';
          const conj = (dVal >= 0) !== (aVal >= 0) ? '，但' : '，且';
          base += `，比${prevTarget}${dWord} ${w.abs(dayDelta)} 星${conj}比 7 日均值${aWord} ${w.abs(avgDelta)} 星`;
        } else if (dayDelta) {
          const dVal = Number(dayDelta.value);
          const dWord = dVal >= 0 ? '多' : '少';
          base += `，比${prevTarget}${dWord} ${w.abs(dayDelta)} 星`;
          if (average) base += `，7 日均值为 ${w.num(average)} 星`;
        } else if (previous) {
          base += `，较${prevTarget} ${w.num(previous)} 星`;
          if (average) base += `，7 日均值 ${w.num(average)} 星`;
        }
        return base;
      }),
      slotId: 'analysis.momentum.reason',
    });
  }

  const newCount = index.total('new');
  const dropped = index.total('dropped');
  const retention = index.total('retention_rate');
  if (newCount && dropped && retention) {
    candidates.push({
      ...makeSentence(w => `换血方面，新进 ${w.num(newCount)} 个、掉榜 ${w.num(dropped)} 个，留存率 ${w.num(retention)}%`),
      slotId: 'analysis.churn.reason',
    });
  }

  const maxStreak = index.maxStreak();
  if (maxStreak) {
    candidates.push({
      ...makeSentence(w => `连续在榜最长 ${w.num(maxStreak)} 天`),
      slotId: 'analysis.streak.reason',
    });
  }

  return candidates;
}

const ADVICE_BASES = [
  '优先跟踪当日新增星靠前的项目',
  '留意连续在榜时间较长的项目',
  '结合换血名单复核新进与掉榜项目',
];

function buildProjectTexts(names, slots, config, regex, logger, projects = new Map()) {
  const texts = [];
  const usedDefaults = [];
  const accepted = {};
  const usedOneSentences = new Set();
  const usedDescZh = new Set();
  const usedDescShortZh = new Set();

  for (const name of names) {
    const project = projects.get(name) || {};
    const typeName = project.analysis?.typeName || project.category || project.analysis?.type || '';
    const descId = `project.${name}.descZh`;
    const descSpec = slotSpecFor(descId);
    let descCheck = checkSlotText(slots?.[descId], descSpec, config, regex);
    let descZh = null;
    if (descCheck.ok) {
      const stripped = stripRepoPrefix(descCheck.text, name);
      if (stripped.includes(name) || (name.includes('/') && stripped.includes(name.split('/')[1]))) {
        descCheck = { ok: false, reason: '含仓库名' };
      } else if (hasConsecutiveDuplicate(stripped)) {
        descCheck = { ok: false, reason: '含连续重复词' };
      } else if (usedDescZh.has(stripped)) {
        descCheck = { ok: false, reason: '跨卡重复' };
      } else {
        descZh = stripped;
        usedDescZh.add(descZh);
      }
    }
    accepted[descId] = descCheck.ok;
    if (!descCheck.ok) {
      descZh = buildDefaultDescZh(project, usedDescZh, config, regex);
      usedDescZh.add(descZh);
      usedDefaults.push({ slotId: descId, reason: descCheck.reason, fallback: 'program.defaultZh' });
      if (typeof logger.warn === 'function') logger.warn(`[daily-v3-text] 槽位${descCheck.reason}，使用程序中文缺省：${descId}`);
    }

    const shortId = `project.${name}.descShortZh`;
    const shortSpec = slotSpecFor(shortId);
    let shortCheck = checkSlotText(slots?.[shortId], shortSpec, config, regex);
    let descShortZh = null;
    if (shortCheck.ok) {
      const stripped = stripRepoPrefix(shortCheck.text, name);
      if (stripped.includes(name) || (name.includes('/') && stripped.includes(name.split('/')[1]))) {
        shortCheck = { ok: false, reason: '含仓库名' };
      } else if (hasConsecutiveDuplicate(stripped)) {
        shortCheck = { ok: false, reason: '含连续重复词' };
      } else if (usedDescShortZh.has(stripped)) {
        shortCheck = { ok: false, reason: '跨卡重复' };
      } else {
        descShortZh = stripped;
        usedDescShortZh.add(descShortZh);
      }
    }
    accepted[shortId] = shortCheck.ok;
    if (!shortCheck.ok) {
      descShortZh = buildDefaultDescShortZh(project, usedDescShortZh, config, regex);
      usedDescShortZh.add(descShortZh);
      usedDefaults.push({ slotId: shortId, reason: shortCheck.reason, fallback: 'program.defaultShortZh' });
      if (typeof logger.warn === 'function') logger.warn(`[daily-v3-text] 槽位${shortCheck.reason}，使用程序中文短缺省：${shortId}`);
    }

    const oneId = `project.${name}.oneSentence`;
    const oneSpec = slotSpecFor(oneId);
    let oneCheck = checkSlotText(slots?.[oneId], oneSpec, config, regex);
    let oneSentence = null;
    if (oneCheck.ok) {
      const stripped = stripRepoPrefix(oneCheck.text, name);
      if (stripped.includes(name) || (name.includes('/') && stripped.includes(name.split('/')[1]))) {
        oneCheck = { ok: false, reason: '含仓库名' };
      } else if (stripped === descZh) {
        oneCheck = { ok: false, reason: '与简介相同' };
      } else if (hasConsecutiveDuplicate(stripped)) {
        oneCheck = { ok: false, reason: '含连续重复词' };
      } else if (usedOneSentences.has(stripped)) {
        oneCheck = { ok: false, reason: '跨卡重复' };
      } else {
        oneSentence = stripped;
        usedOneSentences.add(oneSentence);
      }
    }
    accepted[oneId] = oneCheck.ok;
    if (!oneCheck.ok) {
      oneSentence = buildDefaultOneSentence(project, descZh, usedOneSentences, config, regex);
      usedOneSentences.add(oneSentence);
      usedDefaults.push({ slotId: oneId, reason: oneCheck.reason, fallback: 'program.defaultOneSentence' });
      if (typeof logger.warn === 'function') logger.warn(`[daily-v3-text] 槽位${oneCheck.reason}，使用程序一句话缺省：${oneId}`);
    }

    texts.push({ fullName: name, descShortZh, descZh, oneSentence });
  }

  return { projects: texts, usedDefaults, accepted };
}

function buildDailyV3Text(options = {}) {
  const brief = options.brief || {};
  const config = options.config || loadConfig();
  const logger = options.logger || require('../utils/logger');
  const regex = wordRegex(config);
  const slots = flattenSlots(options.slots);
  const specs = buildSlotSpecs({ brief });
  const resolved = resolveSlots(slots, specs, { config, logger, regex });

  const index = indexFacts(options.facts);
  const renderEntries = [];

  const date = brief.date || options.date;
  const prevDate = determinePrevDate(brief, options, index);
  const isYesterday = isPrevYesterday(date, prevDate);
  const prevLabel = isYesterday ? '较昨日' : '较上期';

  const trends = buildTrendCandidates(index, prevLabel).slice(0, 5).map((candidate, position) => {
    const slotText = resolved.text[candidate.slotId] || DEFAULT_PHRASES.reason;
    const sentence = finalize({ ...candidate, slotIds: [candidate.slotId] }, `trends[${position}].text`, slotText);
    renderEntries.push(...sentence.entries);
    return { text: sentence.text, slotIds: sentence.slotIds };
  });

  const analysis = buildAnalysisCandidates(index, prevLabel).slice(0, 4).map(candidate => {
    const slotText = resolved.text[candidate.slotId] || DEFAULT_PHRASES.reason;
    const sentence = finalize({ ...candidate, slotIds: [candidate.slotId] }, 'analysis', slotText);
    renderEntries.push(...sentence.entries);
    return sentence.text;
  }).join('');

  const advice = ADVICE_BASES.map((base, position) => {
    const slotId = `advice.${position + 1}.reason`;
    return {
      text: `${base}，${resolved.text[slotId] || DEFAULT_PHRASES.reason}。`,
      slotIds: [slotId],
    };
  }).slice(0, 3);

  const newCount = index.total('new');
  const returned = index.total('returned');
  const dropped = index.total('dropped');
  let churnNewText = '';
  if (newCount) {
    const sentence = finalize({
      ...makeSentence(w => {
        let base = `${prevLabel}新进 ${w.num(newCount)} 个项目`;
        if (returned) base += `，其中回归 ${w.num(returned)} 个`;
        return base;
      }),
      slotIds: ['churn.new.reason'],
    }, 'churnNewText', resolved.text['churn.new.reason'] || DEFAULT_PHRASES.reason);
    renderEntries.push(...sentence.entries);
    churnNewText = sentence.text;
  }
  let churnDropText = '';
  if (dropped) {
    const sentence = finalize({
      ...makeSentence(w => `${prevLabel}掉榜 ${w.num(dropped)} 个项目`),
      slotIds: ['churn.drop.reason'],
    }, 'churnDropText', resolved.text['churn.drop.reason'] || DEFAULT_PHRASES.reason);
    renderEntries.push(...sentence.entries);
    churnDropText = sentence.text;
  }

  const projectMap = new Map((brief.projects || []).map(project => [projectKey(project), project]));
  const projectTexts = buildProjectTexts(
    projectNames({ brief }),
    slots,
    config,
    regex,
    logger,
    projectMap
  );

  const hotCount = index.total('hot_count');
  const totalProjects = index.total('total_projects');
  const totalToday = index.total('total_today');
  const avgTotalToday = index.total('avg7_total_today');
  const hypeIndex = computeHypeIndex({
    totalProjects: totalProjects?.value ?? (brief.projects || []).length,
    hotCount: hotCount?.value,
    totalToday: totalToday?.value,
    avgTotalToday: avgTotalToday?.value,
  });

  const projectSlots = {};
  for (const item of projectTexts.projects) {
    const shortId = `project.${item.fullName}.descShortZh`;
    const descId = `project.${item.fullName}.descZh`;
    const oneId = `project.${item.fullName}.oneSentence`;
    if (projectTexts.accepted[shortId]) projectSlots[shortId] = item.descShortZh;
    if (projectTexts.accepted[descId]) projectSlots[descId] = item.descZh;
    if (projectTexts.accepted[oneId]) projectSlots[oneId] = item.oneSentence;
  }

  return {
    version: 'r5',
    slots: { ...resolved.text, ...projectSlots },
    slotSpecs: specs,
    usedDefaults: [...resolved.usedDefaults, ...projectTexts.usedDefaults],
    trends,
    analysis,
    advice,
    churnNewText,
    churnDropText,
    hypeIndex,
    projects: projectTexts.projects,
    renderEntries,
  };
}

module.exports = {
  SLOT_TYPES,
  DEFAULT_PHRASES,
  GLOBAL_SLOT_IDS,
  slotTypeOf,
  slotSpecFor,
  textLength,
  buildSlotSpecs,
  checkSlotText,
  resolveSlots,
  buildDailyV3Text,
  computeHypeIndex,
  defaultProjectText,
  flattenSlots,
  truncateText,
  stripRepoPrefix,
  wordRegex,
  stripMetricNames,
  buildDefaultOneSentence,
  buildDefaultDescZh,
  buildDefaultDescShortZh,
  cleanTypeName,
  hasConsecutiveDuplicate,
  isPrevYesterday,
  determinePrevDate,
};
