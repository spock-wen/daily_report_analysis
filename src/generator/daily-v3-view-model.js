'use strict';

const fs = require('fs');
const nodePath = require('path');
const mustache = require('mustache');
const history = require('../metrics/history');
const paths = require('../utils/path');
const { DEFAULT_PHRASES, computeHypeIndex, defaultProjectText, stripRepoPrefix, buildDefaultOneSentence, isPrevYesterday } = require('./daily-v3-text');
const { normalizeCjkSpacing, pickProjectBlurb, ratioPhrase } = require('./daily-v3-copy');

const TEMPLATE_DIR = nodePath.join(__dirname, '..', '..', 'templates', 'daily-v3');
const TEMPLATE_PATH = nodePath.join(TEMPLATE_DIR, 'daily.mustache');
const CSS_PATH = nodePath.join(TEMPLATE_DIR, 'site.css');

const COLORS = {
  ink: '#2B2118',
  sub: '#6B5B4B',
  primary: '#C2410C',
  accent: '#0F766E',
  up: '#0F766E',
  down: '#B91C1C',
  other: '#C9B79C',
  langPalette: ['#C2410C', '#E9A23B', '#0F766E', '#7C9A92', '#8B5E3C'],
  typePalette: ['#0F766E', '#C2410C', '#E9A23B', '#7C9A92', '#8B5E3C'],
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = /^([+-]?[\d.]+)\s*(亿|万|千|[kKwW])?$/.exec(String(value).trim());
  if (!match) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'k' || unit === '千') return number * 1000;
  if (unit === 'w' || unit === '万') return number * 10000;
  if (unit === '亿') return number * 100000000;
  return number;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateShort(date) {
  return String(date || '').slice(5);
}

function formatLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const utc8 = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${pad(utc8.getUTCMonth() + 1)}-${pad(utc8.getUTCDate())} `
    + `${pad(utc8.getUTCHours())}:${pad(utc8.getUTCMinutes())}`;
}

function formatCount(value) {
  const number = toNumber(value);
  if (number === null) return '—';
  return Math.round(number).toLocaleString('en-US');
}

function formatK(value) {
  const thousands = value / 1000;
  if (Number.isInteger(thousands)) return `${thousands}k`;
  return `${round1(thousands).toFixed(1)}k`;
}

function formatMetric(key, value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (key === 'avg' || key === 'avgStars') return formatK(value);
  if (Number.isInteger(value) || Math.abs(value) >= 100) return Math.round(value).toLocaleString('en-US');
  return String(round1(value));
}

function projectKey(project) {
  return project?.fullName || project?.repo || project?.name || null;
}

function projectShortName(project) {
  const key = projectKey(project) || '';
  return key.includes('/') ? key.split('/').slice(1).join('/') : key;
}

function anchorOf(name) {
  return `p-${String(name || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}`;
}

function average(values) {
  const usable = values.filter(value => value !== null && value !== undefined && Number.isFinite(value));
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

const CHINESE_RE = /[\u4e00-\u9fa5]/;

function hasChinese(value) {
  return CHINESE_RE.test(String(value === undefined || value === null ? '' : value));
}

function pickChinese(...values) {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text && hasChinese(text)) return text;
  }
  return null;
}

function factList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.facts)) return value.facts;
  return [];
}

function factValue(facts, role) {
  const fact = factList(facts).find(item => item && item.role === role);
  return fact ? Number(fact.value) : null;
}

function heroReasonOf(insights) {
  const text = pickChinese(insights?.slots?.['hero.reason']);
  return text && !/\d/.test(text) ? text : DEFAULT_PHRASES.heroReason;
}

function buildHero({ projects, stats, streakDays, facts, reason }) {
  const entries = [];
  const factOf = (role, project = null) => factList(facts)
    .find(fact => fact && fact.role === role && (fact.project || null) === project) || null;
  const record = (text, fact) => {
    const entry = { path: 'hero.lead', text: String(text) };
    if (fact && fact.id !== undefined && fact.id !== null) {
      entry.factId = fact.id;
      entry.role = fact.role || null;
    }
    entries.push(entry);
    return text;
  };

  const totalProjects = toNumber(stats.totalProjects) ?? projects.length;
  const totalToday = projects.reduce((sum, project) => sum + (toNumber(project.todayStars) || 0), 0);
  const top = projects[0] || null;
  const topName = projectKey(top) || '';
  const topToday = toNumber(top?.todayStars) || 0;
  const topStreak = toNumber(streakDays?.[topName]);
  const topDays = topStreak !== null && topStreak >= 1 ? topStreak : 1;

  let lead;
  if (projects.length) {
    lead = `今日 ${record(formatCount(totalProjects), factOf('total_projects'))} 个项目上榜，`
      + `新增星合计 ${record(formatCount(totalToday), factOf('total_today'))} 星；`
      + `${topName} 以 ${record(formatCount(topToday), factOf('today_stars', topName))} 星居首，`
      + `已连续在榜 ${record(topDays, factOf('streak', topName))} 天。`;
  } else {
    lead = '今日暂无上榜项目。';
  }

  return {
    hero: {
      lead,
      reason,
      totalProjects: formatCount(totalProjects),
      totalToday: formatCount(totalToday),
      topProject: topName || '—',
      topTodayStars: formatCount(topToday),
      streakDays: topDays,
    },
    entries,
  };
}

function snapshotOf(brief) {
  const projects = brief?.projects || [];
  const stats = brief?.stats || {};
  const totalProjects = toNumber(stats.totalProjects) ?? projects.length;
  const aiProjects = toNumber(stats.aiProjects) ?? projects.filter(project => project.isAI).length;
  const avgStars = toNumber(stats.avgStars)
    ?? average(projects.map(project => toNumber(project.stars)));
  const totalToday = projects.reduce((sum, project) => sum + (toNumber(project.todayStars) || 0), 0);
  const hotCount = projects.filter(project => (toNumber(project.todayStars) || 0) > 100).length;
  const maxToday = projects.reduce((max, project) => Math.max(max, toNumber(project.todayStars) || 0), 0);
  return { totalProjects, aiProjects, totalToday, avgStars, hotCount, maxToday };
}

function namesOf(brief) {
  return new Set((brief?.projects || []).map(projectKey).filter(Boolean));
}

function setDiff(currentProjects, previousBrief) {
  const currentNames = new Set((currentProjects || []).map(projectKey).filter(Boolean));
  const previousNames = namesOf(previousBrief);
  const added = [...currentNames].filter(name => !previousNames.has(name));
  const kept = [...currentNames].filter(name => previousNames.has(name));
  const dropped = [...previousNames].filter(name => !currentNames.has(name));
  return { added, kept, dropped };
}

// WCAG 2.x 相对亮度 / 对比度：堆叠条块内字色取白或深色中对比度更高者。
function relativeLuminance(hexColor) {
  const hex = String(hexColor).replace('#', '');
  const rgb = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = rgb.map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(hex1, hex2) {
  const first = relativeLuminance(hex1);
  const second = relativeLuminance(hex2);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function pickTextColor(background) {
  const white = '#FFFFFF';
  const dark = COLORS.ink;
  return contrastRatio(background, white) >= contrastRatio(background, dark) ? white : dark;
}

function sparkOf(values) {
  if (!Array.isArray(values) || values.length < 2) return null;
  const width = 120;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = (max - min) || 1;
  const points = values.map((value, index) => {
    const x = 4 + index * (width - 8) / (values.length - 1);
    const y = height - 4 - (value - min) / span * (height - 8);
    return [x, y];
  });
  const last = points[points.length - 1];
  return {
    w: width,
    h: height,
    points: points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    lx: last[0].toFixed(1),
    ly: last[1].toFixed(1),
    color: COLORS.primary,
    dot: COLORS.accent,
  };
}

function directionOf(delta) {
  if (delta > 0) return { cls: 'up', arrow: '▲' };
  if (delta < 0) return { cls: 'dn', arrow: '▼' };
  return { cls: 'eq', arrow: '＝' };
}

function buildMetrics({ series, priorSnapshots, prevSnapshot = null, isYesterday = true }) {
  const current = series[series.length - 1];
  const previous = prevSnapshot || (series.length > 1 ? series[series.length - 2] : null);
  const priorCount = priorSnapshots.length;
  const prevLabel = isYesterday ? '较昨日' : '较上期';

  const metrics = [
    { key: 'totalProjects', label: '上榜项目' },
    { key: 'aiProjects', label: 'AI 项目' },
    { key: 'totalToday', label: '今日新增星合计' },
    { key: 'avgStars', label: '平均总星' },
  ].map(definition => {
    const values = series.map(item => item[definition.key]);
    const now = current[definition.key];
    const yesterday = previous ? previous[definition.key] : null;
    const dayDelta = yesterday === null || now === null ? null : now - yesterday;
    const dayDirection = dayDelta === null ? { cls: '', arrow: '' } : directionOf(dayDelta);
    return {
      label: definition.label,
      value: formatMetric(definition.key, now),
      spark: priorCount >= 2 ? sparkOf(values) : null,
      prevLabel,
      dYCls: dayDirection.cls,
      dYArrow: dayDirection.arrow,
      dYText: dayDelta === null ? '' : formatMetric(definition.key, Math.abs(dayDelta)),
    };
  });

  return { metrics, prevLabel };
}

function buildSparkNote({ seriesDates, priorDates, priorCount }) {
  if (seriesDates.length >= 2 && priorCount >= 2) {
    return `小走势线为近 ${seriesDates.length} 份快照（${seriesDates[0]}～${seriesDates[seriesDates.length - 1]}）。`;
  }
  return '样本不足，暂不绘制走势线。';
}

function buildBars(projects, descShortOf) {
  const sorted = projects
    .slice()
    .sort((left, right) => (toNumber(right.todayStars) || 0) - (toNumber(left.todayStars) || 0));
  const top = sorted.slice(0, 8);
  const max = toNumber(top[0]?.todayStars) || 0;
  const bars = top.map((project, index) => {
    const value = toNumber(project.todayStars) || 0;
    return {
      name: projectShortName(project),
      desc: (typeof descShortOf === 'function' ? descShortOf(project) : '')
        || DEFAULT_PHRASES.descShortZh,
      pct: max > 0 ? (value / max * 100).toFixed(1) : '0.0',
      color: index === 0 ? COLORS.accent : COLORS.primary,
      value: formatCount(value),
    };
  });

  let note = '';
  if (sorted.length >= 2) {
    const first = toNumber(sorted[0].todayStars) || 0;
    const second = toNumber(sorted[1].todayStars) || 0;
    if (second > 0) {
      note = `${projectShortName(sorted[0])} 新增星是第二名的 ${(first / second).toFixed(1)} 倍。`;
    } else {
      note = `${projectShortName(sorted[0])} 今日新增星最高。`;
    }
  }
  return { bars, note };
}

function distributionRows({ todayProjects, previousProjects, selector, palette, isYesterday = true }) {
  const countsFor = projects => {
    const counts = new Map();
    for (const project of projects || []) {
      const key = hasValue(selector(project)) ? selector(project) : '未标注';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  };

  const todayCounts = countsFor(todayProjects);
  const previousCounts = countsFor(previousProjects);
  const combined = new Map();
  for (const [key, count] of [...todayCounts, ...previousCounts]) {
    combined.set(key, (combined.get(key) || 0) + count);
  }
  const ranked = [...combined.entries()].sort((left, right) => right[1] - left[1]);
  const head = ranked.slice(0, 5).map(([name]) => name);
  const colorOf = new Map(head.map((name, index) => [name, palette[index % palette.length]]));
  const others = ranked.slice(5).map(([name]) => name);

  const makeRow = (label, counts, total) => {
    const segs = [];
    for (const name of head) {
      const count = counts.get(name) || 0;
      if (!count) continue;
      const color = colorOf.get(name);
      segs.push({ n: count, color, textColor: pickTextColor(color) });
    }
    const headTotal = head.reduce((sum, name) => sum + (counts.get(name) || 0), 0);
    if (total - headTotal > 0) {
      segs.push({ n: total - headTotal, color: COLORS.other, textColor: pickTextColor(COLORS.other) });
    }
    return { label, segs };
  };

  const rows = [];
  if (previousProjects && previousProjects.length) {
    const prevLabel = isYesterday ? '昨日' : '上期';
    rows.push(makeRow(prevLabel, previousCounts, previousProjects.length));
  }
  rows.push(makeRow('今日', todayCounts, todayProjects.length));

  const legend = head
    .filter(name => (todayCounts.get(name) || 0) + (previousCounts.get(name) || 0) > 0)
    .map(name => ({ name, color: colorOf.get(name) }));
  if (others.some(name => (todayCounts.get(name) || 0) + (previousCounts.get(name) || 0) > 0)) {
    legend.push({ name: '其他', color: COLORS.other });
  }

  return { rows, legend, head, counts: { today: todayCounts, previous: previousCounts } };
}

function buildLangNote({ distribution, previousProjects, isYesterday = true }) {
  const languages = distribution.head;
  if (!languages.length) return '';
  let top = languages[0];
  let bestToday = -1;
  for (const name of languages) {
    const count = distribution.counts.today.get(name) || 0;
    if (count > bestToday) {
      bestToday = count;
      top = name;
    }
  }
  const today = distribution.counts.today.get(top) || 0;
  if (!previousProjects || !previousProjects.length) {
    return `今日 ${top} 项目 ${today} 个，数量最多。`;
  }
  const yesterday = distribution.counts.previous.get(top) || 0;
  const prevTarget = isYesterday ? '昨日' : '上期';
  if (today > yesterday) return `${top} 由${prevTarget} ${yesterday} 个增至 ${today} 个。`;
  if (today < yesterday) return `${top} 由${prevTarget} ${yesterday} 个降至 ${today} 个。`;
  return `${top} ${prevTarget}与今日均为 ${today} 个。`;
}

function capitalize(text) {
  const value = String(text || '');
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function returnedCountFor(date, addedNames) {
  if (!addedNames || !addedNames.length || !date) return 0;
  const seen = new Set();
  for (const entry of history.getRecentDailyEntries(date, 30)) {
    for (const name of namesOf(entry.brief)) seen.add(name);
  }
  return addedNames.filter(name => seen.has(name)).length;
}

function retentionBetween(currentBrief, previousBrief) {
  if (!previousBrief) return null;
  const previousTotal = (previousBrief.projects || []).length;
  if (!previousTotal) return null;
  const diff = setDiff(currentBrief.projects || [], previousBrief);
  return round1(diff.kept.length / previousTotal * 100);
}

function newFaceBetween(currentBrief, previousBrief) {
  if (!currentBrief || !previousBrief) return null;
  const currentTotal = (currentBrief.projects || []).length;
  if (!currentTotal) return null;
  const diff = setDiff(currentBrief.projects || [], previousBrief);
  const date = currentBrief.date || currentBrief.scrapedAt;
  const returned = returnedCountFor(date, diff.added);
  return round1(Math.max(0, diff.added.length - returned) / currentTotal * 100);
}

function buildCmp({
  currentSnapshot,
  priorSnapshots,
  previousBrief,
  previousDate,
  monthEntry,
  topCategory,
  topLanguage,
  currentRetention,
  currentNewFace,
  priorEntries,
  baselineSnapshots = [],
  isYesterday = true,
  facts,
}) {
  const cmpTitle = isYesterday ? '和昨天比' : '和上期比';
  const prevSnapshot = previousBrief ? snapshotOf(previousBrief) : null;
  const monthSnapshot = monthEntry ? snapshotOf(monthEntry.brief) : null;
  const avgOf = key => (priorSnapshots.length >= 2
    ? average(priorSnapshots.map(item => item[key]))
    : null);
  const avgShare = (selector, name) => {
    if (priorSnapshots.length < 2 || !name) return null;
    return average(priorEntries.map(entry => shareOf(entry.brief?.projects || [], selector, name)));
  };
  const prevDateLabel = previousDate ? dateShort(previousDate) : '—';
  const monthDateLabel = monthEntry ? dateShort(monthEntry.date) : '—';
  const avgMissing = priorSnapshots.length < 2 ? '不足 7 天' : null;

  const refsFor = (currentValue, prevValue, formatter) => {
    const makeRef = (lab, value, missingText = null) => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return { lab, missing: true, missingText };
      }
      const text = directionText(currentValue, value);
      return { lab, value: formatter(value), dirText: text, dirCls: DIRECTION_CLASS[text] || '' };
    };
    return [
      makeRef(`上期 ${prevDateLabel}`, prevValue),
    ];
  };

  const countFormat = value => formatMetric('count', value);
  const avgFormat = value => formatMetric('avg', value);
  const shareFormat = value => formatShare(value);

  const rows = [
    {
      label: '上榜项目数',
      now: formatCount(currentSnapshot.totalProjects),
      refs: refsFor(currentSnapshot.totalProjects, prevSnapshot?.totalProjects, countFormat),
    },
    {
      label: 'AI 项目数',
      now: formatCount(currentSnapshot.aiProjects),
      refs: refsFor(currentSnapshot.aiProjects, prevSnapshot?.aiProjects, countFormat),
    },
    {
      label: '平均 Stars',
      now: avgFormat(currentSnapshot.avgStars),
      refs: refsFor(currentSnapshot.avgStars, prevSnapshot?.avgStars, avgFormat),
    },
    {
      label: '高热项目数',
      now: formatCount(currentSnapshot.hotCount),
      refs: refsFor(currentSnapshot.hotCount, prevSnapshot?.hotCount, countFormat),
    },
    {
      label: '当日新增星合计',
      now: formatCount(currentSnapshot.totalToday),
      refs: refsFor(currentSnapshot.totalToday, prevSnapshot?.totalToday, countFormat),
    },
    {
      label: '最大单项目新增',
      now: formatCount(currentSnapshot.maxToday),
      refs: refsFor(currentSnapshot.maxToday, prevSnapshot?.maxToday, countFormat),
    },
  ];

  if (topCategory) {
    const selector = project => project.analysis?.typeName;
    rows.push({
      label: `${capitalize(topCategory.name)} 类目份额`,
      now: shareFormat(topCategory.share),
      refs: refsFor(topCategory.share,
        previousBrief ? shareOf(previousBrief.projects || [], selector, topCategory.name) : null,
        shareFormat),
    });
  }

  if (topLanguage) {
    const selector = project => project.language;
    rows.push({
      label: `${topLanguage.name} 语言份额`,
      now: shareFormat(topLanguage.share),
      refs: refsFor(topLanguage.share,
        previousBrief ? shareOf(previousBrief.projects || [], selector, topLanguage.name) : null,
        shareFormat),
    });
  }

  const allSnapshots = baselineSnapshots.length ? baselineSnapshots : priorEntries;
  // facts 里有上期份额/留存等数值时一律以 facts 为准，只有缺失才回退到快照推算。
  const prevRetention = factValue(facts, 'prev_retention_rate')
    ?? (previousBrief && allSnapshots[1]
      ? retentionBetween(previousBrief, allSnapshots[1].brief)
      : null);
  const prevNewFace = factValue(facts, 'prev_new_face_rate')
    ?? (previousBrief && allSnapshots[1]
      ? newFaceBetween(previousBrief, allSnapshots[1].brief)
      : null);
  const nowRetention = factValue(facts, 'retention_rate') ?? currentRetention;
  const nowNewFace = factValue(facts, 'new_face_rate') ?? currentNewFace;

  rows.push({
    label: '留存率',
    now: shareFormat(nowRetention),
    refs: refsFor(nowRetention, prevRetention, shareFormat),
  });
  rows.push({
    label: '新面孔率',
    now: shareFormat(nowNewFace),
    refs: refsFor(nowNewFace, prevNewFace, shareFormat),
  });

  return {
    title: cmpTitle,
    navLabel: cmpTitle,
    navText: cmpTitle,
    prevDateLabel: prevDateLabel === '—' ? '无基准' : `${prevDateLabel}（本期之前最近一份快照）`,
    prevDateShort: prevDateLabel,
    rows,
    caption: '高热＝今日新增超过 100 星。',
  };
}

function buildSlope(todayProjects, previousProjects, isYesterday = true, returnedNames = new Set()) {
  if (!previousProjects || !previousProjects.length || !todayProjects.length) return null;
  const previousRank = new Map(previousProjects.map((project, index) => [projectKey(project), index + 1]));
  const y = rank => 26 + (rank - 1) * 22;
  const lines = [];
  const startDots = [];
  const endDots = [];
  const rankRows = [];
  const colPrev = isYesterday ? '昨日' : '上期';
  const prevPrefix = isYesterday ? '昨' : '上期';

  todayProjects.slice(0, 10).forEach((project, index) => {
    const rank = index + 1;
    const name = projectKey(project);
    const previous = previousRank.get(name);
    if (previous === undefined) {
      lines.push({ x1: 200, y1: y(rank), x2: 260, y2: y(rank), color: COLORS.accent, dash: true });
      endDots.push({ cx: 260, cy: y(rank), color: COLORS.accent, ty: y(rank) + 4, rank });
      const fullName = project?.fullName || name;
      const isReturned = project.tag === '回归' || returnedNames.has(name) || returnedNames.has(fullName);
      const labelText = isReturned ? '回归' : '新上榜';
      const cls = isReturned ? 'ret' : 'new';
      rankRows.push({ r: rank, name: projectShortName(project), prev: `${prevPrefix} —`, cls, text: labelText });
      return;
    }
    const delta = previous - rank;
    const cls = delta > 0 ? 'up' : delta < 0 ? 'dn' : 'eq';
    const text = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '持平';
    const color = delta > 0 ? COLORS.up : delta < 0 ? COLORS.down : COLORS.sub;
    lines.push({ x1: 40, y1: y(previous), x2: 260, y2: y(rank), color, dash: false });
    startDots.push({ cx: 40, cy: y(previous), color });
    endDots.push({ cx: 260, cy: y(rank), color, ty: y(rank) + 4, rank });
    rankRows.push({ r: rank, name: projectShortName(project), prev: `${prevPrefix} ${previous}`, cls, text });
  });

  return {
    slope: {
      w: 300,
      h: 26 + 12 * 22 + 12,
      sub: COLORS.sub,
      ink: COLORS.ink,
      colPrev,
      colToday: '本期',
      lines,
      startDots,
      endDots,
    },
    rankRows,
  };
}

function formatShare(value) {
  return value === null || value === undefined ? '—' : `${round1(value)}%`;
}

function topShare(projects, selector) {
  const total = (projects || []).length;
  if (!total) return null;
  const counts = new Map();
  for (const project of projects) {
    const key = selector(project);
    if (!hasValue(key)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  if (!best) return null;
  return { name: best.name, count: best.count, share: round1(best.count / total * 100) };
}

function shareOf(projects, selector, name) {
  const total = (projects || []).length;
  if (!total || !name) return null;
  return round1(projects.filter(project => selector(project) === name).length / total * 100);
}

function sameDayLastMonth(date, snapshotTime) {
  const month = history.getPrevMonth(String(date || '').slice(0, 7));
  if (!month) return null;
  const target = `${month}-${String(date).slice(8, 10)}`;
  const brief = history.readDailyBrief(target);
  if (!brief) return null;
  const currentScrapedDate = history.getScrapedDate(snapshotTime);
  const targetScrapedDate = history.getScrapedDate(brief.scrapedAt || brief.generatedAt);
  if (currentScrapedDate && targetScrapedDate && targetScrapedDate >= currentScrapedDate) return null;
  return { date: target, brief };
}

function directionText(current, reference) {
  if (current === null || reference === null || current === undefined || reference === undefined) return '';
  if (current > reference) return '上升';
  if (current < reference) return '下降';
  return '持平';
}

const DIRECTION_CLASS = { 上升: 'up', 下降: 'down', 持平: 'flat' };

function buildChurn({ todayProjects, previousBrief, currentUrlOf, returnedNames }) {
  const diff = previousBrief
    ? setDiff(todayProjects, previousBrief)
    : { added: [], kept: [], dropped: [] };
  const previousTotal = previousBrief ? (previousBrief.projects || []).length : 0;
  const keptCount = diff.kept.length;
  const addedCount = diff.added.length;
  const returned = diff.added.filter(name => returnedNames.has(name)).length;
  const total = (todayProjects || []).length;
  const retention = previousTotal ? round1(keptCount / previousTotal * 100) : null;
  const newFace = total ? round1(Math.max(0, addedCount - returned) / total * 100) : null;

  return {
    nums: [
      { value: addedCount, label: '新进' },
      { value: returned, label: '其中回归' },
      { value: keptCount, label: '连续在榜' },
      { value: diff.dropped.length, label: '掉榜' },
      { value: formatShare(retention), label: '留存率' },
      { value: formatShare(newFace), label: '新面孔率' },
    ],
    newCount: addedCount,
    returnedCount: returned,
    keptCount,
    droppedCount: diff.dropped.length,
    new: diff.added.map(name => ({
      fullName: name,
      anchor: anchorOf(name),
      url: currentUrlOf.get(name) || `https://github.com/${name}`,
    })),
    kept: diff.kept.map(name => ({
      fullName: name,
      anchor: anchorOf(name),
      url: currentUrlOf.get(name) || `https://github.com/${name}`,
    })),
    dropped: diff.dropped.map(name => ({ fullName: name, url: `https://github.com/${name}` })),
    retention,
    newFace,
  };
}

