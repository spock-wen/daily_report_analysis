const history = require('./history');

const MONTHLY_CAPTION = '口径：本月新增星由日榜回算（当月最后一次出现 stars − 首次出现前一有数据日 stars；前一日不在榜则用首次出现日 stars − 当日 todayStars）；上榜天数只算日榜日期；新秀为当月首次进入日榜且此前 30 天日榜未出现的项目；头部集中度＝新增星 Top5 之和÷当月新增星合计。';

function round1(value) {
  return Math.round(value * 10) / 10;
}

function formatAvgStars(value) {
  const avg = Number(value) || 0;
  return avg >= 1000 ? `${(avg / 1000).toFixed(0)}k` : `${avg}`;
}

function getProjectStars(project) {
  return Number(project?.stars) || 0;
}

function getTodayStars(project) {
  return Number(project?.todayStars) || 0;
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

function buildMonthCore(month) {
  const entries = history.getMonthDailyEntries(month);
  const projects = new Map();

  for (const entry of entries) {
    for (const project of entry.brief.projects || []) {
      const key = history.projectKey(project);
      if (!key) continue;

      if (!projects.has(key)) {
        projects.set(key, {
          fullName: key,
          project,
          firstDate: entry.date,
          firstStars: getProjectStars(project),
          firstTodayStars: getTodayStars(project),
          lastDate: entry.date,
          lastStars: getProjectStars(project),
          days: new Set(),
          isAI: !!project.isAI,
        });
      }

      const item = projects.get(key);
      item.lastDate = entry.date;
      item.lastStars = getProjectStars(project);
      item.days.add(entry.date);
      item.isAI = item.isAI || !!project.isAI;
    }
  }

  const items = [];
  for (const item of projects.values()) {
    const prevDate = history.getPreviousDailyDate(item.firstDate);
    const prevBrief = prevDate ? history.readDailyBrief(prevDate) : null;
    const prevProject = (prevBrief?.projects || []).find(project => {
      return history.projectKey(project) === item.fullName;
    });

    let baselineStars;
    let baselineDate;
    if (prevProject) {
      baselineStars = getProjectStars(prevProject);
      baselineDate = prevDate;
    } else {
      baselineStars = item.firstStars - item.firstTodayStars;
      baselineDate = item.firstDate;
    }

    items.push({
      fullName: item.fullName,
      monthStars: Math.max(0, item.lastStars - baselineStars),
      daysOnList: item.days.size,
      firstDate: item.firstDate,
      lastDate: item.lastDate,
      firstStars: item.firstStars,
      lastStars: item.lastStars,
      baselineStars,
      baselineDate,
      isAI: item.isAI,
      project: item.project,
    });
  }

  items.sort((a, b) => {
    if (b.monthStars !== a.monthStars) return b.monthStars - a.monthStars;
    if (b.daysOnList !== a.daysOnList) return b.daysOnList - a.daysOnList;
    return a.fullName.localeCompare(b.fullName);
  });

  const newStarsTotal = items.reduce((sum, item) => sum + item.monthStars, 0);
  const top5Stars = items.slice(0, 5).reduce((sum, item) => sum + item.monthStars, 0);
  const top5Share = newStarsTotal > 0 ? round1((top5Stars / newStarsTotal) * 100) : 0;
  const avgStars = items.length > 0
    ? items.reduce((sum, item) => sum + item.lastStars, 0) / items.length
    : 0;

  const recentNamesCache = new Map();
  const rookies = [];
  for (const item of items) {
    let recent = recentNamesCache.get(item.firstDate);
    if (!recent) {
      recent = getRecentDailyNames(item.firstDate, 30);
      recentNamesCache.set(item.firstDate, recent);
    }
    if (!recent.has(item.fullName)) {
      rookies.push({
        fullName: item.fullName,
        firstDate: item.firstDate,
        monthStars: item.monthStars,
      });
    }
  }

  const stats = {
    totalProjects: items.length,
    aiProjects: items.filter(item => item.isAI).length,
    avgStars: formatAvgStars(avgStars),
    newStarsTotal,
    priorProjects: items.length - rookies.length,
  };

  return {
    month,
    dailyDates: entries.map(entry => entry.date),
    items,
    stats,
    newStarsTotal,
    top5Share,
    rookies,
    rookiesCount: rookies.length,
  };
}

function buildWeekThemes(month) {
  return history.getWeeksInMonth(month).map(week => {
    const startDate = history.getISOWeekStart(week);
    const insights = history.readWeeklyInsights(week);
    const weeklyTheme = insights?.weeklyTheme;
    const theme = typeof weeklyTheme === 'string'
      ? weeklyTheme
      : (weeklyTheme?.oneLiner || null);

    return {
      week,
      startDate,
      endDate: startDate ? history.addDays(startDate, 6) : null,
      theme,
    };
  });
}

function buildDropList(prevCore, currentCore) {
  const currentRank = new Map();
  currentCore.items.forEach((item, index) => currentRank.set(item.fullName, index + 1));
  const currentTop10 = new Set(currentCore.items.slice(0, 10).map(item => item.fullName));

  const dropList = [];
  prevCore.items.slice(0, 10).forEach((item, index) => {
    if (currentTop10.has(item.fullName)) return;
    dropList.push({
      fullName: item.fullName,
      prevMonth: prevCore.month,
      prevRank: index + 1,
      prevMonthStars: item.monthStars,
      currentRank: currentRank.get(item.fullName) || null,
      currentMonthStars: currentRank.has(item.fullName)
        ? currentCore.items[currentRank.get(item.fullName) - 1].monthStars
        : null,
    });
  });

  return dropList;
}

function computeMonthlyMetrics(month) {
  const current = buildMonthCore(month);
  const prevMonth = history.getPrevMonth(month);
  const previous = prevMonth ? buildMonthCore(prevMonth) : null;

  const weekThemes = buildWeekThemes(month);
  const top = current.items.map(item => ({
    fullName: item.fullName,
    monthStars: item.monthStars,
    daysOnList: item.daysOnList,
    firstDate: item.firstDate,
    lastDate: item.lastDate,
    firstStars: item.firstStars,
    lastStars: item.lastStars,
    baselineStars: item.baselineStars,
    baselineDate: item.baselineDate,
    isAI: item.isAI,
  }));

  const prevMonthStats = previous
    ? {
        projects: previous.stats.totalProjects,
        newStarsTotal: previous.stats.newStarsTotal,
        rookies: previous.rookiesCount,
        priorProjects: previous.stats.totalProjects - previous.rookiesCount,
        top5Share: previous.top5Share,
      }
    : {
        projects: 0,
        newStarsTotal: 0,
        rookies: 0,
        priorProjects: 0,
        top5Share: 0,
      };

  const dropList = previous ? buildDropList(previous, current) : [];
  const dropListNote = dropList.length > 0 ? null : '本月无回落';

  return {
    month,
    dailyDates: current.dailyDates,
    stats: current.stats,
    newStarsTotal: current.newStarsTotal,
    top5Share: current.top5Share,
    top,
    monthTop: top.slice(0, 10),
    rookies: current.rookies,
    rookiesCount: current.rookiesCount,
    prevMonthStats,
    weekThemes,
    dropList,
    dropListNote,
    caption: MONTHLY_CAPTION,
  };
}

function enrichMonthlyBrief(brief, options = {}) {
  if (!brief) return null;
  const month = options.month || brief.month || brief.date;
  if (!month) return null;

  const metrics = computeMonthlyMetrics(month);

  brief.stats = {
    ...metrics.stats,
    recurringProjects: metrics.top.filter(item => item.daysOnList >= 2).length,
    newProjects: metrics.rookiesCount,
    priorProjects: metrics.stats.totalProjects - metrics.rookiesCount,
    top5Share: metrics.top5Share,
  };
  brief.prevMonthStats = metrics.prevMonthStats;
  brief.weekThemes = metrics.weekThemes;
  brief.monthTop = metrics.monthTop;
  brief.dropList = metrics.dropList;
  if (metrics.dropListNote) {
    brief.dropListNote = metrics.dropListNote;
  } else {
    delete brief.dropListNote;
  }
  brief.caption = metrics.caption;

  return metrics;
}

module.exports = {
  MONTHLY_CAPTION,
  computeMonthlyMetrics,
  enrichMonthlyBrief,
};
