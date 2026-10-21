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
  if (value === null || value === undefined || value === '') return null;
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

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// B16：方向词由生成器决定。|Δ|/参照 < 5% 记「持平」；负变化不得记「提速」。
function directionValue(currentValue, referenceValue, kind = null) {
  const currentNumber = toNumber(currentValue);
  const referenceNumber = toNumber(referenceValue);
  if (currentNumber === null || referenceNumber === null) return null;
  if (kind === 'acceleration') {
    const delta = currentNumber - referenceNumber;
    const ratio = referenceNumber > 0 ? Math.abs(delta) / referenceNumber : null;
    if (ratio !== null && ratio < 0.05) return '持平';
    if (delta > 0) return '提速';
    if (delta < 0) return '放缓';
    return '持平';
  }
  if (currentNumber > referenceNumber) return '上升';
  if (currentNumber < referenceNumber) return '下降';
  return '持平';
}

function parseMetricNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = /^([+-]?[\d.]+)\s*(亿|万|千|[kKwW])?$/.exec(value.trim());
  if (!match) return toNumber(value);
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'k') return number * 1000;
  if (unit === 'w' || unit === '万') return number * 10000;
  if (unit === '亿') return number * 100000000;
  if (unit === '千') return number * 1000;
  return number;
}

function dailySnapshot(brief) {
  const projects = brief?.projects || [];
  const stats = brief?.stats || {};
  return {
    totalProjects: toNumber(stats.totalProjects) ?? projects.length,
    aiProjects: toNumber(stats.aiProjects) ?? projects.filter(project => project.isAI).length,
    avgStars: parseMetricNumber(stats.avgStars),
    totalToday: sumTodayStars(projects),
    hotCount: projects.filter(project => (Number(project.todayStars) || 0) > 100).length,
    maxToday: maxTodayStars(projects),
  };
}

function sameDayLastMonth(date) {
  const month = history.getPrevMonth(String(date).slice(0, 7));
  if (!month) return null;
  const target = `${month}-${String(date).slice(8, 10)}`;
  const brief = history.readDailyBrief(target);
  return brief ? { date: target, brief } : null;
}

function projectCategory(project) {
  return project?.analysis?.type || project?.category || null;
}