function shortNameOf(fullName) {
  const text = String(fullName || '');
  const slash = text.lastIndexOf('/');
  return slash >= 0 ? text.slice(slash + 1) : text;
}

// 掉榜句：`较上期（10-19）掉榜 5 个：a、b 属于 X 类，c 属于 Y 类。`
// 按类目分组、组内顿号、组间逗号，类目取自上一份快照的项目分析结果。
function buildChurnDropText({ dropped, typeNameOf, previousDate }) {
  const list = Array.isArray(dropped) ? dropped : [];
  const prevLabel = previousDate ? `较上期（${dateShort(previousDate)}）` : '较上期';
  if (!list.length) {
    return previousDate
      ? `${prevLabel}无掉榜项目。`
      : '本期无上期基准，不比较掉榜。';
  }
  const groups = new Map();
  for (const item of list) {
    const fullName = typeof item === 'string' ? item : item.fullName;
    const typeName = (typeNameOf && typeNameOf.get(fullName)) || '其他';
    if (!groups.has(typeName)) groups.set(typeName, []);
    groups.get(typeName).push(shortNameOf(fullName));
  }
  const clauses = [...groups.entries()].map(([typeName, names]) => `${names.join('、')} 属于 ${typeName}`);
  return `${prevLabel}掉榜 ${list.length} 个：${clauses.join('，')}。`;
}

