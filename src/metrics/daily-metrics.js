const history = require('./history');

const DAILY_CAPTION = '口径：新增＝GitHub Trending 当期 stars this period（todayStars）；「较上期」指与抓取日早于本期的最近一份快照相比，同一抓取日不比较，无更早快照时写「无基准」；连续上榜天数按抓取日计，最多回看 30 天，缺数据日不中断；回归＝基准快照未上榜但近 30 天日榜出现过。';

function computeDailyMetrics(date, options = {}) {
  if (!history.DATE_RE.test(String(date || ''))) return null;

  const brief = options.brief || history.readDailyBrief(date);
  if (!brief) return null;

  const currentNames = history.getProjectNames(brief);
  const currentSet = new Set(currentNames);

  // J1：基准按 brief 内 scrapedAt（缺则 generatedAt）的 SGT 抓取日判定，不按文件名。
  const snapshot = options.scrapedAt || brief.scrapedAt || brief.generatedAt;
  const baseline = history.getBaselineSnapshot(snapshot);
  const prevDate = baseline ? baseline.date : null;
  const prevBrief = baseline ? baseline.brief : null;
  const prevNames = history.getProjectNames(prevBrief);
  const prevSet = new Set(prevNames);
  const hasBaseline = Boolean(baseline);

  const recentEntries = history.getBaselineSnapshots(snapshot, 30);
  const recentSets = recentEntries.map(entry => ({
    date: entry.date,
    names: new Set(history.getProjectNames(entry.brief)),
  }));
  const recentSet = new Set();
  for (const entry of recentSets) {
    for (const name of entry.names) recentSet.add(name);
  }

  const streakFor = (name) => {
    let streak = 1;
    for (const entry of recentSets) {
      if (entry.names.has(name)) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  };

  const newProjects = [];
  const returned = [];
  const kept = [];
  const tags = {};
  const streakDays = {};

  for (const name of currentNames) {
    const streak = streakFor(name);
    streakDays[name] = streak;

    if (prevSet.has(name)) {
      kept.push(name);
      tags[name] = `连续${streak}天`;
      continue;
    }

    if (!hasBaseline) continue;

    newProjects.push(name);
    if (recentSet.has(name)) {
      returned.push(name);
      tags[name] = '回归';
    } else {
      tags[name] = '新';
    }
  }

  const dropped = hasBaseline ? prevNames.filter(name => !currentSet.has(name)) : [];

  return {
    date,
    dailyDiff: {
      prevDate,
      label: hasBaseline ? '较上期' : '无基准',
      new: newProjects,
      dropped,
      kept,
      returned,
      counts: hasBaseline
        ? {
            new: newProjects.length,
            dropped: dropped.length,
            kept: kept.length,
            returned: returned.length,
          }
        : {
            new: null,
            dropped: null,
            kept: null,
            returned: null,
          },
    },
    streakDays,
    tags,
    caption: DAILY_CAPTION,
  };
}

function enrichDailyBrief(brief, options = {}) {
  if (!brief) return null;
  const date = options.date || brief.date;
  const metrics = computeDailyMetrics(date, { brief });
  if (!metrics) return null;

  brief.dailyDiff = metrics.dailyDiff;
  brief.streakDays = metrics.streakDays;
  brief.caption = metrics.caption;

  for (const project of brief.projects || []) {
    const key = history.projectKey(project);
    if (key && metrics.tags[key]) project.tag = metrics.tags[key];
  }

  return metrics;
}

module.exports = {
  DAILY_CAPTION,
  computeDailyMetrics,
  enrichDailyBrief,
};
