'use strict';

const fs = require('fs');
const nodePath = require('path');
const mustache = require('mustache');
const history = require('../metrics/history');
const paths = require('../utils/path');

const TEMPLATE_DIR = nodePath.join(__dirname, '..', '..', 'templates', 'daily-v2');
const TEMPLATE_PATH = nodePath.join(TEMPLATE_DIR, 'daily.mustache');
const CSS_PATH = nodePath.join(TEMPLATE_DIR, 'site.css');

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
  return number.toLocaleString('en-US');
}

function formatStars(value) {
  const number = toNumber(value);
  if (number === null) return '—';
  if (number >= 1000) {
    const text = (number / 1000).toFixed(1).replace(/\.0$/, '');
    return `${text}k`;
  }
  return String(round1(number)).replace(/\.0$/, '');
}

function formatShare(value) {
  const number = toNumber(value);
  if (number === null) return '—';
  return `${String(round1(number)).replace(/\.0$/, '')}%`;
}

function directionValue(currentValue, referenceValue) {
  const current = toNumber(currentValue);
  const reference = toNumber(referenceValue);
  if (current === null || reference === null) return null;
  if (current > reference) return '上升';
  if (current < reference) return '下降';
  return '持平';
}

const DIRECTION_CLASS = { 上升: 'up', 下降: 'down', 持平: 'flat' };

function projectKey(project) {
  return project?.fullName || project?.repo || project?.name || null;
}

function projectSelector(project) {
  return project?.language || null;
}

function categorySelector(project) {
  return project?.analysis?.type || project?.category || null;
}