// 连续上榜卡片：补上期对比（是上期的 N 倍 / 上期不在榜）。
function buildStreakText({ fullName, days, todayStars, previousToday }) {
  const base = `${fullName} 连续 ${days} 天在榜，今日新增 ${formatCount(todayStars)} 星`;
  if (previousToday === null || previousToday === undefined || previousToday <= 0) {
    return `${base}，上期不在榜。`;
  }
  const ratio = round2(todayStars / previousToday);
  if (ratio === 1) return `${base}，与上期持平。`;
  return `${base}，是上期的 ${ratio} 倍。`;
}

// trends[0]：`今日 13 个上榜项目中，AI 项目 10 个，与上期持平；Agent 系统项目从上期 8 个增至 10 个，份额从 66.7% 升到 76.9%。`
function buildCompositionTrend({ projects, previousProjects, aiProjects, totalProjects, prevAiProjects, hasPrev }) {
  if (!totalProjects) return null;
  const aiDelta = prevAiProjects === null ? null : aiProjects - prevAiProjects;
  const aiTail = aiDelta === null
    ? ''
    : (aiDelta === 0 ? '与上期持平' : (aiDelta > 0 ? `较上期多 ${aiDelta} 个` : `较上期少 ${-aiDelta} 个`));

  const countOf = (list, name) => (list || []).filter(project => (project.analysis?.typeName || null) === name).length;
  const shareOf = (count, total) => (total > 0 ? round1(count / total * 100) : null);
  const typeNames = [...new Set((projects || []).map(project => project.analysis?.typeName).filter(Boolean))];
  const ranked = typeNames
    .map(name => ({ name, count: countOf(projects, name) }))
    .sort((left, right) => right.count - left.count);
  const top = ranked[0] || null;
  const prevCount = top ? countOf(previousProjects, top.name) : null;

  let typeTail = '';
  if (top && hasPrev && prevCount !== null && prevCount !== top.count) {
    const prevShare = shareOf(prevCount, (previousProjects || []).length);
    const nowShare = shareOf(top.count, totalProjects);
    const rising = top.count > prevCount;
    typeTail = `；${top.name}项目从上期 ${prevCount} 个${rising ? '增至' : '减至'} ${top.count} 个`
      + `，份额从 ${prevShare}% ${nowShare > prevShare ? '升' : '降'}到 ${nowShare}%`;
  } else if (top && hasPrev && prevCount === top.count) {
    typeTail = `；${top.name}项目 ${top.count} 个，与上期持平`;
  }

  return `今日 ${totalProjects} 个上榜项目中，AI 项目 ${aiProjects} 个${aiTail ? `，${aiTail}` : ''}${typeTail}。`;
}

