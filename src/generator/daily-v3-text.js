'use strict';

const { loadConfig } = require('../checker/config');
const { pickProjectBlurb } = require('./daily-v3-copy');
const history = require('../metrics/history');

const SLOT_TYPES = {
  reason: { maxLength: 30 },
  descShortZh: { maxLength: 14 },
  descZh: { maxLength: 60 },
  oneSentence: { maxLength: 40 },
};

const DEFAULT_PHRASES = {
  reason: '',
  heroReason: '结合当日榜单与项目描述理解',
  descShortZh: '暂无中文简介',
  descZh: '暂无中文说明',
};

const PROJECT_DEFAULT_TEXTS = [
  { pattern: /agent|代理|智能体/i, full: '面向编码智能体的开发工具', short: '面向编码智能体的工具', base: '编码智能体' },
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

function cleanClause(text, project = {}) {
  if (!text || typeof text !== 'string') return '';
  let s = text;
  // 1. 去掉 emoji
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');
  // 2. 去掉仓库名、owner 名
  const fullName = project.fullName || '';
  const owner = project.owner || (fullName.includes('/') ? fullName.split('/')[0] : '');
  const repo = project.name || (fullName.includes('/') ? fullName.split('/')[1] : '');
  if (fullName) s = s.split(fullName).join('');
  if (owner && owner.length > 1) s = s.split(owner).join('');
  if (repo && repo.length > 1) s = s.split(repo).join('');
  // 3. 英文品牌堆砌清理
  s = s.replace(/\b(?:Claude(?:\s+Code)?|OpenAI|ChatGPT|GitHub|Trending|LangChain|FastAPI|Python|JavaScript|TypeScript|Rust)\b/gi, '');
  // 4. 清理 GUI、API 等中英混排
  s = s.replace(/\bGUI\b/gi, '图形界面');
  s = s.replace(/\bAPI\b/gi, '接口');
  s = s.replace(/\bCLI\b/gi, '命令行');
  s = s.replace(/\bSDK\b/gi, '开发工具包');
  s = s.replace(/\bLLM\b/gi, '大模型');
  // 5. 去掉无来源最高级（最强大/最快/世界上/领先/经典/常青）
  s = s.replace(/最强大|强大的|最快|世界上|领先|经典|常青|极致|最强|顶尖/g, '');
  // 6. 重复词清理（面向面向 -> 面向，文档…文档 -> 文档）
  s = s.replace(/(面向)+/g, '面向');
  s = s.replace(/(文档)[，,、\s]*(文档)/g, '$1');
  s = s.replace(/(工具)[，,、\s]*(工具)/g, '$1');
  s = s.replace(/(框架)[，,、\s]*(框架)/g, '$1');
  // 去除多余标点与空白
  s = s.replace(/^[：:，,、；;。\s]+|[：:，,、；;。\s]+$/g, '').trim();
  return s;
}

function extractCandidateClauses(project = {}) {
  const raw = String(project.descZh || project.description || project.desc || '').trim();
  const rawClauses = raw.split(/[。！？!?；;\n\r]+/);
  const candidates = [];
  for (const rawClause of rawClauses) {
    if (/\d/.test(rawClause)) continue;
    const cleaned = cleanClause(rawClause, project);
    if (cleaned.length >= 4 && !/\d/.test(cleaned)) {
      candidates.push(cleaned);
    }
  }
  return candidates;
}

function buildTopicsClause(project = {}) {
  const topics = Array.isArray(project.topics) ? project.topics : [];
  const cleanedTopics = topics.filter(t => t && !/\d/.test(t) && !t.includes(project.name || ''));
  if (cleanedTopics.length > 0) {
    const topicStr = cleanedTopics.slice(0, 3).join('、');
    return `基于${topicStr}的开源工具与实践`;
  }
  const cleanName = (project.name || project.fullName || '开源工具').split('/').pop();
  return `面向${cleanName}的工程实践与开发方案`;
}

function pickProgrammaticClause(candidates, project, existingTexts, maxLength) {
  for (const c of candidates) {
    const truncated = c.slice(0, maxLength).replace(/[，,、；：:\s]+$/, '');
    if (truncated.length >= 4 && !hasLongSubstringOverlap(truncated, existingTexts, 12)) {
      return truncated;
    }
  }
  const topicText = buildTopicsClause(project).slice(0, maxLength).replace(/[，,、；：:\s]+$/, '');
  if (!hasLongSubstringOverlap(topicText, existingTexts, 12)) {
    return topicText;
  }
  const cleanName = (project.name || '开发者').split('/').pop().slice(0, 6);
  return `面向${cleanName}的实用开源工具`.slice(0, maxLength);
}

function buildDefaultDescZh(project, existingTexts = []) {
  const candidates = extractCandidateClauses(project);
  return pickProgrammaticClause(candidates, project, existingTexts, 60);
}

function buildDefaultDescShortZh(project, existingTexts = []) {
  const candidates = extractCandidateClauses(project);
  return pickProgrammaticClause(candidates, project, existingTexts, 14);
}

function buildDefaultOneSentence(project, descZh, existingTexts = []) {
  const candidates = extractCandidateClauses(project);
  const remaining = candidates.filter(c => !c.includes(descZh) && !descZh.includes(c));
  return pickProgrammaticClause(remaining.length ? remaining : candidates, project, existingTexts, 40);
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

const REASON_FORBIDDEN_REGEX = /(?:\d|[零一二两三四五六七八九十百千万亿]|昨天|昨日|前日|前天|前一天|上周|上月|本月|今天|上期|近\s*\d|过去|\d+\s*天前|\d{1,2}[-/.月]\d{1,2}|比|较|相比|对比|同比|环比|高于|低于|超过|落后|多于|少于|均值|平均|倍|上升|下降|增长|回落|走强|走弱|持平|更高|更低|更多|更少|增加|减少|暴涨|暴跌|上涨|下跌|回归|新增|新进|掉榜|刷新|领先)/;

function checkSlotText(value, spec, config, regex) {
  if (!hasValue(value)) return { ok: false, reason: '为空' };
  const text = String(value).trim();
  if (spec && textLength(text) > spec.maxLength) {
    return { ok: false, reason: `超长（${textLength(text)}>${spec.maxLength}）` };
  }
  if (spec?.type === 'reason') {
    if (text === DEFAULT_PHRASES.reason || text === '可结合项目描述理解') {
      return { ok: false, reason: '缺省占位词' };
    }
    if (REASON_FORBIDDEN_REGEX.test(text)) {
      return { ok: false, reason: '含时间/比较/方向词或数字' };
    }
  } else {
    if (/\d/.test(text)) return { ok: false, reason: '含数字' };
  }
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
  const accepted = {};
  const usedDefaults = [];

  for (const spec of specs) {
    if (spec.slotId.startsWith('project.')) continue;
    const check = checkSlotText(slots?.[spec.slotId], spec, config, regex);
    if (check.ok) {
      text[spec.slotId] = check.text;
      accepted[spec.slotId] = true;
      continue;
    }
    accepted[spec.slotId] = false;
    text[spec.slotId] = '';
    usedDefaults.push({ slotId: spec.slotId, reason: check.reason });
    if (typeof logger.warn === 'function') {
      logger.warn(`[daily-v3-text] 槽位${check.reason}，使用程序兜底句：${spec.slotId}`);
    }
  }

  return { text, accepted, usedDefaults };
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
      if (!name) return null;
      return find(fact => fact.role === role && (fact.project === name || (fact.project && fact.project.split('/').pop() === name.split('/').pop())));
    },
    ratioTop1Top2() {
      return find(fact => fact.role === 'ratioTop1Top2' || fact.role === 'ratio_top1_top2');
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

function comparisonClause(index, write, { metric, unit = '', prevLabel = '较上期' }) {
  const parts = [];
  const dayDelta = index.role(`delta_day_${metric}`);
  if (dayDelta) {
    const val = Number(dayDelta.value);
    if (val === 0) {
      write.signed(dayDelta);
      parts.push('与上期持平');
    } else {
      parts.push(`${prevLabel}${write.signed(dayDelta)}${unit}`);
    }
  } else {
    const previous = index.role(`prev_${metric}`);
    if (previous) parts.push(`${prevLabel}${write.num(previous)}${unit}`);
  }
  return parts.length ? `，${parts.join('、')}` : '';
}

function makeSentence(writer) {
  const entries = [];
  const write = {
    num(fact) {
      if (!fact) return '';
      const val = Number(fact.value);
      const text = Number.isFinite(val) && Math.abs(val) >= 1000
        ? Math.round(val).toLocaleString('en-US')
        : String(fact.value);
      entries.push({ factId: fact.id, role: fact.role || null, text });
      return text;
    },
    signed(fact) {
      if (!fact) return '';
      const value = Number(fact.value);
      let text;
      if (Number.isFinite(value) && Math.abs(value) >= 1000) {
        const fmt = Math.round(Math.abs(value)).toLocaleString('en-US');
        text = value > 0 ? `+${fmt}` : (value < 0 ? `-${fmt}` : '0');
      } else if (Number.isFinite(value) && value > 0) {
        text = `+${fact.value}`;
      } else {
        text = String(fact.value);
      }
      entries.push({ factId: fact.id, role: fact.role || null, text });
      return text;
    },
    abs(fact) {
      if (!fact) return '';
      const value = Math.abs(Number(fact.value));
      const text = Number.isFinite(value)
        ? (value >= 1000 ? Math.round(value).toLocaleString('en-US') : String(value))
        : String(fact.value).replace(/^[+\-−]/, '');
      entries.push({ factId: fact.id, role: fact.role || null, text });
      return text;
    },
    dir(fact) {
      return fact && hasValue(fact.value) ? String(fact.value) : '';
    },
  };
  return { base: writer(write), entries };
}

function finalize(item, path, slotText, isAccepted) {
  for (const entry of item.entries) entry.path = path;
  let text;
  if (isAccepted && slotText && slotText.trim() && slotText !== DEFAULT_PHRASES.reason) {
    text = `${item.base}，${slotText.trim()}。`;
  } else {
    const base = item.base.replace(/[，。；、\s]+$/, '');
    text = `${base}。`;
  }
  return {
    text,
    slotIds: item.slotIds || [],
    entries: item.entries,
  };
}

function buildTrendCandidates(index, prevLabel = '较上期') {
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
          const val = Number(newDelta.value);
          if (val === 0) {
            w.signed(newDelta);
            newPart += '，与上期持平';
          } else if (val > 0) {
            newPart += `，${prevLabel}多 ${w.abs(newDelta)} 个`;
          } else {
            newPart += `，${prevLabel}少 ${w.abs(newDelta)} 个`;
          }
        } else if (newPrev) {
          newPart += `，${prevLabel}${w.num(newPrev)} 个`;
        }

        let dropPart = `掉榜 ${w.num(dropped)} 个`;
        if (droppedDelta) {
          const val = Number(droppedDelta.value);
          if (val === 0) {
            w.signed(droppedDelta);
            dropPart += '，与上期持平';
          } else if (val > 0) {
            dropPart += `，${prevLabel}多 ${w.abs(droppedDelta)} 个`;
          } else {
            dropPart += `，${prevLabel}少 ${w.abs(droppedDelta)} 个`;
          }
        } else if (droppedPrev) {
          dropPart += `，${prevLabel}${w.num(droppedPrev)} 个`;
        }

        return `${newPart}；${dropPart}，连续在榜 ${w.num(kept)} 个，留存率 ${w.num(retention)}%`;
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

function buildAnalysisCandidates(index, prevLabel = '较上期') {
  const candidates = [];

  const total = index.total('total_projects');
  const ai = index.total('ai_projects');
  if (total && ai) {
    candidates.push({ ...makeSentence(w => `今日榜单共 ${w.num(total)} 个项目，其中 AI 项目 ${w.num(ai)} 个`), slotId: 'analysis.composition.reason' });
  }

  const totalToday = index.total('total_today');
  if (totalToday) {
    const dayDelta = index.role('delta_day_total_today');
    const previous = index.total('prev_total_today');
    const prevTarget = prevLabel.startsWith('较') ? prevLabel.slice(1) : prevLabel;

    candidates.push({
      ...makeSentence(w => {
        let base = `当日新增星合计 ${w.num(totalToday)} 星`;
        if (dayDelta) {
          const dVal = Number(dayDelta.value);
          if (dVal === 0) {
            w.signed(dayDelta);
            base += '，与上期持平';
          } else {
            const dWord = dVal > 0 ? '多' : '少';
            base += `，比${prevTarget}${dWord}${w.abs(dayDelta)} 星`;
          }
        } else if (previous) {
          base += `，较${prevTarget}${w.num(previous)} 星`;
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

function buildChurnDropDetails(brief, prevBrief) {
  const dropped = brief?.dailyDiff?.dropped || [];
  if (!Array.isArray(dropped) || dropped.length === 0) return null;
  const prevProjects = prevBrief?.projects || [];
  const details = [];
  for (const item of dropped) {
    const fullName = typeof item === 'string' ? item : (item.fullName || item.name || '');
    if (!fullName) continue;
    const shortName = fullName.split('/').pop();
    const prevProj = prevProjects.find(p => (p.fullName || p.name) === fullName || (p.fullName && p.fullName.split('/').pop() === shortName));
    const typeName = prevProj?.analysis?.typeName || prevProj?.analysis?.type || null;
    details.push({ fullName, shortName, typeName });
  }
  return details;
}

function buildAdviceCandidates(brief, index, prevLabel = '较上期') {
  const candidates = [];
  const projects = Array.isArray(brief?.projects) ? brief.projects : [];

  // 建议 1: 当日新增第一名 名称/星数/与第二名倍数（一位小数）/连续天数
  const sortedByToday = [...projects].sort((a, b) => (Number(b.todayStars) || 0) - (Number(a.todayStars) || 0));
  const p1 = sortedByToday[0];
  if (p1) {
    const p1FullName = p1.fullName || p1.name;
    const p1Name = (p1.name || p1FullName).split('/').pop();
    const p1StarsFact = index.project('today_stars', p1FullName);
    const ratioFact = index.role('ratioTop1Top2') || index.role('ratio_top1_top2');
    const p1StreakFact = index.project('streak', p1FullName);

    candidates.push({
      ...makeSentence(w => {
        const starsVal = p1StarsFact ? w.num(p1StarsFact) : (p1.todayStars || 0);
        let s = `优先跟踪当日新增星靠前的项目：${p1Name} 当天 ${starsVal} 星`;
        if (ratioFact && Number(ratioFact.value) > 0) {
          s += `，是第二名的 ${w.num(ratioFact)} 倍`;
        }
        const streakVal = p1StreakFact ? Number(p1StreakFact.value) : Number(brief?.streakDays?.[p1FullName] || 0);
        if (p1StreakFact && streakVal > 1) {
          s += `，已连续 ${w.num(p1StreakFact)} 天位列榜首`;
        } else {
          s += '，位列榜首';
        }
        return s;
      }),
      slotId: 'advice.1.reason',
    });
  } else {
    candidates.push({
      ...makeSentence(w => '优先跟踪当日新增星靠前的项目，结合项目定位重点关注'),
      slotId: 'advice.1.reason',
    });
  }

  // 建议 2: 连续在榜最长的两个项目及天数与其新增星、较上期增减（数字为 0 时写持平，连续天数取数据，不得把只连续 1 天的项目说成连续较长）
  const streakList = projects.map(p => {
    const fullName = p.fullName || p.name;
    const streakFact = index.project('streak', fullName);
    const streakDays = streakFact ? Number(streakFact.value) : Number(brief?.streakDays?.[fullName] || 0);
    return { project: p, fullName, streakDays, streakFact };
  }).filter(item => item.streakDays >= 2);
  streakList.sort((a, b) => b.streakDays - a.streakDays || (Number(b.project.todayStars) || 0) - (Number(a.project.todayStars) || 0));

  if (streakList.length >= 2) {
    const s1 = streakList[0];
    const s2 = streakList[1];
    const s1Name = (s1.project.name || s1.fullName).split('/').pop();
    const s2Name = (s2.project.name || s2.fullName).split('/').pop();
    const s1StarsFact = index.project('today_stars', s1.fullName);
    const s1DeltaFact = index.project('acceleration', s1.fullName);

    candidates.push({
      ...makeSentence(w => {
        let deltaPart = '';
        if (s1DeltaFact) {
          const val = Number(s1DeltaFact.value);
          if (val === 0) {
            deltaPart = '，较上期持平';
          } else if (val > 0) {
            deltaPart = `，${prevLabel}多 ${w.num(s1DeltaFact)} 星`;
          } else {
            deltaPart = `，${prevLabel}少 ${w.abs(s1DeltaFact)} 星`;
          }
        }
        const s1Stars = s1StarsFact ? w.num(s1StarsFact) : (s1.project.todayStars || 0);
        return `留意 ${s1Name}（连续 ${w.num(s1.streakFact)} 天）和 ${s2Name}（连续 ${w.num(s2.streakFact)} 天）：${s1Name} 今日新增 ${s1Stars} 星${deltaPart}，在榜稳定性突出`;
      }),
      slotId: 'advice.2.reason',
    });
  } else if (streakList.length === 1) {
    const s1 = streakList[0];
    const s1Name = (s1.project.name || s1.fullName).split('/').pop();
    const s1StarsFact = index.project('today_stars', s1.fullName);
    const s1DeltaFact = index.project('acceleration', s1.fullName);

    candidates.push({
      ...makeSentence(w => {
        let deltaPart = '';
        if (s1DeltaFact) {
          const val = Number(s1DeltaFact.value);
          if (val === 0) {
            deltaPart = '，较上期持平';
          } else if (val > 0) {
            deltaPart = `，${prevLabel}多 ${w.num(s1DeltaFact)} 星`;
          } else {
            deltaPart = `，${prevLabel}少 ${w.abs(s1DeltaFact)} 星`;
          }
        }
        const s1Stars = s1StarsFact ? w.num(s1StarsFact) : (s1.project.todayStars || 0);
        return `留意连续在榜较长的 ${s1Name}（连续 ${w.num(s1.streakFact)} 天）：${s1Name} 今日新增 ${s1Stars} 星${deltaPart}，在榜稳定性突出`;
      }),
      slotId: 'advice.2.reason',
    });
  } else {
    candidates.push({
      ...makeSentence(w => '留意连续在榜项目表现，关注核心项目的在榜稳定性'),
      slotId: 'advice.2.reason',
    });
  }

  // 建议 3: 回归项目中排名最高者 名称/排名/新增星
  const returnedCandidates = projects.map((p, idx) => ({
    project: p,
    rank: idx + 1,
    fullName: p.fullName || p.name,
    isReturned: p.tag === '回归' || (Array.isArray(brief?.dailyDiff?.returnedNames) && brief.dailyDiff.returnedNames.includes(p.fullName || p.name)),
  })).filter(item => item.isReturned);
  returnedCandidates.sort((a, b) => a.rank - b.rank);

  if (returnedCandidates.length > 0) {
    const r1 = returnedCandidates[0];
    const r1Name = (r1.project.name || r1.fullName).split('/').pop();
    const r1StarsFact = index.project('today_stars', r1.fullName);
    const returnedCountFact = index.total('returned');

    candidates.push({
      ...makeSentence(w => {
        const countPrefix = (returnedCountFact && Number(returnedCountFact.value) > 0)
          ? `回归的 ${w.num(returnedCountFact)} 个项目中，`
          : '回归项目中，';
        const starsVal = r1StarsFact ? `+${w.num(r1StarsFact)}` : (r1.project.todayStars ? `+${r1.project.todayStars}` : '');
        return `${countPrefix}${r1Name} 回归即排至第 ${r1.rank}（${starsVal} 星），建议重点关注`;
      }),
      slotId: 'advice.3.reason',
    });
  } else {
    candidates.push({
      ...makeSentence(w => '结合换血名单复核新进与掉榜项目，关注新入榜项目的持续增长潜力'),
      slotId: 'advice.3.reason',
    });
  }

  return candidates;
}

function hasLongSubstringOverlap(candidate, existingTexts, minLength = 12) {
  if (!candidate || candidate.length < minLength) return false;
  for (const existing of existingTexts) {
    if (!existing || existing.length < minLength) continue;
    for (let i = 0; i <= candidate.length - minLength; i++) {
      const sub = candidate.slice(i, i + minLength);
      if (existing.includes(sub)) return true;
    }
  }
  return false;
}

function buildProjectTexts(names, slots, config, regex, logger, projects = new Map()) {
  const texts = [];
  const usedDefaults = [];
  const accepted = {};
  const allCardTexts = [];

  for (const name of names) {
    const project = projects.get(name) || {};
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
      } else if (stripped.includes('本地生图速度领先')) {
        descCheck = { ok: false, reason: '含未证实说法' };
      } else if (allCardTexts.includes(stripped) || hasLongSubstringOverlap(stripped, allCardTexts, 12)) {
        descCheck = { ok: false, reason: '跨卡重复或存在 ≥12 字重复' };
      } else {
        descZh = stripped;
        allCardTexts.push(descZh);
      }
    }
    accepted[descId] = descCheck.ok;
    if (!descCheck.ok) {
      descZh = buildDefaultDescZh(project, allCardTexts);
      allCardTexts.push(descZh);
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
      } else if (allCardTexts.includes(stripped) || hasLongSubstringOverlap(stripped, allCardTexts, 12)) {
        shortCheck = { ok: false, reason: '跨卡重复或存在 ≥12 字重复' };
      } else {
        descShortZh = stripped;
        allCardTexts.push(descShortZh);
      }
    }
    accepted[shortId] = shortCheck.ok;
    if (!shortCheck.ok) {
      descShortZh = buildDefaultDescShortZh(project, allCardTexts);
      allCardTexts.push(descShortZh);
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
      } else if (stripped === descZh && !pickProjectBlurb(name)?.oneSentence) {
        oneCheck = { ok: false, reason: '与简介相同' };
      } else if (hasConsecutiveDuplicate(stripped)) {
        oneCheck = { ok: false, reason: '含连续重复词' };
      } else if (allCardTexts.includes(stripped) || hasLongSubstringOverlap(stripped, allCardTexts, 12)) {
        oneCheck = { ok: false, reason: '跨卡重复或存在 ≥12 字重复' };
      } else {
        oneSentence = stripped;
        allCardTexts.push(oneSentence);
      }
    }
    accepted[oneId] = oneCheck.ok;
    if (!oneCheck.ok) {
      oneSentence = buildDefaultOneSentence(project, descZh, allCardTexts);
      allCardTexts.push(oneSentence);
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

  const date = brief.date || options.date || '2026-10-21';
  const prevDate = determinePrevDate(brief, options, index);
  let gapDays = 1;
  let prevMMDD = '';
  if (prevDate) {
    prevMMDD = prevDate.slice(5);
    if (date) {
      const d = new Date(date + 'T00:00:00Z');
      const p = new Date(prevDate + 'T00:00:00Z');
      const diff = Math.round((d.getTime() - p.getTime()) / (24 * 3600 * 1000));
      if (Number.isFinite(diff) && diff > 0) gapDays = diff;
    }
  }
  const cmpTerm = gapDays === 1 ? '较昨日' : (prevMMDD ? `较上期（${prevMMDD}）` : '较上期');

  const trends = buildTrendCandidates(index, cmpTerm).slice(0, 5).map((candidate, position) => {
    const isAccepted = resolved.accepted[candidate.slotId];
    const slotText = resolved.text[candidate.slotId];
    const sentence = finalize({ ...candidate, slotIds: [candidate.slotId] }, `trends[${position}].text`, slotText, isAccepted);
    renderEntries.push(...sentence.entries);
    return { text: sentence.text, slotIds: sentence.slotIds };
  });

  const analysis = buildAnalysisCandidates(index, cmpTerm).slice(0, 4).map(candidate => {
    const isAccepted = resolved.accepted[candidate.slotId];
    const slotText = resolved.text[candidate.slotId];
    const sentence = finalize({ ...candidate, slotIds: [candidate.slotId] }, 'analysis', slotText, isAccepted);
    renderEntries.push(...sentence.entries);
    return sentence.text;
  }).join('');

  const adviceCandidates = buildAdviceCandidates(brief, index, cmpTerm);
  const advice = adviceCandidates.slice(0, 3).map((candidate, position) => {
    const sentence = finalize({
      ...candidate,
      slotIds: [],
    }, `advice[${position}].text`, null, false);
    renderEntries.push(...sentence.entries);
    return {
      text: sentence.text,
      slotIds: [],
    };
  });

  const newCount = index.total('new');
  const returned = index.total('returned');
  const dropped = index.total('dropped');
  let churnNewText = '';
  if (newCount) {
    const isAccepted = resolved.accepted['churn.new.reason'];
    const slotText = resolved.text['churn.new.reason'];
    const sentence = finalize({
      ...makeSentence(w => {
        let base = `${cmpTerm}新进 ${w.num(newCount)} 个项目`;
        if (returned) base += `，其中回归 ${w.num(returned)} 个`;
        return base;
      }),
      slotIds: ['churn.new.reason'],
    }, 'churnNewText', slotText, isAccepted);
    renderEntries.push(...sentence.entries);
    churnNewText = sentence.text;
  }
  let churnDropText = '';
  if (dropped) {
    const isAccepted = resolved.accepted['churn.drop.reason'];
    const slotText = resolved.text['churn.drop.reason'];
    let prevBrief = prevDate ? history.readDailyBrief(prevDate) : null;
    const scrapedAt = brief.scrapedAt || brief.generatedAt;
    if (!prevBrief && scrapedAt && typeof history.getBaselineSnapshot === 'function') {
      const baseline = history.getBaselineSnapshot(scrapedAt);
      if (baseline) prevBrief = baseline.brief;
    }
    const dropDetails = buildChurnDropDetails(brief, prevBrief);

    let detailClause = '';
    if (dropDetails && dropDetails.length > 0) {
      const byType = new Map();
      for (const d of dropDetails) {
        const t = d.typeName || '其他';
        if (!byType.has(t)) byType.set(t, []);
        byType.get(t).push(d.shortName);
      }
      const clauses = [];
      for (const [type, names] of byType.entries()) {
        if (names.length > 1) {
          clauses.push(`${names.join('与')} 均为 ${type}类`);
        } else {
          clauses.push(`${names[0]} 为 ${type}类`);
        }
      }
      detailClause = `，其中 ${clauses.join('，')}`;
    }

    const cleanSlotText = (isAccepted && slotText && slotText.trim() && slotText !== DEFAULT_PHRASES.reason && !slotText.includes('可结合项目描述理解'))
      ? slotText.trim()
      : null;

    const sentence = finalize({
      ...makeSentence(w => `${cmpTerm}掉榜 ${w.num(dropped)} 个项目${detailClause}`),
      slotIds: ['churn.drop.reason'],
    }, 'churnDropText', cleanSlotText, Boolean(cleanSlotText));
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
    version: 'r9',
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