function topShare(projects, selector) {
  const total = (projects || []).length;
  if (total === 0) return null;
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

// B16：日报参照数（昨日、7 日均值、上月同期）、类目/语言份额变化、连续上榜提速、换血率。
// 缺历史即不产出对应事实。
function addDailyReferenceFacts({ brief, add, addNumber }) {
  const date = brief.date;
  if (!date) return;

  // J1：基准 = 抓取日早于本期的最近一份快照；同一抓取日不比较，无基准时不产出参照值。
  const scrapedAt = brief.scrapedAt || brief.generatedAt;
  const baseline = history.getBaselineSnapshot(scrapedAt);
  if (!baseline) return;
  const prevEntries = [baseline];
  const avgEntries = history.getBaselineSnapshots(scrapedAt, 7);
  const currentScrapeDate = history.getScrapedDate(scrapedAt);
  let monthEntry = sameDayLastMonth(date);
  if (monthEntry) {
    const monthScrapeDate = history.getScrapedDate(
      monthEntry.brief.scrapedAt || monthEntry.brief.generatedAt
    );
    // J1：同一抓取日绝不作为参照。
    if (!monthScrapeDate || monthScrapeDate >= currentScrapeDate) monthEntry = null;
  }
  const current = dailySnapshot(brief);
  const metrics = [
    { key: 'total_projects', label: '上榜项目数', field: 'stats.totalProjects', pick: snapshot => snapshot.totalProjects },
    { key: 'ai_projects', label: 'AI 项目数', field: 'stats.aiProjects', pick: snapshot => snapshot.aiProjects },
    { key: 'avg_stars', label: '平均 Stars', field: 'stats.avgStars', pick: snapshot => snapshot.avgStars },
    { key: 'hot_count', label: '高热项目数', field: 'projects[*].todayStars', pick: snapshot => snapshot.hotCount },
    { key: 'total_today', label: '新增星合计', field: 'projects[*].todayStars', pick: snapshot => snapshot.totalToday },
    { key: 'max_today', label: '最大单项目新增', field: 'projects[*].todayStars', pick: snapshot => snapshot.maxToday },
  ];

  const addDirection = ({ metric, label, currentValue, referenceValue, source, kind = null }) => {
    const value = directionValue(currentValue, referenceValue, kind);
    if (!value) return;
    add(value, {
      kind: 'total',
      field: metric.field,
      label: `${label}方向（${value}）`,
      role: 'direction',
      source,
      current: toNumber(currentValue),
      reference: toNumber(referenceValue),
      comparison: { metric: metric.key, kind: kind || 'reference' },
    });
  };

  if (prevEntries.length === 1) {
    const prev = dailySnapshot(prevEntries[0].brief);
    for (const metric of metrics) {
      const referenceValue = metric.pick(prev);
      addNumber(referenceValue, {
        kind: 'total',
        field: metric.field,
        label: `昨日${metric.label}`,
        role: `prev_${metric.key}`,
        source: `briefs/daily/data-${prevEntries[0].date}.json#${metric.field}`,
      });
      addDirection({
        metric,
        label: `今日${metric.label}较昨日`,
        currentValue: metric.pick(current),
        referenceValue,
        source: `briefs/daily/data-${date}.json#${metric.field}; briefs/daily/data-${prevEntries[0].date}.json#${metric.field}`,
      });
    }
  }

  if (avgEntries.length === 7) {
    for (const metric of metrics) {
      const values = avgEntries.map(entry => metric.pick(dailySnapshot(entry.brief)));
      if (values.some(value => value === null || value === undefined)) continue;
      const average = round1(values.reduce((sum, value) => sum + value, 0) / values.length);
      addNumber(average, {
        kind: 'total',
        field: metric.field,
        label: `7 日均值：${metric.label}`,
        role: `avg7_${metric.key}`,
        source: `briefs/daily/data-${avgEntries[6].date}..${avgEntries[0].date}.json#${metric.field}`,
      });
      addDirection({
        metric,
        label: `今日${metric.label}较7日均值`,
        currentValue: metric.pick(current),
        referenceValue: average,
        source: `briefs/daily/data-${date}.json#${metric.field}; briefs/daily/data-${avgEntries[6].date}..${avgEntries[0].date}.json#${metric.field}`,
      });
    }
  }

  if (monthEntry) {
    const month = dailySnapshot(monthEntry.brief);
    for (const metric of metrics) {
      const referenceValue = metric.pick(month);
      addNumber(referenceValue, {
        kind: 'total',
        field: metric.field,
        label: `上月同期${metric.label}`,
        role: `mom_${metric.key}`,
        source: `briefs/daily/data-${monthEntry.date}.json#${metric.field}`,
      });
      addDirection({
        metric,
        label: `今日${metric.label}较上月同期`,
        currentValue: metric.pick(current),
        referenceValue,
        source: `briefs/daily/data-${date}.json#${metric.field}; briefs/daily/data-${monthEntry.date}.json#${metric.field}`,
      });
    }
  }

  const prevBrief = prevEntries[0]?.brief;
  if (prevBrief) {
    const prevProjects = prevBrief.projects || [];
    const projects = brief.projects || [];
    const category = topShare(projects, projectCategory);
    if (category) {
      const previousShare = shareOf(prevProjects, projectCategory, category.name);
      if (previousShare !== null) {
        add(category.share, {
          kind: 'total',
          field: 'projects[*].analysis.type',
          label: `头部类目「${category.name}」份额（%）`,
          role: 'category_share',
          source: `briefs/daily/data-${date}.json#projects[*].analysis.type`,
        });
        const shiftValue = round1(category.share - previousShare);
        add(shiftValue, {
          kind: 'total',
          field: 'projects[*].analysis.type',
          label: `头部类目「${category.name}」份额较上一有数据日变化（百分点）`,
          role: 'category_shift',
          source: `briefs/daily/data-${date}.json#projects[*].analysis.type; briefs/daily/data-${prevEntries[0].date}.json#projects[*].analysis.type`,
        });
        addDirection({
          metric: { key: 'category_share', field: 'projects[*].analysis.type' },
          label: `头部类目「${category.name}」份额较上一有数据日`,
          currentValue: category.share,
          referenceValue: previousShare,
          source: `briefs/daily/data-${date}.json#projects[*].analysis.type; briefs/daily/data-${prevEntries[0].date}.json#projects[*].analysis.type`,
        });
      }
    }

    const language = topShare(projects, project => project.language || null);
    if (language) {
      const previousShare = shareOf(prevProjects, project => project.language || null, language.name);
      if (previousShare !== null) {
        add(language.share, {
          kind: 'total',
          field: 'projects[*].language',
          label: `头部语言「${language.name}」份额（%）`,
          role: 'language_share',
          source: `briefs/daily/data-${date}.json#projects[*].language`,
        });
        const shiftValue = round1(language.share - previousShare);
        add(shiftValue, {
          kind: 'total',
          field: 'projects[*].language',
          label: `头部语言「${language.name}」份额较上一有数据日变化（百分点）`,
          role: 'language_shift',
          source: `briefs/daily/data-${date}.json#projects[*].language; briefs/daily/data-${prevEntries[0].date}.json#projects[*].language`,
        });
        addDirection({
          metric: { key: 'language_share', field: 'projects[*].language' },
          label: `头部语言「${language.name}」份额较上一有数据日`,
          currentValue: language.share,
          referenceValue: previousShare,
          source: `briefs/daily/data-${date}.json#projects[*].language; briefs/daily/data-${prevEntries[0].date}.json#projects[*].language`,
        });
      }
    }
  }

  const counts = brief.dailyDiff?.counts;
  if (counts) {
    const kept = toNumber(counts.kept);
    if (prevBrief && kept !== null) {
      const prevTotal = dailySnapshot(prevBrief).totalProjects;
      if (prevTotal > 0) {
        add(round1((kept / prevTotal) * 100), {
          kind: 'total',
          field: 'dailyDiff.counts.kept',
          label: '留存率（连续在榜数 ÷ 上一有数据日上榜数 × 100）',
          role: 'retention_rate',
          source: `briefs/daily/data-${date}.json#dailyDiff.counts.kept; briefs/daily/data-${prevEntries[0].date}.json#stats.totalProjects`,
        });
      }
    }

    const newCount = toNumber(counts.new);
    const returned = toNumber(counts.returned) || 0;
    if (newCount !== null && current.totalProjects > 0) {
      add(round1((Math.max(0, newCount - returned) / current.totalProjects) * 100), {
        kind: 'total',
        field: 'dailyDiff.counts.new',
        label: '新面孔率（(新进数 − 回归数) ÷ 当日在榜数 × 100）',
        role: 'new_face_rate',
        source: `briefs/daily/data-${date}.json#dailyDiff.counts.new; briefs/daily/data-${date}.json#dailyDiff.counts.returned; briefs/daily/data-${date}.json#stats.totalProjects`,
      });
    }
  }
}

function addStreakAcceleration({ brief, add, addNumber }) {
  if (!brief.date) return;
  // J1：连续上榜提速同样以早于本期抓取日的最近快照为基准。
  const prevEntry = history.getBaselineSnapshot(brief.scrapedAt || brief.generatedAt);
  if (!prevEntry) return;

  const prevByName = new Map();
  for (const project of prevEntry.brief.projects || []) {
    const key = history.projectKey(project);
    if (key) prevByName.set(key, project);
  }

  const projects = brief.projects || [];
  projects.forEach((project, index) => {
    const key = history.projectKey(project);
    const streak = toNumber(brief.streakDays?.[key]);
    if (!key || streak === null || streak < 2) return;

    const previous = prevByName.get(key);
    const previousToday = toNumber(previous?.todayStars);
    const today = toNumber(project.todayStars);
    if (previousToday === null || today === null) return;

    add(today - previousToday, {
      project: key,
      kind: 'single',
      field: `projects[${index}].todayStars`,
      label: `${key} 今日新增较前一有数据日变化（星）`,
      role: 'acceleration',
      source: `briefs/daily/data-${brief.date}.json#projects[${index}].todayStars; briefs/daily/data-${prevEntry.date}.json#projects[*].todayStars`,
    });

    const accelerationDirection = directionValue(today, previousToday, 'acceleration');
    if (accelerationDirection) {
      add(accelerationDirection, {
        project: key,
        kind: 'single',
        field: `projects[${index}].todayStars`,
        label: `${key} 今日新增较前一有数据日方向（${accelerationDirection}）`,
        role: 'direction',
        source: `briefs/daily/data-${brief.date}.json#projects[${index}].todayStars; briefs/daily/data-${prevEntry.date}.json#projects[*].todayStars`,
        current: today,
        reference: previousToday,
        comparison: { metric: `acceleration:${key}`, kind: 'acceleration' },
      });
    }

    if (previousToday > 0) {
      add(round2(today / previousToday), {
        project: key,
        kind: 'single',
        field: `projects[${index}].todayStars`,
        label: `${key} 今日新增较前一有数据日倍数`,
        role: 'acceleration_ratio',
        source: `briefs/daily/data-${brief.date}.json#projects[${index}].todayStars; briefs/daily/data-${prevEntry.date}.json#projects[*].todayStars`,
      });
    }
  });
}

function buildDailyFacts({ brief, add, addNumber }) {
  const projects = brief.projects || [];
  const stats = brief.stats || {};

  addNumber(stats.totalProjects, { kind: 'total', field: 'stats.totalProjects', label: '上榜项目数', role: 'total_projects' });
  addNumber(stats.aiProjects, { kind: 'total', field: 'stats.aiProjects', label: 'AI 项目数', role: 'ai_projects' });
  if (stats.avgStars !== undefined && stats.avgStars !== null) {
    add(stats.avgStars, { kind: 'total', field: 'stats.avgStars', label: '平均 Stars', role: 'avg_stars' });
  }

  const hotProjects = projects.filter(project => (Number(project.todayStars) || 0) > 100).length;
  add(hotProjects, { kind: 'total', field: 'projects[*].todayStars', label: '高热项目数（今日新增 > 100 星）', role: 'hot_count' });
  add(sumTodayStars(projects), { kind: 'total', field: 'projects[*].todayStars', label: '当日新增星合计', role: 'total_today' });

  const counts = brief.dailyDiff?.counts || {};
  addNumber(counts.new, { kind: 'total', field: 'dailyDiff.counts.new', label: '较上期新上榜数', role: 'new' });
  addNumber(counts.dropped, { kind: 'total', field: 'dailyDiff.counts.dropped', label: '较上期掉榜数', role: 'dropped' });
  addNumber(counts.kept, { kind: 'total', field: 'dailyDiff.counts.kept', label: '较上期连续在榜数', role: 'kept' });
  addNumber(counts.returned, { kind: 'total', field: 'dailyDiff.counts.returned', label: '较上期回归数', role: 'returned' });

  addDailyReferenceFacts({ brief, add, addNumber });
  addStreakAcceleration({ brief, add, addNumber });

  projects.forEach((project, index) => {
    const fullName = history.projectKey(project);
    if (!fullName) return;
    addNumber(project.todayStars, {
      project: fullName,
      field: `projects[${index}].todayStars`,
      label: `${fullName} 今日新增星`,
      role: 'today_stars',
    });
    addNumber(project.stars, {
      project: fullName,
      field: `projects[${index}].stars`,
      label: `${fullName} 累计 Stars`,
      role: 'stars',
    });
    addNumber(project.forks, {
      project: fullName,
      field: `projects[${index}].forks`,
      label: `${fullName} Fork 数`,
      role: 'forks',
    });
    addNumber(brief.streakDays?.[fullName], {
      project: fullName,
      field: `streakDays["${fullName}"]`,
      label: `${fullName} 连续上榜天数`,
      role: 'streak',
    });
  });

  for (const threshold of THRESHOLDS.daily) {
    add(threshold.value, {
      kind: 'threshold',
      field: threshold.field,
      label: threshold.label,
      role: 'threshold',
    });
  }

  return history.getProjectNames(brief);
}

function buildWeeklyFacts({ brief, metrics, add, addNumber }) {
  const projects = brief.projects || [];
  const stats = brief.stats || {};
  const weekMetrics = brief.weekMetrics || metrics || {};
  const prevWeekStats = brief.prevWeekStats || weekMetrics.prevWeekStats || {};

  addNumber(stats.totalProjects, { kind: 'total', field: 'stats.totalProjects', label: '上榜项目数', role: 'total_projects' });
  addNumber(stats.aiProjects, { kind: 'total', field: 'stats.aiProjects', label: 'AI 项目数', role: 'ai_projects' });
  if (stats.avgStars !== undefined && stats.avgStars !== null) {
    add(stats.avgStars, { kind: 'total', field: 'stats.avgStars', label: '平均 Stars', role: 'avg_stars' });
  }

  const totalProjects = toNumber(stats.totalProjects) ?? projects.length;
  const aiProjects = toNumber(stats.aiProjects) ?? 0;
  add(totalProjects > 0 ? Math.round((aiProjects / totalProjects) * 100) : 0, {
    kind: 'total',
    field: 'stats.aiProjects',
    label: 'AI 项目占比（%）',
    role: 'ai_ratio',
  });
  add(maxTodayStars(projects), {
    kind: 'total',
    field: 'projects[*].todayStars',
    label: '最大黑马今日新增星',
    role: 'max_today',
  });

  addNumber(brief.weekNewStars ?? weekMetrics.weekNewStars, {
    kind: 'total',
    field: 'weekNewStars',
    label: '本周新增星合计',
    role: 'total_week',
  });

  const wow = weekMetrics.wow || {};
  addNumber(wow.previous, { kind: 'total', field: 'weekMetrics.wow.previous', label: '上周新增星合计', role: 'prev_week_total' });
  addNumber(wow.delta, { kind: 'total', field: 'weekMetrics.wow.delta', label: '较上周变化量', role: 'wow_delta' });
  addNumber(wow.rate, { kind: 'total', field: 'weekMetrics.wow.rate', label: '环比（%）', role: 'wow_rate' });
  addNumber(weekMetrics.churnCount, { kind: 'total', field: 'weekMetrics.churnCount', label: '换血项目数', role: 'churn_count' });
  addNumber(weekMetrics.churnRate, { kind: 'total', field: 'weekMetrics.churnRate', label: '换血率（%）', role: 'churn_rate' });

  addNumber(prevWeekStats.totalProjects, {
    kind: 'total',
    field: 'prevWeekStats.totalProjects',
    label: '上周上榜项目数',
    role: 'prev_total_projects',
  });
  addNumber(prevWeekStats.aiProjects, {
    kind: 'total',
    field: 'prevWeekStats.aiProjects',
    label: '上周 AI 项目数',
    role: 'prev_ai_projects',
  });
  if (prevWeekStats.avgStars !== undefined && prevWeekStats.avgStars !== null) {
    add(prevWeekStats.avgStars, { kind: 'total', field: 'prevWeekStats.avgStars', label: '上周平均 Stars', role: 'prev_avg_stars' });
  }
  addNumber(prevWeekStats.newStarsTotal, {
    kind: 'total',
    field: 'prevWeekStats.newStarsTotal',
    label: '上周新增星合计',
    role: 'prev_week_total',
  });

  const dailyCounts = brief.dailyCounts ?? weekMetrics.dailyCounts ?? [];
  const weekDates = history.getISOWeekDates(brief.weekStart || brief.week || brief.date);
  dailyCounts.forEach((count, index) => {
    addNumber(count, {
      kind: 'total',
      field: `dailyCounts[${index}]`,
      label: `日报项目数 ${weekDates[index] || index + 1}`,
      role: 'daily_count',
    });
  });

  const newProjects = weekMetrics.new || [];
  const continuing = weekMetrics.continuing || [];
  const returning = weekMetrics.returning || [];
  const out = weekMetrics.out || [];
  add(newProjects.length, { kind: 'total', field: 'weekMetrics.new', label: '本周新面孔数', role: 'new' });
  add(continuing.length, { kind: 'total', field: 'weekMetrics.continuing', label: '本周连续在榜数', role: 'kept' });
  add(returning.length, { kind: 'total', field: 'weekMetrics.returning', label: '本周回归数', role: 'returned' });
  add(out.length, { kind: 'total', field: 'weekMetrics.out', label: '本周出局数', role: 'dropped' });

  (weekMetrics.dailyTop3Stats || []).forEach((item, index) => {
    if (!item.fullName) return;
    addNumber(item.days, {
      project: item.fullName,
      field: `weekMetrics.dailyTop3Stats[${index}].days`,
      label: `${item.fullName} 本周日报上榜天数`,
      role: 'top3_days',
    });
    addNumber(item.weekStars, {
      project: item.fullName,
      field: `weekMetrics.dailyTop3Stats[${index}].weekStars`,
      label: `${item.fullName} 本周日报新增星`,
      role: 'top3_stars',
    });
  });

  projects.forEach((project, index) => {
    const fullName = history.projectKey(project);
    if (!fullName) return;
    addNumber(project.todayStars, {
      project: fullName,
      field: `projects[${index}].todayStars`,
      label: `${fullName} 本周新增星`,
      role: 'week_stars',
    });
    addNumber(project.stars, {
      project: fullName,
      field: `projects[${index}].stars`,
      label: `${fullName} 累计 Stars`,
      role: 'stars',
    });
    addNumber(project.forks, {
      project: fullName,
      field: `projects[${index}].forks`,
      label: `${fullName} Fork 数`,
      role: 'forks',
    });
  });

  for (const threshold of THRESHOLDS.weekly) {
    add(threshold.value, {
      kind: 'threshold',
      field: threshold.field,
      label: threshold.label,
      role: 'threshold',
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
    role: 'total_projects',
  });
  addNumber(stats.aiProjects, { kind: 'total', field: 'stats.aiProjects', label: 'AI 项目数', role: 'ai_projects' });
  if (stats.avgStars !== undefined && stats.avgStars !== null) {
    add(stats.avgStars, { kind: 'total', field: 'stats.avgStars', label: '平均 Stars', role: 'avg_stars' });
  }
  addNumber(stats.newStarsTotal, {
    kind: 'total',
    field: 'stats.newStarsTotal',
    label: '本月新增星合计',
    role: 'total_month',
  });
  addNumber(stats.recurringProjects, {
    kind: 'total',
    field: 'stats.recurringProjects',
    label: '重复上榜项目数（上榜 ≥2 天）',
    role: 'recurring',
  });
  addNumber(stats.newProjects, { kind: 'total', field: 'stats.newProjects', label: '新秀数', role: 'new' });
  addNumber(stats.priorProjects, { kind: 'total', field: 'stats.priorProjects', label: '非新秀项目数', role: 'prior' });
  addNumber(stats.top5Share, {
    kind: 'total',
    field: 'stats.top5Share',
    label: 'Top5 头部集中度（%）',
    role: 'top5_share',
  });

  addNumber(prevMonthStats.projects, {
    kind: 'total',
    field: 'prevMonthStats.projects',
    label: '上月总项目数',
    role: 'prev_total_projects',
  });
  addNumber(prevMonthStats.newStarsTotal, {
    kind: 'total',
    field: 'prevMonthStats.newStarsTotal',
    label: '上月新增星合计',
    role: 'prev_month_total',
  });
  addNumber(prevMonthStats.rookies, {
    kind: 'total',
    field: 'prevMonthStats.rookies',
    label: '上月新秀数',
    role: 'prev_new',
  });
  addNumber(prevMonthStats.priorProjects, {
    kind: 'total',
    field: 'prevMonthStats.priorProjects',
    label: '上月非新秀项目数',
    role: 'prev_prior',
  });
  addNumber(prevMonthStats.top5Share, {
    kind: 'total',
    field: 'prevMonthStats.top5Share',
    label: '上月 Top5 头部集中度（%）',
    role: 'prev_top5_share',
  });

  allItems.forEach((item, index) => {
    const fullName = item.fullName;
    if (!fullName) return;
    addNumber(item.monthStars, {
      project: fullName,
      field: `${itemField}[${index}].monthStars`,
      label: `${fullName} 本月新增星`,
      role: 'month_stars',
    });
    addNumber(item.daysOnList, {
      project: fullName,
      field: `${itemField}[${index}].daysOnList`,
      label: `${fullName} 上榜天数`,
      role: 'days_on_list',
    });
    addNumber(item.lastStars, {
      project: fullName,
      field: `${itemField}[${index}].lastStars`,
      label: `${fullName} 累计 Stars`,
      role: 'stars',
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
      role: 'prev_rank',
    });
    addNumber(item.prevMonthStars, {
      project: fullName,
      field: `dropList[${index}].prevMonthStars`,
      label: `${fullName} 上月新增星`,
      role: 'prev_month_stars',
    });
    addNumber(item.currentRank, {
      project: fullName,
      field: `dropList[${index}].currentRank`,
      label: `${fullName} 本月排名`,
      role: 'current_rank',
    });
    addNumber(item.currentMonthStars, {
      project: fullName,
      field: `dropList[${index}].currentMonthStars`,
      label: `${fullName} 本月新增星`,
      role: 'month_stars',
    });
  });

  for (const threshold of THRESHOLDS.monthly) {
    add(threshold.value, {
      kind: 'threshold',
      field: threshold.field,
      label: threshold.label,
      role: 'threshold',
    });
  }

  return Array.from(new Set(allItems.map(item => item.fullName).filter(Boolean)));
}

function buildFacts({ level, period, brief, metrics }) {
  if (!brief || !BRIEF_PATHS[level] || !period) return null;

  const file = BRIEF_PATHS[level](period);
  const facts = [];

  const add = (value, { project = null, kind = 'single', field, label, role, source, current, reference, comparison }) => {
    if (value === undefined || value === null) return null;
    const fact = {
      id: `f${facts.length + 1}`,
      value,
      project: project || null,
      kind,
      source: source || `${file}#${field}`,
      label,
      role: role || null,
    };
    if (current !== undefined) fact.current = current;
    if (reference !== undefined) fact.reference = reference;
    if (comparison !== undefined) fact.comparison = comparison;
    facts.push(fact);
    return fact.id;
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