// 深度分析：`今日新增星合计 14,517 星，比上期（10-19）多 3,266 星，前 3 名占了一半（7,138 星）。新进 6 个里有 4 个是回归项目，其中 security-audit-skill 一回来就排到第 2；留存率 58.3%，比上期的 8 个连续在榜少了 1 个。`
function buildDeepAnalysis({
  projects, churn, returnedNames, previousDate, previousShort,
  totalToday, prevTotalToday, retention, prevKept, keptCount,
}) {
  if (!totalToday) return null;
  const parts = [];
  const prevLabel = previousDate ? `（${dateShort(previousDate)}）` : '';
  if (prevTotalToday === null || prevTotalToday === undefined) {
    parts.push(`今日新增星合计 ${formatCount(totalToday)} 星`);
  } else {
    const delta = totalToday - prevTotalToday;
    const deltaText = delta === 0
      ? `与上期${prevLabel}持平`
      : (delta > 0 ? `比上期${prevLabel}多 ${formatCount(delta)} 星` : `比上期${prevLabel}少 ${formatCount(-delta)} 星`);
    parts.push(`今日新增星合计 ${formatCount(totalToday)} 星，${deltaText}`);
  }

  const sorted = [...projects].sort((left, right) => (toNumber(right.todayStars) || 0) - (toNumber(left.todayStars) || 0));
  const top3 = sorted.slice(0, 3);
  // 「占了一半」用于前 3 名合计达到当日新增约一半（≥45%）的情形，否则如实写百分比。
  let top3Part = null;
  if (top3.length === 3) {
    const top3Sum = top3.reduce((sum, project) => sum + (toNumber(project.todayStars) || 0), 0);
    const share = round1(top3Sum / totalToday * 100);
    top3Part = share >= 45
      ? `前 3 名占了一半（${formatCount(top3Sum)} 星）`
      : `前 3 名占 ${share}%（${formatCount(top3Sum)} 星）`;
  }

  const returnedList = (churn.new || []).filter(item => returnedNames.has(item.fullName));
  const newParts = [];
  if (churn.newCount > 0 && returnedList.length > 0) {
    const rankOf = new Map(projects.map((project, index) => [projectKey(project), index + 1]));
    const best = returnedList
      .map(item => ({ ...item, rank: rankOf.get(item.fullName) || null }))
      .filter(item => item.rank !== null)
      .sort((left, right) => left.rank - right.rank)[0];
    const tail = best
      ? (best.rank <= 3 ? `，其中 ${shortNameOf(best.fullName)} 一回来就排到第 ${best.rank}` : `，其中排名最高的是 ${shortNameOf(best.fullName)}（第 ${best.rank}）`)
      : '';
    newParts.push(`新进 ${churn.newCount} 个里有 ${returnedList.length} 个是回归项目${tail}`);
  } else if (churn.newCount > 0) {
    newParts.push(`新进 ${churn.newCount} 个`);
  }

  const retentionParts = [];
  if (retention !== null && retention !== undefined) {
    if (prevKept === null || prevKept === undefined) {
      retentionParts.push(`留存率 ${retention}%`);
    } else {
      const keptDelta = keptCount - prevKept;
      const keptText = keptDelta === 0
        ? '与上期持平'
        : (keptDelta < 0 ? `比上期的 ${prevKept} 个连续在榜少了 ${-keptDelta} 个` : `比上期的 ${prevKept} 个连续在榜多了 ${keptDelta} 个`);
      retentionParts.push(`留存率 ${retention}%，${keptText}`);
    }
  }

  // 句群：第一句＝合计＋前 3 名（逗号相连）；第二句＝新进/回归＋留存率（分号相连）。
  const sentences = [];
  const head = [parts[0]];
  if (top3Part) head.push(top3Part);
  sentences.push(`${head.join('，')}。`);
  const tailParts = [...newParts, ...retentionParts];
  if (tailParts.length) sentences.push(`${tailParts.join('；')}。`);
  return sentences.join('');
}

// 建议 2：`留意 ruflo（连续 6 天）和 ai-job-search（连续 5 天）：ruflo 今日新增 684 星，比上期多 120 星，但排名从第 5 降到第 9。`
// 排名变化由数据判定：升/降/持平分别写。
function buildStabilityAdvice({ streak, projects, previousRankOf, prevTodayOf }) {
  const list = (Array.isArray(streak) ? streak : []).filter(item => item && item.days >= 2);
  if (list.length < 2) return null;
  const [first, second] = list;
  const rankOf = new Map(projects.map((project, index) => [projectKey(project), index + 1]));
  const rank = rankOf.get(first.fullName);
  const prevRank = previousRankOf && previousRankOf.get ? previousRankOf.get(first.fullName) : null;
  const today = toNumber(first.todayStarsRaw);
  const prevToday = prevTodayOf && prevTodayOf.has(first.fullName) ? prevTodayOf.get(first.fullName) : null;

  let starText = '';
  if (prevToday !== null && prevToday !== undefined && prevToday > 0 && today !== null) {
    const delta = today - prevToday;
    starText = delta === 0
      ? '与上期持平'
      : (delta > 0 ? `比上期多 ${formatCount(delta)} 星` : `比上期少 ${formatCount(-delta)} 星`);
  } else {
    starText = '上期不在榜';
  }

  let rankText = '';
  if (rank && prevRank) {
    if (rank < prevRank) rankText = `，排名还从第 ${prevRank} 升到第 ${rank}`;
    else if (rank > prevRank) rankText = `，但排名从第 ${prevRank} 降到第 ${rank}`;
    else rankText = `，排名与上期持平（第 ${rank}）`;
  } else if (rank) {
    rankText = `，上期不在榜`;
  }

  return `留意 ${shortNameOf(first.fullName)}（连续 ${first.days} 天）和 ${shortNameOf(second.fullName)}（连续 ${second.days} 天）：`
    + `${shortNameOf(first.fullName)} 今日新增 ${formatCount(first.todayStars)} 星，${starText}${rankText}。`;
}

