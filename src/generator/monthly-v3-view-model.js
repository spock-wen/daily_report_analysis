'use strict';

const fs = require('fs');
const nodePath = require('path');
const mustache = require('mustache');
const history = require('../metrics/history');
const monthlyMetrics = require('../metrics/monthly-metrics');
const {
  TEMPLATE_DIR,
  readCss,
  formatCount,
  formatPct,
  formatPt,
  clsDelta,
  projectKey,
  projectBlurb,
  trackOf,
  trackLabelOfType,
  buildNav,
  oneLiner,
  detailed,
} = require('./wmh-v3-shared');
const {
  renderDailyLineSvg,
  dailyLineFootnote,
  renderWeekBarsSvg,
  weekBarsFootnote,
} = require('./wmh-svg-charts');

const TEMPLATE_PATH = nodePath.join(TEMPLATE_DIR, 'monthly.mustache');

function pctChange(curr, prev) {
  if (!Number.isFinite(prev) || prev === 0 || !Number.isFinite(curr)) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function findDailyPeak(month, items) {
  const dates = history.getMonthDailyEntries(month).map(e => e.date);
  let best = null;
  for (const date of dates) {
    const brief = history.readDailyBrief(date);
    for (const p of brief?.projects || []) {
      const stars = Number(p.todayStars) || 0;
      if (!best || stars > best.stars) {
        best = { fullName: projectKey(p), stars, date };
      }
    }
  }
  // 若日榜扫不到，退回月榜 todayStars 峰值字段缺失时用 monthStars 最大者
  if (!best && items?.[0]) {
    best = { fullName: items[0].fullName, stars: items[0].monthStars, date: items[0].lastDate };
  }
  return best;
}

function langRowsFromAgg(currAgg, prevAgg) {
  const curr = currAgg?.languageDistribution || {};
  const prev = prevAgg?.languageDistribution || {};
  const keys = Array.from(new Set([...Object.keys(curr), ...Object.keys(prev)]))
    .filter(k => k && k !== 'Unknown')
    .sort((a, b) => (Number(curr[b]) || 0) - (Number(curr[a]) || 0));
  return keys.slice(0, 6).map(lang => {
    const c = Number(curr[lang]) || 0;
    const p = Number(prev[lang]) || 0;
    const rate = pctChange(c, p);
    return {
      label: lang,
      count: c,
      countRate: rate == null ? '—' : formatPct(rate, 0),
      countCls: clsDelta(rate),
      // 星数环比：aggregation 无星分布时用项目数环比占位并标注
      starRate: rate == null ? '—' : formatPct(rate, 0),
      starCls: clsDelta(rate),
    };
  });
}

function domainRowsFromAgg(currAgg, prevAgg) {
  const curr = currAgg?.typeDistribution || {};
  const prev = prevAgg?.typeDistribution || {};
  const currTotal = Object.values(curr).reduce((s, n) => s + (Number(n) || 0), 0) || 1;
  const prevTotal = Object.values(prev).reduce((s, n) => s + (Number(n) || 0), 0) || 1;
  const keys = Array.from(new Set([...Object.keys(curr), ...Object.keys(prev)]))
    .sort((a, b) => (Number(curr[b]) || 0) - (Number(curr[a]) || 0));
  return keys.slice(0, 6).map(type => {
    const c = Number(curr[type]) || 0;
    const p = Number(prev[type]) || 0;
    const cShare = Math.round((c / currTotal) * 1000) / 10;
    const pShare = Math.round((p / prevTotal) * 1000) / 10;
    const delta = Math.round((cShare - pShare) * 10) / 10;
    return {
      label: trackLabelOfType(type),
      share: `${cShare}%`,
      prevShare: `${pShare}%`,
      delta: formatPt(delta),
      deltaCls: clsDelta(delta),
    };
  });
}

function buildInsights(ai, dropList, dropListNote, domainRows) {
  const items = [];
  const theme = detailed(ai?.monthlyTheme);
  if (theme) {
    items.push({ title: '月度主线', body: theme.slice(0, 800) });
  }
  const expansion = (domainRows || []).filter(r => r.deltaCls === 'up').slice(0, 2);
  if (expansion.length) {
    items.push({
      title: '扩张面',
      body: expansion.map(r => `${r.label} 占比 ${r.share}（上月 ${r.prevShare}，${r.delta}）`).join('；') + '。',
    });
  }
  if (dropList && dropList.length > 0) {
    const lines = dropList.slice(0, 6).map(d => {
      const now = d.currentRank ? `本月第 ${d.currentRank}` : '未进 Top10';
      return `${d.fullName}（上月第 ${d.prevRank}，${now}）`;
    });
    items.push({ title: '回落清单', body: lines.join('；') + '。' });
  } else {
    items.push({ title: '回落清单', body: dropListNote || '本月无回落。' });
  }
  const longTerm = Array.isArray(ai?.longTermValue) ? ai.longTermValue : [];
  if (longTerm[0]) {
    const lt = longTerm[0];
    const name = lt.repo || lt.fullName || lt.name || '粘性项目';
    const reason = Array.isArray(lt.reasons) ? lt.reasons.join('；') : (lt.reason || lt.summary || '');
    if (reason) items.push({ title: `生命周期：${name}`, body: String(reason).slice(0, 600) });
  }
  const evolution = ai?.trendEvolution;
  if (evolution && items.length < 4) {
    const body = typeof evolution === 'string'
      ? evolution
      : [evolution.early || evolution.earlyMonth, evolution.mid || evolution.midMonth, evolution.late || evolution.lateMonth]
        .filter(Boolean)
        .join('；');
    if (body) items.push({ title: '月内节奏', body: String(body).slice(0, 600) });
  }
  return items.slice(0, 5).map((item, idx) => ({ index: idx + 1, title: item.title, body: item.body }));
}

function buildViewModel(data) {
  const month = data.month || data.date;
  const metrics = data._metrics
    || monthlyMetrics.computeMonthlyMetrics(month)
    || {};
  const ai = data.aiInsights || {};
  const prevMonth = history.getPrevMonth(month);
  const prevBrief = prevMonth ? history.readMonthlyBrief(prevMonth) : null;
  const currAgg = data.aggregation || {};
  const prevAgg = prevBrief?.aggregation || {};

  const stats = {
    ...(metrics.stats || {}),
    ...(data.stats || {}),
  };
  const prev = metrics.prevMonthStats || data.prevMonthStats || {};
  const top = (metrics.monthTop || data.monthTop || metrics.top || []).slice(0, 12);
  const rookies = metrics.rookies || [];
  const weekThemes = metrics.weekThemes || data.weekThemes || [];
  const dropList = metrics.dropList || data.dropList || [];
  const dropListNote = metrics.dropListNote || data.dropListNote;

  const newStars = metrics.newStarsTotal ?? stats.newStarsTotal ?? 0;
  const prevStars = prev.newStarsTotal || 0;
  const starsRate = pctChange(newStars, prevStars);
  const rookiesCount = metrics.rookiesCount ?? stats.newProjects ?? rookies.length;
  const totalProjects = stats.totalProjects || metrics.stats?.totalProjects || top.length;
  const rookieShare = totalProjects > 0 ? Math.round((rookiesCount / totalProjects) * 1000) / 10 : 0;
  const prevRookieShare = prev.projects > 0 ? Math.round((prev.rookies / prev.projects) * 1000) / 10 : 0;
  const top5Share = metrics.top5Share ?? stats.top5Share ?? 0;
  const avgDays = top.length
    ? Math.round((top.reduce((s, i) => s + (Number(i.daysOnList) || 0), 0) / top.length) * 10) / 10
    : null;

  const themeLine = oneLiner(ai.monthlyTheme) || `月报 ${month}`;

  const patternChanges = [];
  patternChanges.push(`新秀占比 ${rookieShare}%（上月 ${prevRookieShare}%）。`);
  patternChanges.push(`Top5 集中度 ${top5Share}%（上月 ${prev.top5Share ?? '—'}%）。`);
  if (avgDays != null) patternChanges.push(`Top 样本平均上榜天数 ${avgDays} 天。`);

  const persistence = [...top].sort((a, b) => (b.daysOnList || 0) - (a.daysOnList || 0))[0];
  const peak = findDailyPeak(month, top);
  const rookiePick = [...rookies].sort((a, b) => (b.monthStars || 0) - (a.monthStars || 0))[0]
    || top.find(item => rookies.some(r => r.fullName === item.fullName));

  const langRows = langRowsFromAgg(currAgg, prevAgg);
  const domainRows = domainRowsFromAgg(currAgg, prevAgg);
  const insights = buildInsights(ai, dropList, dropListNote, domainRows);

  const weekBars = weekThemes.slice(0, 4).map(w => ({
    week: w.week,
    theme: (w.theme || '主题待补').slice(0, 48),
    href: `../weekly/github-weekly-${w.week}.html`,
  }));

  // 四周新增柱：按周主题对应周 brief 的 todayStars 合计
  const weekStarBars = weekBars.map(w => {
    const brief = history.readWeeklyBrief(w.week);
    return { week: w.week, stars: sumToday(brief?.projects) };
  });
  const weekBarsSvg = renderWeekBarsSvg(weekStarBars);
  const weekBarsNote = weekBarsFootnote(weekStarBars);

  // 日度新增折线：月内每日 todayStars 合计
  const dailySeries = history.getMonthDailyEntries(month).map(entry => ({
    date: entry.date,
    stars: sumToday(entry.brief?.projects),
  }));
  const dailyLineSvg = renderDailyLineSvg(dailySeries, { month });
  const dailyLineNote = dailyLineFootnote(dailySeries);

  const topRows = top.map((item, idx) => {
    const p = item.project || {};
    return {
      rank: idx + 1,
      fullName: item.fullName,
      url: `https://github.com/${item.fullName}`,
      meta: [
        p.language || '',
        item.daysOnList != null ? `上榜 ${item.daysOnList} 天` : '',
      ].filter(Boolean).join(' · '),
      monthStars: formatCount(item.monthStars),
      totalStars: formatCount(item.lastStars || p.stars),
    };
  });

  const paths = {
    home: '../index.html',
    daily: '../daily/',
    weekly: '../weekly/',
    monthly: `github-monthly-${month}.html`,
  };

  const kpiRows = [
    { label: '月度新增星', value: `${formatCount(newStars)}${starsRate != null ? `（${formatPct(starsRate, 0)}）` : ''}` },
    { label: '新秀占比', value: `${rookieShare}%` },
    { label: 'Top 语言', value: langRows.slice(0, 2).map(r => r.label).join(' / ') || '—' },
    { label: 'Top 领域', value: domainRows[0] ? `${domainRows[0].label} ${domainRows[0].share}` : '—' },
    {
      label: '三王冠',
      value: [
        persistence ? `持久 ${persistence.fullName}` : null,
        peak ? `单日 ${peak.fullName}` : null,
        rookiePick ? `新秀 ${rookiePick.fullName}` : null,
      ].filter(Boolean).join(' · ') || '—',
    },
    { label: '头部集中度 Top5', value: `${top5Share}%` },
  ];

  return {
    css: readCss(),
    title: `月报 ${month} · GitHub AI Trending 洞察`,
    isFail: data.isFail === true,
    nav: buildNav('monthly', paths),
    brandHome: paths.home,
    crumbMonth: month,
    h1: themeLine,
    meta: `${month} ｜ 收录 ${totalProjects} 项目 ｜ 月度新增星 ${formatCount(newStars)}${prevMonth ? ` ｜ 对比月：${prevMonth}` : ''}`,
    patternRows: [
      {
        label: '月度新增星',
        curr: formatCount(newStars),
        prev: formatCount(prevStars),
        delta: starsRate == null ? '—' : formatPct(starsRate, 0),
        deltaCls: clsDelta(starsRate),
      },
      {
        label: '新秀占比',
        curr: `${rookieShare}%`,
        prev: `${prevRookieShare}%`,
        delta: formatPt(Math.round((rookieShare - prevRookieShare) * 10) / 10),
        deltaCls: clsDelta(rookieShare - prevRookieShare),
      },
      {
        label: '头部集中度 Top5',
        curr: `${top5Share}%`,
        prev: `${prev.top5Share ?? '—'}%`,
        delta: prev.top5Share != null
          ? (top5Share >= prev.top5Share ? '更集中' : '更分散')
          : '—',
        deltaCls: prev.top5Share != null && top5Share >= prev.top5Share ? 'dn' : 'up',
      },
      {
        label: '收录项目数',
        curr: String(totalProjects),
        prev: String(prev.projects ?? '—'),
        delta: prev.projects != null ? String(totalProjects - prev.projects) : '—',
        deltaCls: prev.projects != null ? clsDelta(totalProjects - prev.projects) : '',
      },
    ],
    patternChanges: patternChanges.map((text, i) => `${i + 1}）${text}`).join(''),
    themeLead: themeLine,
    topRows,
    crowns: [
      {
        title: '持久王',
        name: persistence?.fullName || '—',
        meta: persistence ? `上榜 ${persistence.daysOnList} 天 · 月增 ${formatCount(persistence.monthStars)}` : '数据不足',
      },
      {
        title: '单日星增王',
        name: peak?.fullName || '—',
        meta: peak ? `单日峰值 ${formatCount(peak.stars)}${peak.date ? ` · ${peak.date.slice(5)}` : ''}` : '数据不足',
      },
      {
        title: '新秀精选',
        name: rookiePick?.fullName || '—',
        meta: rookiePick ? `本月首次进榜 · 月增 ${formatCount(rookiePick.monthStars)}` : '数据不足',
      },
    ],
    langRows,
    domainRows,
    insights,
    weekBars,
    dailyLineSvg,
    dailyLineNote,
    weekBarsSvg,
    weekBarsNote,
    kpiRows,
    fullNote: `全量 Top ${top.length} 已列于上表。Wiki 仅文字入口，无域墙。`,
    wikiHref: '../wiki-index.html',
    caption: metrics.caption || monthlyMetrics.MONTHLY_CAPTION,
    footer: `报告站 · 月报 ${month} · r11c 趋势图 · 砍黑马/预测/Wiki域墙 · 静态 SVG · 热区 a::after≥44`,
  };
}

function sumToday(projects) {
  return (projects || []).reduce((s, p) => s + (Number(p.todayStars) || 0), 0);
}

function renderMonthlyV3(data) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return mustache.render(template, buildViewModel(data));
}

module.exports = {
  buildViewModel,
  renderMonthlyV3,
};
