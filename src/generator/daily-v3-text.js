'use strict';

const { loadConfig } = require('../checker/config');

const SLOT_TYPES = {
  reason: { maxLength: 30 },
  descShortZh: { maxLength: 14 },
  descZh: { maxLength: 60 },
};

const DEFAULT_PHRASES = {
  reason: '可结合项目描述理解',
  descShortZh: '项目简介待补充',
  descZh: '暂无中文说明',
};

const GLOBAL_SLOT_IDS = [
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
  };
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

function buildTrendCandidates(index) {
  const candidates = [];

  const total = index.total('total_projects');
  const ai = index.total('ai_projects');
  if (total && ai) {
    candidates.push({ ...makeSentence(w => `今日 ${w.num(total)} 个上榜项目中，AI 项目 ${w.num(ai)} 个`), slotId: 'trend.composition.reason' });
  }

  const totalToday = index.total('total_today');
  if (totalToday) {
    const previous = index.total('prev_total_today');
    const direction = index.direction('total_today', '较昨日');
    candidates.push({
      ...makeSentence(w => {
        let base = `当日新增星合计 ${w.num(totalToday)} 星`;
        if (previous) base += `，较上一有数据日 ${w.num(previous)} 星`;
        if (direction) base += `，${w.dir(direction)}`;
        return base;
      }),
      slotId: 'trend.momentum.reason',
    });
  }

  const hotCount = index.total('hot_count');
  if (hotCount) {
    candidates.push({
      ...makeSentence(w => `高热项目 ${w.num(hotCount)} 个`),
      slotId: 'trend.hot.reason',
    });
  }

  const newCount = index.total('new');
  const dropped = index.total('dropped');
  const kept = index.total('kept');
  const retention = index.total('retention_rate');
  if (newCount && dropped && kept && retention) {
    candidates.push({
      ...makeSentence(w => `较上一有数据日，新进 ${w.num(newCount)} 个、掉榜 ${w.num(dropped)} 个，连续在榜 ${w.num(kept)} 个，留存率 ${w.num(retention)}%`),
      slotId: 'trend.churn.reason',
    });
  }

  const maxStreak = index.maxStreak();
  if (maxStreak) {
    candidates.push({
      ...makeSentence(w => `连续在榜最长 ${w.num(maxStreak)} 天`),
      slotId: 'trend.streak.reason',
    });
  }

  const categoryShare = index.total('category_share');
  const languageShare = index.total('language_share');
  const share = categoryShare || languageShare;
  if (share) {
    const metric = categoryShare ? 'category_share' : 'language_share';
    const direction = index.direction(metric, '较上一有数据日');
    const nameMatch = /「(.+?)」/.exec(String(share.label || ''));
    const name = nameMatch ? nameMatch[1] : '头部';
    candidates.push({
      ...makeSentence(w => {
        let base = `头部${categoryShare ? '类目' : '语言'}「${name}」份额 ${w.num(share)}%`;
        if (direction) base += `，较上一有数据日${w.dir(direction)}`;
        return base;
      }),
      slotId: 'trend.distribution.reason',
    });
  }

  return candidates;
}

function buildAnalysisCandidates(index) {
  const candidates = [];

  const total = index.total('total_projects');
  const ai = index.total('ai_projects');
  if (total && ai) {
    candidates.push({ ...makeSentence(w => `今日榜单共 ${w.num(total)} 个项目，其中 AI 项目 ${w.num(ai)} 个`), slotId: 'analysis.composition.reason' });
  }

  const totalToday = index.total('total_today');
  if (totalToday) {
    const previous = index.total('prev_total_today');
    const average = index.total('avg7_total_today');
    const dayDirection = index.direction('total_today', '较昨日');
    const avgDirection = index.direction('total_today', '较7日均值');
    candidates.push({
      ...makeSentence(w => {
        let base = `当日新增星合计 ${w.num(totalToday)} 星`;
        if (previous) base += `，较上一有数据日 ${w.num(previous)} 星`;
        if (dayDirection) base += `，${w.dir(dayDirection)}`;
        if (average) base += `；较 7 日均值 ${w.num(average)} 星`;
        if (avgDirection) base += `，${w.dir(avgDirection)}`;
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

function buildProjectTexts(names, slots, config, regex, logger) {
  const texts = [];
  const usedDefaults = [];

  for (const name of names) {
    const descId = `project.${name}.descZh`;
    const descSpec = slotSpecFor(descId);
    const descCheck = checkSlotText(slots?.[descId], descSpec, config, regex);
    const descZh = descCheck.ok ? descCheck.text : DEFAULT_PHRASES.descZh;
    if (!descCheck.ok) {
      usedDefaults.push({ slotId: descId, reason: descCheck.reason });
      if (typeof logger.warn === 'function') logger.warn(`[daily-v3-text] 槽位${descCheck.reason}，使用缺省短语：${descId}`);
    }

    const shortId = `project.${name}.descShortZh`;
    const shortSpec = slotSpecFor(shortId);
    const shortCheck = checkSlotText(slots?.[shortId], shortSpec, config, regex);
    const descShortZh = shortCheck.ok ? shortCheck.text : DEFAULT_PHRASES.descShortZh;
    if (!shortCheck.ok) {
      usedDefaults.push({ slotId: shortId, reason: shortCheck.reason });
      if (typeof logger.warn === 'function') logger.warn(`[daily-v3-text] 槽位${shortCheck.reason}，使用缺省短语：${shortId}`);
    }

    texts.push({ fullName: name, descShortZh, descZh });
  }

  return { projects: texts, usedDefaults };
}

function buildDailyV3Text(options = {}) {
  const brief = options.brief || {};
  const config = options.config || loadConfig();
  const logger = options.logger || require('../utils/logger');
  const regex = wordRegex(config);
  const specs = buildSlotSpecs({ brief });
  const resolved = resolveSlots(options.slots, specs, { config, logger, regex });

  const index = indexFacts(options.facts);
  const renderEntries = [];

  const trends = buildTrendCandidates(index).slice(0, 5).map((candidate, position) => {
    const slotText = resolved.text[candidate.slotId] || DEFAULT_PHRASES.reason;
    const sentence = finalize({ ...candidate, slotIds: [candidate.slotId] }, `trends[${position}].text`, slotText);
    renderEntries.push(...sentence.entries);
    return { text: sentence.text, slotIds: sentence.slotIds };
  });

  const analysis = buildAnalysisCandidates(index).slice(0, 4).map(candidate => {
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
        let base = `较上一有数据日新进 ${w.num(newCount)} 个项目`;
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
      ...makeSentence(w => `较上一有数据日掉榜 ${w.num(dropped)} 个项目`),
      slotIds: ['churn.drop.reason'],
    }, 'churnDropText', resolved.text['churn.drop.reason'] || DEFAULT_PHRASES.reason);
    renderEntries.push(...sentence.entries);
    churnDropText = sentence.text;
  }

  const projectTexts = buildProjectTexts(
    projectNames({ brief }),
    options.slots,
    config,
    regex,
    logger
  );

  const projectSlots = {};
  for (const item of projectTexts.projects) {
    projectSlots[`project.${item.fullName}.descShortZh`] = item.descShortZh;
    projectSlots[`project.${item.fullName}.descZh`] = item.descZh;
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
  wordRegex,
  stripMetricNames,
};