function buildArchive({ date, weekLabel }) {
  const dailyFiles = listReportFiles(nodePath.join(paths.REPORTS_DIR, 'daily'));
  const weeklyFiles = listReportFiles(nodePath.join(paths.REPORTS_DIR, 'weekly'));
  const monthlyFiles = listReportFiles(nodePath.join(paths.REPORTS_DIR, 'monthly'));
  const items = [
    { cls: '', href: '../index.html', label: '首页 · 总览' },
    { cls: '', href: '../weekly/', label: weekLabel },
  ];
  const currentFile = `github-ai-trending-${date}.html`;
  const recent = dailyFiles.length ? dailyFiles : [currentFile];
  for (const file of recent.slice(0, 5)) {
    const match = /^github-ai-trending-(\d{4}-\d{2}-\d{2})\.html$/.exec(file);
    if (!match) continue;
    items.push({
      cls: 'sub',
      href: file,
      label: `${dateShort(match[1])} 日报`,
      cur: match[1] === date,
    });
  }
  if (!items.some(item => item.cls === 'sub')) {
    items.push({ cls: 'sub', href: currentFile, label: `${dateShort(date)} 日报`, cur: true });
  }
  if (weeklyFiles.length) {
    const match = /^github-weekly-(\d{4}-W\d{2})\.html$/.exec(weeklyFiles[0]);
    if (match) items.push({ cls: '', href: weeklyFiles[0], label: `${match[1]} 周报` });
  }
  if (monthlyFiles.length) {
    const match = /^github-monthly-(\d{4}-\d{2})\.html$/.exec(monthlyFiles[0]);
    if (match) items.push({ cls: '', href: monthlyFiles[0], label: `${match[1]} 月报` });
  }
  return items;
}

function listReportFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.html')).sort().reverse();
}

