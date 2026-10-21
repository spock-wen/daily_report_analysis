'use strict';

const history = require('../metrics/history');

const BRIEF_PATHS = {
  daily: period => `briefs/daily/data-${period}.json`,
  weekly: period => `briefs/weekly/data-weekly-${period}.json`,
  monthly: period => `briefs/monthly/data-month-${period}.json`,
};

const THRESHOLDS = {
  daily: [
    { value: 100, field: 'projects[*].todayStars', label: '高热项目门槛：今日新增 > 100 星' },
    { value: 10000, field: 'projects[*].todayStars', label: '看点阈值：1 万星（今日新增）' },
    { value: 100000, field: 'projects[*].todayStars', label: '看点阈值：10 万星（今日新增）' },
  ],
  weekly: [
    { value: 10000, field: 'projects[*].todayStars', label: '看点阈值：1 万星（本周新增）' },
    { value: 100000, field: 'projects[*].todayStars', label: '看点阈值：10 万星（本周新增）' },
    { value: 200000, field: 'projects[*].todayStars', label: '看点阈值：20 万星（本周新增）' },
  ],
  monthly: [
    { value: 10000, field: 'monthTop[*].monthStars', label: '看点阈值：1 万星（本月新增）' },
    { value: 100000, field: 'monthTop[*].monthStars', label: '看点阈值：10 万星（本月新增）' },
    { value: 200000, field: 'monthTop[*].monthStars', label: '看点阈值：20 万星（本月新增）' },
  ],
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumTodayStars(projects) {
  return (projects || []).reduce((sum, project) => {
    return sum + (Number(project?.todayStars) || 0);
  }, 0);
}

function maxTodayStars(projects) {
  return (projects || []).reduce((max, project) => {
    return Math.max(max, Number(project?.todayStars) || 0);
  }, 0);
}

function buildDailyFacts({ brief, add, addNumber }) {
  const projects = brief.projects || [];
  const stats = brief.stats || {};

  addNumber(stats.totalProjects, { kind: 'total', field: 'stats.totalProjects', label: '上榜项目数' });
  addNumber(stats.aiProjects, { kind: 'total', field: 'stats.aiProjects', label: 'AI 项目数' });
  if (stats.avgStars !== undefined && stats.avgStars !== null) {
    add(stats.avgStars, { kind: 'total', field: 'stats.avgStars', label: '平均 Stars' });
  }

  const hotProjects = projects.filter(project => (Number(project.todayStars) || 0) > 100).length;
  add(hotProjects, { kind: 'total', field: 'projects[*].todayStars', label: '高热项目数（今日新增 > 100 星）' });
  add(sumTodayStars(projects), { kind: 'total', field: 'projects[*].todayStars', label: '当日新增星合计' });

  const counts = brief.dailyDiff?.counts || {};
  addNumber(counts.new, { kind: 'total', field: 'dailyDiff.counts.new', label: '较上期新上榜数' });
  addNumber(counts.dropped, { kind: 'total', field: 'dailyDiff.counts.dropped', label: '较上期掉榜数' });
  addNumber(counts.kept, { kind: 'total', field: 'dailyDiff.counts.kept', label: '较上期连续在榜数' });
  addNumber(counts.returned, { kind: 'total', field: 'dailyDiff.counts.returned', label: '较上期回归数' });

  projects.forEach((project, index) => {
    const fullName = history.projectKey(project);
    if (!fullName) return;
    addNumber(project.todayStars, {
      project: fullName,
      field: `projects[${index}].todayStars`,
      label: `${fullName} 今日新增星`,
    });
    addNumber(project.stars, {
      project: fullName,
      field: `projects[${index}].stars`,
      label: `${fullName} 累计 Stars`,
    });
    addNumber(project.forks, {
      project: fullName,
      field: `projects[${index}].forks`,
      label: `${fullName} Fork 数`,
    });
    addNumber(brief.streakDays?.[fullName], {
      project: fullName,
      field: `streakDays["${fullName}"]`,
      label: `${fullName} 连续上榜天数`,
    });
  });

  for (const threshold of THRESHOLDS.daily) {
    add(threshold.value, {
      kind: 'threshold',
      field: threshold.field,
      label: threshold.label,
    });
  }

  return history.getProjectNames(brief);
}

function buildWeeklyFacts({ brief, metrics, add, addNumber }) {
  const projects = brief.projects || [];
  const stats = brief.stats || {};
  const weekMetrics = brief.weekMetrics || metrics || {};
  const prevWeekStats = brief.prevWeekStats || weekMetrics.prevWeekStats || {};

  addNumber(stats.totalProjects, { kind: 'total', field: 'stats.totalProjects', label: '上榜项目数' });
  addNumber(stats.aiProjects, { kind: 'total', field: 'stats.aiProjects', label: 'AI 项目数' });
  if (stats.avgStars !== undefined && stats.avgStars !== null) {
    add(stats.avgStars, { kind: 'total', field: 'stats.avgStars', label: '平均 Stars' });
  }

  const totalProjects = toNumber(stats.totalProjects) ?? projects.length;
  const aiProjects = toNumber(stats.aiProjects) ?? 0;
  add(totalProjects > 0 ? Math.round((aiProjects / totalProjects) * 100) : 0, {
    kind: 'total',
    field: 'stats.aiProjects',
    label: 'AI 项目占比（%）',
  });
  add(maxTodayStars(projects), {
    kind: 'total',
    field: 'projects[*].todayStars',
    label: '最大黑马今日新增星',
  });

  addNumber(brief.weekNewStars ?? weekMetrics.weekNewStars, {
    kind: 'total',
    field: 'weekNewStars',
    label: '本周新增星合计',
  });

  const wow = weekMetrics.wow || {};
  addNumber(wow.previous, { kind: 'total', field: 'weekMetrics.wow.previous', label: '上周新增星合计' });
  addNumber(wow.delta, { kind: 'total', field: 'weekMetrics.wow.delta', label: '较上周变化量' });
  addNumber(wow.rate, { kind: 'total', field: 'weekMetrics.wow.rate', label: '环比（%）' });
  addNumber(weekMetrics.churnCount, { kind: 'total', field: 'weekMetrics.churnCount', label: '换血项目数' });
  addNumber(weekMetrics.churnRate, { kind: 'total', field: 'weekMetrics.churnRate', label: '换血率（%）' });

  addNumber(prevWeekStats.totalProjects, {
    kind: 'total',
    field: 'prevWeekStats.totalProjects',
    label: '上周上榜项目数',
  });
  addNumber(prevWeekStats.aiProjects, {
    kind: 'total',
    field: 'prevWeekStats.aiProjects',
    label: '上周 AI 项目数',
  });
  if (prevWeekStats.avgStars !== undefined && prevWeekStats.avgStars !== null) {
    add(prevWeekStats.avgStars, { kind: 'total', field: 'prevWeekStats.avgStars', label: '上周平均 Stars' });
  }
  addNumber(prevWeekStats.newStarsTotal, {
    kind: 'total',
    field: 'prevWeekStats.newStarsTotal',
    label: '上周新增星合计',
  });

  const dailyCounts = brief.dailyCounts ?? weekMetrics.dailyCounts ?? [];
  const weekDates = history.getISOWeekDates(brief.weekStart || brief.week || brief.date);
  dailyCounts.forEach((count, index) => {
    addNumber(count, {
      kind: 'total',
      field: `dailyCounts[${index}]`,
      label: `日报项目数 ${weekDates[index] || index + 1}`,
    });
  });

  const newProjects = weekMetrics.new || [];
  const continuing = weekMetrics.continuing || [];
  const returning = weekMetrics.returning || [];
  const out = weekMetrics.out || [];
  add(newProjects.length, { kind: 'total', field: 'weekMetrics.new', label: '本周新面孔数' });
  add(continuing.length, { kind: 'total', field: 'weekMetrics.continuing', label: '本周连续在榜数' });
  add(returning.length, { kind: 'total', field: 'weekMetrics.returning', label: '本周回归数' });
  add(out.length, { kind: 'total', field: 'weekMetrics.out', label: '本周出局数' });

  (weekMetrics.dailyTop3Stats || []).forEach((item, index) => {
    if (!item.fullName) return;
    addNumber(item.days, {
      project: item.fullName,
      field: `weekMetrics.dailyTop3Stats[${index}].days`,
      label: `${item.fullName} 本周日报上榜天数`,
    });
    addNumber(item.weekStars, {
      project: item.fullName,
      field: `weekMetrics.dailyTop3Stats[${index}].weekStars`,
      label: `${item.fullName} 本周日报新增星`,
    });
  });

  projects.forEach((project, index) => {
    const fullName = history.projectKey(project);
    if (!fullName) return;
    addNumber(project.todayStars, {
      project: fullName,
      field: `projects[${index}].todayStars`,
      label: `${fullName} 本周新增星`,
    });
    addNumber(project.stars, {
      project: fullName,
      field: `projects[${index}].stars`,
      label: `${fullName} 累计 Stars`,
    });
    addNumber(project.forks, {
      project: fullName,
      field: `projects[${index}].forks`,
      label: `${fullName} Fork 数`,
    });
  });

  for (const threshold of THRESHOLDS.weekly) {
    add(threshold.value, {
      kind: 'threshold',
      field: threshold.field,
      label: threshold.label,
    });
  }

  const dailyTop3Names = (weekMetrics.dailyTop3Stats || [])
    .map(item => item.fullName)
    .filter(Boolean);
  return Array.from(new Set([...history.getProjectNames(brief), ...dailyTop3Names]));
}

function buildMonthlyFacts({ brief, metrics, add, addNumber }) {
  const stats = brief.stats || {};
  const monthTop = brief.monthTop || metrics?.monthTop || [];
  const allItems = Array.isArray(metrics?.top) && metrics.top.length > 0 ? metrics.top : monthTop;
  const itemField = Array.isArray(metrics?.top) && metrics.top.length > 0 ? 'top' : 'monthTop';
  const prevMonthStats = brief.prevMonthStats || metrics?.prevMonthStats || {};

  addNumber(stats.totalProjects, {
    kind: 'total',
    field: 'stats.totalProjects',
    label: '总项目数（日榜去重）',
  });
  addNumber(stats.aiProjects, { kind: 'total', field: 'stats.aiProjects', label: 'AI 项目数' });
  if (stats.avgStars !== undefined && stats.avgStars !== null) {
    add(stats.avgStars, { kind: 'total', field: 'stats.avgStars', label: '平均 Stars' });
  }
  addNumber(stats.newStarsTotal, {
    kind: 'total',
    field: 'stats.newStarsTotal',
    label: '本月新增星合计',
  });
  addNumber(stats.recurringProjects, {
    kind: 'total',
    field: 'stats.recurringProjects',
    label: '重复上榜项目数（上榜 ≥2 天）',
  });
  addNumber(stats.newProjects, { kind: 'total', field: 'stats.newProjects', label: '新秀数' });
  addNumber(stats.priorProjects, { kind: 'total', field: 'stats.priorProjects', label: '非新秀项目数' });
  addNumber(stats.top5Share, {
    kind: 'total',
    field: 'stats.top5Share',
    label: 'Top5 头部集中度（%）',
  });

  addNumber(prevMonthStats.projects, {
    kind: 'total',
    field: 'prevMonthStats.projects',
    label: '上月总项目数',
  });
  addNumber(prevMonthStats.newStarsTotal, {
    kind: 'total',
    field: 'prevMonthStats.newStarsTotal',
    label: '上月新增星合计',
  });
  addNumber(prevMonthStats.rookies, {
    kind: 'total',
    field: 'prevMonthStats.rookies',
    label: '上月新秀数',
  });
  addNumber(prevMonthStats.priorProjects, {
    kind: 'total',
    field: 'prevMonthStats.priorProjects',
    label: '上月非新秀项目数',
  });
  addNumber(prevMonthStats.top5Share, {
    kind: 'total',
    field: 'prevMonthStats.top5Share',
    label: '上月 Top5 头部集中度（%）',
  });

  allItems.forEach((item, index) => {
    const fullName = item.fullName;
    if (!fullName) return;
    addNumber(item.monthStars, {
      project: fullName,
      field: `${itemField}[${index}].monthStars`,
      label: `${fullName} 本月新增星`,
    });
    addNumber(item.daysOnList, {
      project: fullName,
      field: `${itemField}[${index}].daysOnList`,
      label: `${fullName} 上榜天数`,
    });
    addNumber(item.lastStars, {
      project: fullName,
      field: `${itemField}[${index}].lastStars`,
      label: `${fullName} 累计 Stars`,
    });
  });

  const dropList = brief.dropList || metrics?.dropList || [];
  dropList.forEach((item, index) => {
    const fullName = item.fullName;
    if (!fullName) return;
    addNumber(item.prevRank, {
      project: fullName,
      field: `dropList[${index}].prevRank`,
      label: `${fullName} 上月排名`,
    });
    addNumber(item.prevMonthStars, {
      project: fullName,
      field: `dropList[${index}].prevMonthStars`,
      label: `${fullName} 上月新增星`,
    });
    addNumber(item.currentRank, {
      project: fullName,
      field: `dropList[${index}].currentRank`,
      label: `${fullName} 本月排名`,
    });
    addNumber(item.currentMonthStars, {
      project: fullName,
      field: `dropList[${index}].currentMonthStars`,
      label: `${fullName} 本月新增星`,
    });
  });

  for (const threshold of THRESHOLDS.monthly) {
    add(threshold.value, {
      kind: 'threshold',
      field: threshold.field,
      label: threshold.label,
    });
  }

  return Array.from(new Set(allItems.map(item => item.fullName).filter(Boolean)));
}

function buildFacts({ level, period, brief, metrics }) {
  if (!brief || !BRIEF_PATHS[level] || !period) return null;

  const file = BRIEF_PATHS[level](period);
  const facts = [];

  const add = (value, { project = null, kind = 'single', field, label }) => {
    if (value === undefined || value === null) return null;
    facts.push({
      id: `f${facts.length + 1}`,
      value,
      project: project || null,
      kind,
      source: `${file}#${field}`,
      label,
    });
    return facts[facts.length - 1].id;
  };

  const addNumber = (value, options) => {
    const number = toNumber(value);
    if (number === null) return null;
    return add(number, options);
  };

  let projects;
  if (level === 'daily') {
    projects = buildDailyFacts({ brief, add, addNumber });
  } else if (level === 'weekly') {
    projects = buildWeeklyFacts({ brief, metrics, add, addNumber });
  } else {
    projects = buildMonthlyFacts({ brief, metrics, add, addNumber });
  }

  return { level, period, projects, facts };
}

module.exports = {
  buildFacts,
  BRIEF_PATHS,
  THRESHOLDS,
};
