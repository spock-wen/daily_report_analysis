const history = require('./history');

const WEEKLY_CAPTION = '口径：新增＝GitHub Trending 周榜当期 stars this period（todayStars）；周日期按 ISO 周一至周日；环比对比上周新增合计；换血率＝本周榜单中上周未出现的项目数÷本周榜单项目数；连续/回归按上周周榜与近 30 天日榜判定。';

function round1(value) {
  return Math.round(value * 10) / 10;
}

function sumTodayStars(projects) {
  return (projects || []).reduce((sum, project) => {
    return sum + (Number(project?.todayStars) || 0);
  }, 0);
}

function readDailyEntries(dates) {
  return dates.map(date => ({ date, brief: history.readDailyBrief(date) }));
}

function getRecentDailyNames(beforeDate, days = 30) {
  const from = history.addDays(beforeDate, -days);
  const names = new Set();
  for (const date of history.listDailyDates()) {
    if (date < from || date >= beforeDate) continue;
    const brief = history.readDailyBrief(date);
    for (const name of history.getProjectNames(brief)) names.add(name);
  }
  return names;
}

function computeDailyAppearances(dates) {
  const byProject = new Map();

  for (const date of dates) {
    const brief = history.readDailyBrief(date);
    for (const project of brief?.projects || []) {
      const key = history.projectKey(project);
      if (!key) continue;
      if (!byProject.has(key)) {
        byProject.set(key, { fullName: key, days: 0, weekStars: 0 });
      }
      const entry = byProject.get(key);
      entry.days += 1;
      entry.weekStars += Number(project.todayStars) || 0;
    }
  }

  return Array.from(byProject.values());
}

function computeWeeklyMetrics(week, options = {}) {
  const brief = options.brief || history.readWeeklyBrief(week);
  if (!brief) return null;

  const projects = brief.projects || [];
  const currentNames = history.getProjectNames(brief);
  const currentSet = new Set(currentNames);
  const weekNewStars = sumTodayStars(projects);

  const prevWeek = history.shiftISOWeek(week, -1);
  const prevBrief = prevWeek ? history.readWeeklyBrief(prevWeek) : null;
  const prevProjects = prevBrief?.projects || [];
  const prevNames = history.getProjectNames(prevBrief);
  const prevSet = new Set(prevNames);
  const prevWeekNewStars = sumTodayStars(prevProjects);
  const prevStats = prevBrief?.stats || {};

  const prevWeekStats = {
    ...prevStats,
    week: prevWeek,
    newStarsTotal: prevWeekNewStars,
  };

  const delta = weekNewStars - prevWeekNewStars;
  const wow = {
    week: prevWeek,
    current: weekNewStars,
    previous: prevWeekNewStars,
    delta,
    rate: prevWeekNewStars > 0 ? round1((delta / prevWeekNewStars) * 100) : null,
  };

  const churnCount = currentNames.filter(name => !prevSet.has(name)).length;
  const churnRate = currentNames.length > 0
    ? round1((churnCount / currentNames.length) * 100)
    : 0;

  const dates = history.getISOWeekDates(week);
  const dailyEntries = readDailyEntries(dates);
  const dailyCounts = dailyEntries.map(entry => {
    return entry.brief ? (entry.brief.projects || []).length : null;
  });

  const startDate = dates[0];
  const recentDailyNames = startDate ? getRecentDailyNames(startDate, 30) : new Set();

  const newProjects = [];
  const continuing = [];
  const returning = [];
  for (const name of currentNames) {
    if (prevSet.has(name)) {
      continuing.push(name);
    } else if (recentDailyNames.has(name)) {
      returning.push(name);
    } else {
      newProjects.push(name);
    }
  }
  const out = prevNames.filter(name => !currentSet.has(name));

  const dailyAppearances = computeDailyAppearances(dates)
    .sort((a, b) => {
      if (b.days !== a.days) return b.days - a.days;
      if (b.weekStars !== a.weekStars) return b.weekStars - a.weekStars;
      return a.fullName.localeCompare(b.fullName);
    });
  const dailyTop3 = dailyAppearances.slice(0, 3).map(item => item.fullName);

  return {
    week,
    startDate,
    endDate: dates[6] || null,
    weekNewStars,
    prevWeekStats,
    wow,
    churnCount,
    churnRate,
    dailyCounts,
    new: newProjects,
    continuing,
    returning,
    out,
    dailyTop3,
    dailyTop3Stats: dailyAppearances.slice(0, 3),
    caption: WEEKLY_CAPTION,
  };
}

function enrichWeeklyBrief(brief, options = {}) {
  if (!brief) return null;
  const week = options.week || brief.weekStart || brief.date;
  if (!history.getISOWeekStart(week)) return null;

  const metrics = computeWeeklyMetrics(week, { brief });
  if (!metrics) return null;

  brief.prevWeekStats = metrics.prevWeekStats;
  brief.dailyCounts = metrics.dailyCounts;
  brief.weekNewStars = metrics.weekNewStars;
  brief.weekMetrics = metrics;
  brief.caption = metrics.caption;

  return metrics;
}

module.exports = {
  WEEKLY_CAPTION,
  computeWeeklyMetrics,
  enrichWeeklyBrief,
};