function topShare(projects, selector) {
  const total = (projects || []).length;
  if (!total) return null;
  const counts = new Map();
  for (const project of projects) {
    const key = selector(project);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  if (!best) return null;
  return { name: best.name, count: best.count, share: round1((best.count / total) * 100) };
}

function shareOf(projects, selector, name) {
  const total = (projects || []).length;
  if (!total || !name) return null;
  const count = projects.filter(project => selector(project) === name).length;
  return round1((count / total) * 100);
}

function snapshot(brief) {
  const projects = brief?.projects || [];
  const stats = brief?.stats || {};
  const totalProjects = toNumber(stats.totalProjects) ?? projects.length;
  const aiProjects = toNumber(stats.aiProjects)
    ?? projects.filter(project => project.isAI).length;
  const avgStars = toNumber(stats.avgStars)
    ?? (projects.length
      ? projects.reduce((sum, project) => sum + (toNumber(project.stars) || 0), 0) / projects.length
      : null);
  const totalToday = projects.reduce((sum, project) => sum + (toNumber(project.todayStars) || 0), 0);
  const hotCount = projects.filter(project => (toNumber(project.todayStars) || 0) > 100).length;
  const maxToday = projects.reduce((max, project) => {
    return Math.max(max, toNumber(project.todayStars) || 0);
  }, 0);
  return { totalProjects, aiProjects, avgStars, totalToday, hotCount, maxToday };
}

function namesOf(brief) {
  return new Set((brief?.projects || []).map(projectKey).filter(Boolean));
}

function setDiff(current, previous) {
  const currentNames = namesOf(current);
  const previousNames = namesOf(previous);
  const added = [...currentNames].filter(name => !previousNames.has(name));
  const kept = [...currentNames].filter(name => previousNames.has(name));
  const dropped = [...previousNames].filter(name => !currentNames.has(name));
  return { added, kept, dropped };
}

function returnedCount(date, added) {
  if (!added.length) return 0;
  const from = history.addDays(date, -30);
  const seen = new Set();
  for (const candidate of history.listDailyDates()) {
    if (candidate < from || candidate >= date) continue;
    const brief = history.readDailyBrief(candidate);
    for (const project of brief?.projects || []) {
      const key = projectKey(project);
      if (key) seen.add(key);
    }
  }
  return added.filter(name => seen.has(name)).length;
}

function retentionOf(currentBrief, previousBrief) {
  const previous = snapshot(previousBrief);
  if (!previous.totalProjects) return null;
  const { kept } = setDiff(currentBrief, previousBrief);
  return round1((kept.length / previous.totalProjects) * 100);
}

function newFaceOf(currentBrief, previousBrief) {
  const current = snapshot(currentBrief);
  if (!current.totalProjects) return null;
  const { added } = setDiff(currentBrief, previousBrief);
  const returned = returnedCount(currentBrief.date, added);
  return round1((Math.max(0, added.length - returned) / current.totalProjects) * 100);
}

function previousEntryOf(brief) {
  const scrapedAt = brief?.scrapedAt || brief?.generatedAt;
  if (!scrapedAt) return null;
  return history.getBaselineSnapshot(scrapedAt);
}

function average(values) {
  const usable = values.filter(value => value !== null && value !== undefined);
  if (!usable.length) return null;
  return round1(usable.reduce((sum, value) => sum + value, 0) / usable.length);
}

function sameDayLastMonth(date, currentScrapedAt) {
  const month = history.getPrevMonth(String(date || '').slice(0, 7));
  if (!month) return null;
  const target = `${month}-${String(date).slice(8, 10)}`;
  const brief = history.readDailyBrief(target);
  if (!brief) return null;
  const currentScrapedDate = history.getScrapedDate(currentScrapedAt);
  const targetScrapedDate = history.getScrapedDate(brief.scrapedAt || brief.generatedAt);
  if (currentScrapedDate && targetScrapedDate && targetScrapedDate >= currentScrapedDate) return null;
  return { date: target, brief };
}

function anchorOf(name) {
  return `p-${String(name || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}`;
}

function capitalize(text) {
  const value = String(text || '');
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function splitStreakBrief(items, projects, streakDays) {
  const byName = new Map();
  for (const project of projects) {
    const key = projectKey(project);
    if (key) byName.set(key, project);
  }
  const list = [];
  for (const item of Array.isArray(items) ? items : []) {
    let fullName = '';
    let text = '';
    if (typeof item === 'string') {
      const match = /^(\S+)\s+([\s\S]*)$/.exec(item.trim());
      fullName = match ? match[1] : '';
      text = match ? match[2] : item.trim();
    } else if (item && typeof item === 'object') {
      fullName = item.fullName || item.repo || item.name || '';
      text = item.text || '';
    }
    if (!fullName) continue;
    const project = byName.get(fullName);
    list.push({
      fullName,
      anchor: anchorOf(fullName),
      days: toNumber(streakDays?.[fullName]) ?? 1,
      todayStars: formatCount(project?.todayStars),
      text,
    });
  }
  list.sort((left, right) => right.days - left.days);
  return list;
}

function listReportFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.html')).sort().reverse();
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

function buildViewModel(data) {
  const brief = data.brief && data.brief.projects ? data.brief : {};
  const date = data.date || brief.date;
  const projects = (data.projects || data.trending_repos || brief.projects || [])
    .slice()
    .sort((left, right) => (toNumber(right.todayStars) || 0) - (toNumber(left.todayStars) || 0));
  const stats = data.stats || brief.stats || {};
  const dailyDiff = data.dailyDiff || brief.dailyDiff || null;
  const streakDays = data.streakDays || brief.streakDays || {};
  const insights = data.aiInsights || data.insights || {};
  const scrapedAt = data.scrapedAt || brief.scrapedAt || brief.scraped_at;
  const generatedAt = data.generatedAt || brief.generatedAt || brief.generated_at;
  const summary = data.summary || brief.summary || {};
  const current = snapshot({ projects, stats });
  const prevDate = dailyDiff?.prevDate || null;
  const prevEntry = previousEntryOf({ scrapedAt, generatedAt, date });
  const avgEntries = scrapedAt ? history.getBaselineSnapshots(scrapedAt, 7) : [];
  const monthEntry = sameDayLastMonth(date, scrapedAt);
  const prevMonth = history.getPrevMonth(String(date || '').slice(0, 7));
  const monthDate = monthEntry?.date
    || (prevMonth ? `${prevMonth}-${String(date).slice(8, 10)}` : null);
  const prevDisplayDate = prevDate || prevEntry?.date || null;

  const topType = topShare(projects, categorySelector);
  const topLang = topShare(projects, projectSelector);

  const prevSnapshot = prevEntry ? snapshot(prevEntry.brief) : null;
  const monthSnapshot = monthEntry ? snapshot(monthEntry.brief) : null;

  const avgShare = (selector, name) => {
    if (avgEntries.length < 7 || !name) return null;
    return average(avgEntries.map(entry => shareOf(entry.brief?.projects || [], selector, name)));
  };

  const typeShare7dAvg = avgShare(categorySelector, topType?.name);
  const typeShareLastMonth = monthEntry && topType
    ? shareOf(monthEntry.brief?.projects || [], categorySelector, topType.name)
    : null;
  const langShare7dAvg = avgShare(projectSelector, topLang?.name);
  const langShareLastMonth = monthEntry && topLang
    ? shareOf(monthEntry.brief?.projects || [], projectSelector, topLang.name)
    : null;

  const retentionValues = entry => {
    const previous = previousEntryOf(entry.brief);
    return previous ? retentionOf(entry.brief, previous.brief) : null;
  };
  const newFaceValues = entry => {
    const previous = previousEntryOf(entry.brief);
    return previous ? newFaceOf(entry.brief, previous.brief) : null;
  };

  const retentionRef = {
    prev: prevEntry ? retentionOf({ date, projects, stats }, prevEntry.brief) : null,
    avg7d: avgEntries.length === 7 ? average(avgEntries.map(retentionValues)) : null,
    lastMonth: monthEntry
      ? retentionOf(monthEntry.brief, previousEntryOf(monthEntry.brief)?.brief)
      : null,
  };
  const newFaceRef = {
    prev: prevEntry ? newFaceOf({ date, projects, stats }, prevEntry.brief) : null,
    avg7d: avgEntries.length === 7 ? average(avgEntries.map(newFaceValues)) : null,
    lastMonth: monthEntry
      ? newFaceOf(monthEntry.brief, previousEntryOf(monthEntry.brief)?.brief)
      : null,
  };

  const counts = dailyDiff?.counts || null;
  const currentRetention = counts && toNumber(counts.kept) !== null && (prevSnapshot?.totalProjects || 0) > 0
    ? round1((toNumber(counts.kept) / prevSnapshot.totalProjects) * 100)
    : (prevEntry ? retentionOf({ date, projects, stats }, prevEntry.brief) : null);
  const currentNewFace = counts && toNumber(counts.new) !== null && current.totalProjects > 0
    ? round1((Math.max(0, toNumber(counts.new) - (toNumber(counts.returned) || 0))
      / current.totalProjects) * 100)
    : (prevEntry ? newFaceOf({ date, projects, stats }, prevEntry.brief) : null);

  const labelOf = {
    prev: `上期 ${dateShort(prevDisplayDate)}`,
    avg: '7 日均值',
    month: `上月同期 ${dateShort(monthDate)}`,
  };

  const makeRef = (label, value, format, missingText = null) => {
    const number = toNumber(value);
    if (number === null) return { lab: label, missing: true, missingText };
    const dirText = directionValue(currentValueForRow, number);
    return {
      lab: label,
      value: format ? format(number) : String(number),
      dirText: dirText || '',
      dirCls: DIRECTION_CLASS[dirText] || '',
    };
  };

  // currentValueForRow is set per row before building its refs.
  let currentValueForRow = null;
  const avgMissingText = avgEntries.length < 7 ? '不足 7 天' : null;
  const makeRow = (label, now, currentValue, prevValue, avgValue, monthValue, format) => {
    currentValueForRow = currentValue;
    return {
      label,
      now,
      refs: [
        makeRef(labelOf.prev, prevValue, format),
        makeRef(labelOf.avg, avgValue, format, avgMissingText),
        makeRef(labelOf.month, monthValue, format),
      ],
    };
  };

  const avgSnapshot = key => {
    if (avgEntries.length < 7) return null;
    return average(avgEntries.map(entry => snapshot(entry.brief)[key]));
  };

  const rows = [
    makeRow('上榜项目数', formatCount(current.totalProjects), current.totalProjects,
      prevSnapshot?.totalProjects, avgSnapshot('totalProjects'), monthSnapshot?.totalProjects, formatCount),
    makeRow('AI 项目数', formatCount(current.aiProjects), current.aiProjects,
      prevSnapshot?.aiProjects, avgSnapshot('aiProjects'), monthSnapshot?.aiProjects, formatCount),
    makeRow('平均 Stars', formatStars(current.avgStars), current.avgStars,
      prevSnapshot?.avgStars, avgSnapshot('avgStars'), monthSnapshot?.avgStars, formatStars),
    makeRow('高热项目数', formatCount(current.hotCount), current.hotCount,
      prevSnapshot?.hotCount, avgSnapshot('hotCount'), monthSnapshot?.hotCount, formatCount),
    makeRow('当日新增星合计', formatCount(current.totalToday), current.totalToday,
      prevSnapshot?.totalToday, avgSnapshot('totalToday'), monthSnapshot?.totalToday, formatCount),
    makeRow('最大单项目新增', formatCount(summary.maxTodayStars ?? current.maxToday),
      summary.maxTodayStars ?? current.maxToday,
      prevSnapshot?.maxToday, avgSnapshot('maxToday'), monthSnapshot?.maxToday, formatCount),
    makeRow(`${capitalize(topType?.name)} 类目份额`, formatShare(topType?.share), topType?.share,
      prevEntry && topType ? shareOf(prevEntry.brief?.projects || [], categorySelector, topType.name) : null,
      typeShare7dAvg, typeShareLastMonth, formatShare),
    makeRow(`${topLang?.name || '头部'} 语言份额`, formatShare(topLang?.share), topLang?.share,
      prevEntry && topLang ? shareOf(prevEntry.brief?.projects || [], projectSelector, topLang.name) : null,
      langShare7dAvg, langShareLastMonth, formatShare),
    makeRow('留存率', formatShare(currentRetention), currentRetention,
      retentionRef.prev, retentionRef.avg7d, retentionRef.lastMonth, formatShare),
    makeRow('新面孔率', formatShare(currentNewFace), currentNewFace,
      newFaceRef.prev, newFaceRef.avg7d, newFaceRef.lastMonth, formatShare),
  ];

  const prevShort = dateShort(prevDisplayDate);
  const cmp = {
    prevDateLabel: prevShort
      ? `${prevShort}（本期之前最近一份快照）`
      : '无基准',
    prevDateShort: prevShort || '—',
    lastMonthDateShort: dateShort(monthDate) || '—',
    rows,
    caption: '7 日均值取最近 7 个有数据日，前序不足 7 天时显示「不足 7 天」；高热＝今日新增超过 100 星；「—」表示当前数据没有该参照值。',
  };

  const statItems = [
    { label: '上榜项目', value: current.totalProjects, prev: prevSnapshot?.totalProjects },
    { label: 'AI 项目', value: current.aiProjects, prev: prevSnapshot?.aiProjects },
    { label: '平均 Stars', value: current.avgStars, prev: prevSnapshot?.avgStars, stars: true },
    { label: '高热项目', value: current.hotCount, prev: prevSnapshot?.hotCount },
  ].map(item => ({
    label: item.label,
    value: item.stars ? formatStars(item.value) : formatCount(item.value),
    prev: item.prev === null || item.prev === undefined
      ? '—'
      : (item.stars ? formatStars(item.prev) : formatCount(item.prev)),
    dirText: directionValue(item.value, item.prev) || '无基准',
  }));

  const projectInsights = new Map();
  for (const item of insights.project_insights || []) {
    const name = item.project_name || item.fullName || item.repo;
    if (name && item.oneSentence) projectInsights.set(name, item.oneSentence);
  }

  const viewProjects = projects.map((project, index) => {
    const fullName = projectKey(project) || '—';
    const analysis = project.analysis || {};
    const days = toNumber(streakDays?.[fullName]) ?? 1;
    const tag = project.tag || '';
    const oneSentence = projectInsights.get(fullName)
      || analysis.oneSentence
      || project.oneSentence
      || project.descZh
      || project.desc
      || project.description
      || '暂无描述';
    return {
      rank: index + 1,
      anchor: anchorOf(fullName),
      url: project.url || `https://github.com/${fullName}`,
      fullName,
      tag,
      tagNew: tag === '新' || tag === '回归',
      oneSentence,
      descZh: project.descZh || project.desc || project.description || '—',
      typeName: analysis.typeName || '—',
      language: project.language || '—',
      community: analysis.community?.level || '—',
      todayStars: formatCount(project.todayStars),
      starsFmt: formatCount(project.stars),
      forksFmt: formatCount(project.forks),
      streakText: `${days} 天`,
    };
  });

  const streak = splitStreakBrief(insights.streakBrief, projects, streakDays);

  const churnCounts = counts || (prevEntry
    ? (() => {
        const diff = setDiff({ projects }, prevEntry.brief);
        return {
          new: diff.added.length,
          kept: diff.kept.length,
          dropped: diff.dropped.length,
          returned: 0,
        };
      })()
    : { new: 0, kept: 0, dropped: 0, returned: 0 });

  const anchorList = names => names.map(name => ({ fullName: name, anchor: anchorOf(name) }));
  const churn = {
    nums: [
      { value: churnCounts.new ?? 0, label: '新进' },
      { value: churnCounts.returned ?? 0, label: '其中回归' },
      { value: churnCounts.kept ?? 0, label: '连续在榜' },
      { value: churnCounts.dropped ?? 0, label: '掉榜' },
      { value: formatShare(currentRetention), label: '留存率' },
      { value: formatShare(currentNewFace), label: '新面孔率' },
    ],
    text: insights.churn || '',
    newCount: churnCounts.new ?? 0,
    returnedCount: churnCounts.returned ?? 0,
    keptCount: churnCounts.kept ?? 0,
    droppedCount: churnCounts.dropped ?? 0,
    new: anchorList(dailyDiff?.new || []),
    kept: anchorList(dailyDiff?.kept || []),
    dropped: (dailyDiff?.dropped || []).map(fullName => ({ fullName })),
  };

  const actions = (Array.isArray(insights.action) ? insights.action : []).filter(Boolean).slice(0, 3);
  const deep = {
    text: insights.deepAnalysis || insights.summary || insights.oneLiner || '',
    actions,
    hasActions: actions.length > 0,
  };

  const weekLabel = date ? history.getISOWeekId(date) : '';
  const relatedPrev = prevShort
    ? {
        href: `github-ai-trending-${prevDisplayDate}.html`,
        title: `上期日报 ${prevShort}`,
        sub: `${formatCount(prevSnapshot?.totalProjects)} 个项目`,
      }
    : null;
  const related = [
    relatedPrev,
    { href: '../weekly/', title: `${weekLabel || '上周'} 周报`, sub: '上周' },
    { href: '../monthly/', title: `${String(date || '').slice(0, 7)} 月报`, sub: '上月' },
    { href: '../wiki/', title: 'Wiki 领域索引', sub: '项目与领域历史' },
  ].filter(Boolean);

  const scrapedAtLocal = formatLocal(scrapedAt);
  return {
    css: fs.readFileSync(CSS_PATH, 'utf8'),
    isSample: data.isSample === true,
    isFail: data.isFail === true,
    date,
    dateShort: dateShort(date),
    nav: {
      home: '../index.html',
      daily: '#',
      weekly: '../weekly/',
      monthly: '../monthly/',
      wiki: '../wiki/',
    },
    week: { label: weekLabel, href: '../weekly/' },
    scrapedAtLocal,
    generatedAtLocal: formatLocal(generatedAt),
    archive: buildArchive({ date, weekLabel }),
    verdict: {
      oneLiner: insights.oneLiner || '',
      hypeScore: insights.hypeIndex?.score ?? 0,
      hypeDots: '●'.repeat(Number(insights.hypeIndex?.score) || 0)
        + '○'.repeat(Math.max(0, 5 - (Number(insights.hypeIndex?.score) || 0))),
      hypeReason: insights.hypeIndex?.reason || '',
    },
    cmp,
    stats: statItems,
    trends: Array.isArray(insights.coreTrends) ? insights.coreTrends.filter(Boolean) : [],
    streak,
    streakCount: streak.length,
    churn,
    deep,
    total: current.totalProjects,
    projects: viewProjects,
    related,
    footer: `数据来源：GitHub Trending（每日）· ${current.totalProjects} 个仓库 · 抓取 ${scrapedAtLocal}（UTC+8）`,
    typeShare7dAvg,
    typeShareLastMonth,
    langShare7dAvg,
    langShareLastMonth,
    retentionRef,
    newFaceRef,
    streakBrief: streak.map(item => ({ fullName: item.fullName, text: item.text })),
    captionReader: cmp.caption,
  };
}

function renderDailyV2(data) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return mustache.render(template, buildViewModel(data));
}

module.exports = {
  buildViewModel,
  renderDailyV2,
};