function buildViewModel(data) {
  const hasBrief = data.brief && (data.brief.projects || data.brief.trending_repos);
  const brief = hasBrief ? data.brief : (data.projects || data.trending_repos ? data : {});
  const date = data.date || brief.date;
  const projects = (data.projects || data.trending_repos || brief.projects || brief.trending_repos || [])
    .slice()
    .sort((left, right) => (toNumber(right.todayStars) || 0) - (toNumber(left.todayStars) || 0));
  const stats = data.stats || brief.stats || {};
  const insights = data.aiInsights || data.insights || {};
  const insightProjects = new Map();
  for (const item of Array.isArray(insights.projects) ? insights.projects : []) {
    const name = item?.fullName || item?.repo || item?.project_name;
    if (name) insightProjects.set(name, item);
  }
  const slotOneSentenceOf = project => insightProjects.get(projectKey(project))?.oneSentence;
  const slotDescShortOf = project => insightProjects.get(projectKey(project))?.descShortZh;
  const slotDescZhOf = project => insightProjects.get(projectKey(project))?.descZh;
  const streakDays = data.streakDays || brief.streakDays || {};
  const streakOf = name => {
    const value = toNumber(streakDays[name]);
    return value !== null && value >= 1 ? value : 1;
  };
  const facts = data.facts || brief.facts || insights.facts || [];
  const { hero, entries: heroEntries } = buildHero({
    projects,
    stats,
    streakDays,
    facts,
    reason: heroReasonOf(insights),
  });
  const scrapedAt = data.scrapedAt || brief.scrapedAt || brief.scraped_at
    || brief.generatedAt || brief.generated_at;
  const generatedAt = data.generatedAt || brief.generatedAt || brief.generated_at;

  const currentSnapshot = snapshotOf({ projects, stats });
  const baselineSnapshots = scrapedAt ? history.getBaselineSnapshots(scrapedAt, 8) : [];
  const priorEntries = baselineSnapshots.slice(0, 7);
  const priorSnapshots = priorEntries.map(entry => snapshotOf(entry.brief));
  const previousDate = priorEntries[0]?.date || data.prevDate || brief.dailyDiff?.prevDate || null;
  const isYesterday = isPrevYesterday(date, previousDate);

  const recentPriors = priorEntries.slice(0, 6).reverse();
  const series = [
    ...recentPriors.map(entry => ({ date: entry.date, ...snapshotOf(entry.brief) })),
    { date, ...currentSnapshot },
  ];
  const seriesDates = series.map(item => dateShort(item.date));
  const priorDates = priorEntries.map(entry => dateShort(entry.date)).reverse();

  const { metrics, baseLabel } = buildMetrics({
    series,
    priorSnapshots,
    prevSnapshot: priorSnapshots[0] || null,
    isYesterday,
  });
  const sparkNote = buildSparkNote({
    seriesDates,
    priorDates,
    baseLabel,
    priorCount: priorEntries.length,
  });

  const previousBrief = priorEntries[0]?.brief || null;
  const previousProjects = previousBrief?.projects || [];
  const previousRankNames = namesOf(previousBrief);
  const previousRankOf = new Map(previousProjects.map((project, index) => [projectKey(project), index + 1]));

  const returnedNames = new Set();
  if (previousBrief && date) {
    for (const entry of history.getRecentDailyEntries(date, 30)) {
      for (const name of namesOf(entry.brief)) returnedNames.add(name);
    }
  }

  const { bars, note: barsNote } = buildBars(projects, project => {
    const slotText = slotDescShortOf(project);
    if (slotText) return slotText;
    // 长期项目简介表优先于缺省句（原样输出，不经 AI）
    const blurb = pickProjectBlurb(projectKey(project));
    if (blurb?.descShortZh) return blurb.descShortZh;
    return defaultProjectText(project.analysis?.typeName, 'descShortZh');
  });

  const language = distributionRows({
    todayProjects: projects,
    previousProjects,
    selector: project => project.language,
    palette: COLORS.langPalette,
    isYesterday,
  });
  const type = distributionRows({
    todayProjects: projects,
    previousProjects,
    selector: project => project.analysis?.typeName,
    palette: COLORS.typePalette,
    isYesterday,
  });
  const langNote = buildLangNote({ distribution: language, previousProjects, isYesterday });

  const rank = buildSlope(projects, previousProjects, isYesterday, returnedNames);
  const rankRows = rank?.rankRows || projects.slice(0, 10).map((project, index) => {
    const isReturned = project.tag === '回归' || returnedNames.has(projectKey(project)) || returnedNames.has(project?.fullName);
    return {
      r: index + 1,
      name: projectShortName(project),
      prev: `${isYesterday ? '昨' : '上期'} —`,
      cls: isReturned ? 'ret' : 'new',
      text: isReturned ? '回归' : '新上榜',
    };
  });

  const currentUrlOf = new Map(projects.map(project => [projectKey(project), project.url]));
  const prevTypeNameOf = new Map();
  for (const project of previousBrief?.projects || []) {
    const key = projectKey(project);
    if (key) prevTypeNameOf.set(key, project.analysis?.typeName || null);
  }
  const churn = buildChurn({
    todayProjects: projects,
    previousBrief,
    currentUrlOf,
    returnedNames,
  });

  // 掉榜句：按类目分组、顿号连接、「属于」引出类目，全部由 brief 与上一份快照算出。
  const churnDropText = buildChurnDropText({
    dropped: churn.dropped,
    typeNameOf: prevTypeNameOf,
    previousDate: priorEntries[0]?.date || null,
  });

  const top10 = projects.slice(0, 10);
  const notInPrevTop10 = top10.filter(p => !previousRankNames.has(projectKey(p))).length;
  const returnedInTop10 = top10.filter(p => returnedNames.has(projectKey(p)) || returnedNames.has(p.fullName) || p.tag === '回归').length;
  const newInTop10 = notInPrevTop10 - returnedInTop10;
  let rankSubText = '';
  if (notInPrevTop10 > 0) {
    if (returnedInTop10 > 0 && newInTop10 > 0) {
      rankSubText = `前 10 中 ${notInPrevTop10} 个上期不在榜（${returnedInTop10} 个回归、${newInTop10} 个新上榜）；`;
    } else if (returnedInTop10 > 0) {
      rankSubText = `前 10 中 ${notInPrevTop10} 个为回归项目；`;
    } else {
      rankSubText = `前 10 中 ${notInPrevTop10} 个为新上榜；`;
    }
  }
  const rankNote = `${rankSubText}本期换入 ${churn.newCount} 个、换出 ${churn.droppedCount} 个。`;

  const monthEntry = sameDayLastMonth(date, scrapedAt);
  const cmp = buildCmp({
    currentSnapshot,
    priorSnapshots,
    previousBrief,
    previousDate: priorEntries[0]?.date || null,
    monthEntry,
    topCategory: topShare(projects, project => project.analysis?.typeName),
    topLanguage: topShare(projects, project => project.language),
    currentRetention: churn.retention,
    currentNewFace: churn.newFace,
    priorEntries,
    baselineSnapshots,
    isYesterday,
    facts: data.facts,
  });
  const cmpTitle = isYesterday ? '和昨天比' : '和上期比';

  const projectInsights = new Map();
  for (const item of insights.project_insights || []) {
    const name = item.project_name || item.fullName || item.repo;
    if (name && item.oneSentence) projectInsights.set(name, item.oneSentence);
  }

  const prevTodayOf = new Map();
  for (const project of previousBrief?.projects || []) {
    const key = projectKey(project);
    if (key) prevTodayOf.set(key, toNumber(project.todayStars));
  }
  const streak = projects
    .map(project => {
      const fullName = projectKey(project);
      return {
        fullName,
        anchor: anchorOf(fullName),
        url: project.url || `https://github.com/${fullName}`,
        days: streakOf(fullName),
        todayStars: formatCount(project.todayStars),
        todayStarsRaw: toNumber(project.todayStars) || 0,
        prevToday: prevTodayOf.has(fullName) ? prevTodayOf.get(fullName) : null,
      };
    })
    .filter(item => item.days >= 2)
    .sort((left, right) => right.days - left.days)
    .map(item => ({
      ...item,
      text: buildStreakText(item),
    }));

  const usedOneSentences = new Set();
  const viewProjects = projects.map((project, index) => {
    const fullName = projectKey(project) || '—';
    const days = streakOf(fullName);
    const returned = returnedNames.has(fullName) && !previousRankNames.has(fullName);
    const tag = project.tag
      || (days >= 2 ? `连续 ${days} 天` : previousBrief ? (returned ? '回归' : '新') : '');
    const descZh = stripRepoPrefix(pickChinese(
      pickProjectBlurb(fullName)?.descZh,
      slotDescZhOf(project),
      project.analysis?.descZh
    ) || defaultProjectText(project.analysis?.typeName, 'descZh'), fullName);

    let oneSentenceCandidate = stripRepoPrefix(pickChinese(
      pickProjectBlurb(fullName)?.oneSentence,
      slotOneSentenceOf(project),
      projectInsights.get(fullName)
    ), fullName);

    if (!oneSentenceCandidate
      || oneSentenceCandidate === descZh
      || usedOneSentences.has(oneSentenceCandidate)
      || oneSentenceCandidate.includes(fullName)
      || (fullName.includes('/') && oneSentenceCandidate.includes(fullName.split('/')[1]))) {
      oneSentenceCandidate = buildDefaultOneSentence(project, descZh, usedOneSentences);
    }
    usedOneSentences.add(oneSentenceCandidate);

    return {
      rank: index + 1,
      anchor: anchorOf(fullName),
      url: project.url || `https://github.com/${fullName}`,
      fullName,
      tag,
      tagNew: tag === '新' || tag === '回归',
      oneSentence: oneSentenceCandidate,
      descZh,
      typeName: project.analysis?.typeName || '—',
      language: project.language || '—',
      community: project.analysis?.community?.level || '—',
      todayStars: formatCount(project.todayStars),
      starsFmt: formatCount(project.stars),
      forksFmt: formatCount(project.forks),
      streakText: `${days} 天`,
    };
  });

  const weekLabel = date ? history.getISOWeekId(date) : '';
  const previousShort = dateShort(previousDate);
  const related = [
    previousShort
      ? {
          href: `github-ai-trending-${previousDate}.html`,
          title: `上期日报 ${previousShort}`,
          sub: `${formatCount(previousProjects.length)} 个项目`,
        }
      : null,
    { href: '../weekly/', title: `${weekLabel || '上周'} 周报`, sub: '上周' },
    { href: '../monthly/', title: `${String(date || '').slice(0, 7)} 月报`, sub: '上月' },
    { href: '../wiki/', title: 'Wiki 领域索引', sub: '项目与领域历史' },
  ].filter(Boolean);

  const scrapedAtLocal = formatLocal(scrapedAt);
  const generatedAtLocal = formatLocal(generatedAt);

  const trends = (Array.isArray(insights.trends) ? insights.trends : []).map(item => ({
    text: typeof item === 'string' ? item : String(item?.text || ''),
  }));
  // trends[0]（构成/份额）是程序句：AI 不得自带数字，一律由 brief 与上一份快照算出。
  const compositionTrend = buildCompositionTrend({
    projects,
    previousProjects,
    aiProjects: currentSnapshot.aiProjects,
    totalProjects: currentSnapshot.totalProjects,
    prevAiProjects: priorSnapshots[0] ? (toNumber(priorSnapshots[0].aiProjects) ?? 0) : null,
    hasPrev: Boolean(priorSnapshots[0]),
  });
  if (compositionTrend) {
    if (trends.length) trends[0] = { text: compositionTrend };
    else trends.push({ text: compositionTrend });
  }
  const analysisText = typeof insights.analysis === 'string'
    ? insights.analysis
    : String(insights.analysis?.text || '');
  const advice = (Array.isArray(insights.advice) ? insights.advice : [])
    .slice(0, 3)
    .map(item => ({ text: typeof item === 'string' ? item : String(item?.text || '') }));
  // 建议 2（在榜稳定性）是程序句：排名变化由数据判定为升/降/持平分别写。
  const stabilityAdvice = buildStabilityAdvice({
    streak,
    projects,
    previousRankOf,
    prevTodayOf,
  });
  if (stabilityAdvice) {
    if (advice.length >= 2) advice[1] = { text: stabilityAdvice };
    else advice.push({ text: stabilityAdvice });
  }
  // 深度分析整段是程序句。
  const deepText = buildDeepAnalysis({
    projects,
    churn,
    returnedNames,
    previousDate: priorEntries[0]?.date || null,
    previousShort,
    totalToday: currentSnapshot.totalToday,
    prevTotalToday: priorSnapshots[0] ? (toNumber(priorSnapshots[0].totalToday) ?? null) : null,
    retention: churn.retention,
    // prevKept 只认 facts 里 role==='prev_kept' 的 value（facts 缺失时为 null），不再反推上一份快照。
    prevKept: toNumber(factList(facts).find(fact => fact && fact.role === 'prev_kept')?.value) ?? null,
    keptCount: churn.keptCount,
  });
  const churnNewText = typeof insights.churnNewText === 'string' ? insights.churnNewText : '';
  const churnDropTextProgram = churnDropText;

  const hypeIndex = computeHypeIndex({
    totalProjects: currentSnapshot.totalProjects,
    hotCount: currentSnapshot.hotCount,
    totalToday: currentSnapshot.totalToday,
    avgTotalToday: average(priorSnapshots.map(item => item.totalToday)),
  });

  let leadSub = '';
  if (priorSnapshots[0]) {
    const pProj = toNumber(priorSnapshots[0].totalProjects) ?? 0;
    const pStars = toNumber(priorSnapshots[0].totalToday) ?? 0;
    const dProj = currentSnapshot.totalProjects - pProj;
    const dStars = currentSnapshot.totalToday - pStars;
    if (dProj > 0 && dStars > 0) {
      // 副标题尾句按比例区间由程序选择（过半 / 约三分之二 / 约占四分之三 …），不写死。
      let factTail = `AI 项目${ratioPhrase(currentSnapshot.totalProjects > 0
        ? currentSnapshot.aiProjects / currentSnapshot.totalProjects
        : null)}`;
      if (currentSnapshot.aiProjects <= currentSnapshot.totalProjects / 2) {
        const sortedNow = [...projects].sort((a, b) => (toNumber(b.todayStars) || 0) - (toNumber(a.todayStars) || 0)).slice(0, 3);
        const top3Sum = sortedNow.reduce((sum, item) => sum + (toNumber(item.todayStars) || 0), 0);
        const share = currentSnapshot.totalToday > 0 ? round1(top3Sum / currentSnapshot.totalToday * 100) : null;
        factTail = share === null ? '头部项目带动明显' : `前 3 名贡献了当日新增的 ${share}%`;
      }
      leadSub = `上榜数和新增星都比上期多，${factTail}。`;
    } else if (dProj > 0 && dStars === 0) {
      leadSub = '上榜数比上期增加，新增星与上期持平。';
    } else if (dProj > 0 && dStars < 0) {
      leadSub = '上榜数比上期增加，新增星较上期有所回落。';
    } else if (dProj === 0 && dStars > 0) {
      leadSub = '上榜数与上期持平，新增星较上期有所走强。';
    } else if (dProj === 0 && dStars === 0) {
      leadSub = '上榜数和新增星均与上期持平。';
    } else if (dProj === 0 && dStars < 0) {
      leadSub = '上榜数与上期持平，新增星较上期有所回落。';
    } else if (dProj < 0 && dStars > 0) {
      leadSub = '上榜数比上期减少，新增星较上期有所走强。';
    } else if (dProj < 0 && dStars === 0) {
      leadSub = '上榜数比上期减少，新增星与上期持平。';
    } else {
      leadSub = '上榜数和新增星较上期均有所收缩。';
    }
  } else {
    leadSub = '上榜项目整体结构平稳。';
  }
  const hotRatio = currentSnapshot.totalProjects > 0
    ? currentSnapshot.hotCount / currentSnapshot.totalProjects
    : 0;
  const hotPct = Math.round(hotRatio * 100);
  // 热度理由：hot == total 时用通用模板句，否则如实写占比。热度公式不动。
  const prevHotCount = priorSnapshots[0] ? (toNumber(priorSnapshots[0].hotCount) ?? null) : null;
  const dHot = prevHotCount === null ? null : currentSnapshot.hotCount - prevHotCount;
  let hypeReason;
  if (currentSnapshot.hotCount === currentSnapshot.totalProjects && currentSnapshot.totalProjects > 0) {
    const hotTail = dHot === null
      ? ''
      : (dHot > 0 ? `，比上期多 ${dHot} 个` : (dHot < 0 ? `，比上期少 ${-dHot} 个` : '，与上期持平'));
    hypeReason = `${currentSnapshot.totalProjects} 个上榜项目当天新增都超过 100 星${hotTail}。`;
  } else {
    hypeReason = `高热项目 ${currentSnapshot.hotCount} 个，占全部 ${currentSnapshot.totalProjects} 个（占比 ${hotPct}%）；当日新增合计 ${formatCount(currentSnapshot.totalToday)} 星。`;
  }

  hero.sub = leadSub;
  hero.reason = hypeReason;

  const view = {
    css: fs.readFileSync(CSS_PATH, 'utf8'),
    isSample: data.isSample === true,
    isFail: data.isFail === true,
    title: `日报 ${date} · GitHub AI Trending 洞察`,
    date,
    dateShort: dateShort(date),
    cmpTitle,
    nav: {
      home: '../index.html',
      daily: '#',
      weekly: '../weekly/',
      monthly: '../monthly/',
      wiki: '../wiki/',
      cmp: cmpTitle,
    },
    toc: {
      cmp: cmpTitle,
    },
    week: { label: weekLabel, href: '../weekly/' },
    scrapedAtLocal,
    generatedAtLocal,
    archive: buildArchive({ date, weekLabel }),
    hero,
    verdict: {
      hypeScore: hypeIndex.score,
      hypeDots: '●'.repeat(Number(hypeIndex.score) || 0)
        + '○'.repeat(Math.max(0, 5 - (Number(hypeIndex.score) || 0))),
      hypeReason,
    },
    baseLabel,
    metrics,
    sparkNote,
    cmp,
    trends,
    barsNote,
    bars,
    langNote,
    langRows: language.rows,
    langLegend: language.legend,
    typeRows: type.rows,
    typeLegend: type.legend,
    streak,
    streakCount: streak.length,
    rankNote,
    slope: rank?.slope || null,
    rankRows,
    churn,
    churnNew: churnNewText,
    churnDrop: churnDropTextProgram,
    analysis: deepText || analysisText,
    advice,
    total: projects.length,
    projects: viewProjects,
    related,
    renderEntries: [
      ...(Array.isArray(insights.renderEntries) ? insights.renderEntries : []),
      ...(Array.isArray(insights.render_entries) ? insights.render_entries : []),
      ...heroEntries,
    ],
    footer: `数据来源：GitHub Trending（每日）· ${projects.length} 个仓库 · 抓取 ${scrapedAtLocal}（UTC+8） · 生成 ${generatedAtLocal}（UTC+8）`,
  };

  return normalizeViewModelText(view);
}

// 对所有中文文本做中英文/数字之间加空格的规范化（不改动覆盖原文里已有的空格）。
const TEXT_SKIP_KEYS = new Set([
  'css', 'url', 'href', 'anchor', 'path', 'id', 'date', 'dateShort', 'slug', 'color', 'dash',
]);

function normalizeViewModelText(value, key = '') {
  if (typeof value === 'string') {
    if (TEXT_SKIP_KEYS.has(key)) return value;
    return normalizeCjkSpacing(value);
  }
  if (Array.isArray(value)) return value.map(item => normalizeViewModelText(item, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = normalizeViewModelText(childValue, childKey);
    }
    return out;
  }
  return value;
}

function renderDailyV3(data) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return mustache.render(template, buildViewModel(data));
}

module.exports = {
  buildViewModel,
  renderDailyV3,
};
