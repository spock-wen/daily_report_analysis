'use strict';

const fs = require('fs');
const nodePath = require('path');
const mustache = require('mustache');
const history = require('../metrics/history');
const weeklyMetrics = require('../metrics/weekly-metrics');
const {
  TEMPLATE_DIR,
  readCss,
  formatCount,
  formatPct,
  clsDelta,
  projectKey,
  projectBlurb,
  trackOf,
  buildNav,
  oneLiner,
  detailed,
  takeTextList,
} = require('./wmh-v3-shared');
const {
  renderWeekTopSvg,
  weekTopFootnote,
} = require('./wmh-svg-charts');
const { latestReportHref, latestReaderPeriodHref } = require('./report-nav');

const TEMPLATE_PATH = nodePath.join(TEMPLATE_DIR, 'weekly.mustache');

function sumStars(projects) {
  return (projects || []).reduce((sum, p) => sum + (Number(p.todayStars) || 0), 0);
}

function projectMap(projects) {
  const map = new Map();
  for (const p of projects || []) {
    const key = projectKey(p);
    if (key) map.set(key, p);
  }
  return map;
}

function buildTrackRows(currProjects, prevProjects) {
  const buckets = new Map();
  const ensure = (label) => {
    if (!buckets.has(label)) buckets.set(label, { label, currSeats: 0, prevSeats: 0, currStars: 0, prevStars: 0 });
    return buckets.get(label);
  };
  for (const p of currProjects || []) {
    const b = ensure(trackOf(p));
    b.currSeats += 1;
    b.currStars += Number(p.todayStars) || 0;
  }
  for (const p of prevProjects || []) {
    const b = ensure(trackOf(p));
    b.prevSeats += 1;
    b.prevStars += Number(p.todayStars) || 0;
  }
  return Array.from(buckets.values())
    .filter(b => b.currSeats + b.prevSeats > 0)
    .sort((a, b) => b.currStars - a.currStars || b.currSeats - a.currSeats)
    .map(b => {
      const seatDelta = b.currSeats - b.prevSeats;
      const starRate = b.prevStars > 0 ? Math.round(((b.currStars - b.prevStars) / b.prevStars) * 1000) / 10 : null;
      let note = '稳态';
      if (seatDelta >= 2) note = '新面孔主导';
      else if (seatDelta <= -2) note = '席位让出';
      else if (starRate !== null && starRate >= 20) note = '热度上行';
      else if (starRate !== null && starRate <= -10) note = '热度回落';
      return {
        label: b.label,
        currSeats: b.currSeats,
        prevSeats: b.prevSeats,
        seatDeltaText: seatDelta === 0 ? '0' : (seatDelta > 0 ? `+${seatDelta}` : String(seatDelta)),
        seatCls: clsDelta(seatDelta),
        starRateText: starRate === null ? '—' : formatPct(starRate, starRate % 1 === 0 ? 0 : 1),
        starCls: clsDelta(starRate),
        note,
      };
    });
}

function rosterItems(names, byName, kind) {
  return (names || []).slice(0, 8).map(name => {
    const p = byName.get(name);
    const stars = Number(p?.todayStars) || 0;
    return {
      fullName: name,
      url: `https://github.com/${name}`,
      blurb: p ? projectBlurb(p) : '',
      valueText: stars > 0 ? formatCount(stars) : '—',
      valueUnit: '星',
      tag: kind === 'new' ? '新' : kind === 'cont' ? '连续' : '回归',
      tagCls: kind === 'new' ? 'acc' : kind === 'cont' ? 'pri' : '',
    };
  });
}

function buildHighlights(ai, metrics, tracks, projects) {
  const fromAi = takeTextList(ai?.highlights, 4);
  if (fromAi.length >= 3) return fromAi.slice(0, 4);
  const out = [...fromAi];
  const top = [...(projects || [])].sort((a, b) => (Number(b.todayStars) || 0) - (Number(a.todayStars) || 0))[0];
  const total = metrics.weekNewStars || 0;
  const topShare = top && total > 0 ? Math.round(((Number(top.todayStars) || 0) / total) * 100) : null;
  if (out.length < 4 && top && topShare !== null) {
    out.push(`总量结构：${projectKey(top)} 贡献约 ${topShare}% 周星；剔头部后看结构更稳。`);
  }
  if (out.length < 4 && metrics.churnRate != null) {
    out.push(`换血率 ${metrics.churnRate}%：本周名单相对上周新面孔 ${metrics.churnCount || 0} 个。`);
  }
  if (out.length < 4 && tracks[0]) {
    out.push(`赛道：${tracks[0].label} 席位 ${tracks[0].currSeats}（上周 ${tracks[0].prevSeats}），星数环比 ${tracks[0].starRateText}。`);
  }
  if (out.length < 4) {
    out.push('下周验证：头部仓连续三日日增是否守住阈值；跌破则集中度叙事需改写。');
  }
  return out.slice(0, 4);
}

function buildNarratives(ai, projects, tracks) {
  const deep = ai?.deepTrends;
  const items = [];
  if (deep && (deep.title || deep.summary || deep.content)) {
    const body = [deep.summary, deep.content].filter(Boolean).join('\n\n').trim();
    items.push({
      title: deep.title || '本周主线',
      body: body.slice(0, 900) || '（本期深度趋势正文待补）',
    });
  }
  for (const tp of (ai?.topProjects || []).slice(0, 3)) {
    if (items.length >= 3) break;
    const name = tp.repo || tp.fullName || tp.name;
    const reason = tp.reason || tp.value || '';
    if (!name || !reason) continue;
    if (items.some(it => it.body.includes(name) || it.title.includes(name))) continue;
    items.push({
      title: name,
      body: reason.slice(0, 600),
    });
  }
  for (const field of (ai?.emergingFields || []).slice(0, 3)) {
    if (items.length >= 3) break;
    const title = field.field || field.name;
    const body = field.description || '';
    if (!title || !body) continue;
    items.push({ title, body: body.slice(0, 600) });
  }
  if (items.length === 0 && tracks[0]) {
    items.push({
      title: `${tracks[0].label} 主导本周席位`,
      body: `本周 ${tracks[0].label} 席位 ${tracks[0].currSeats}（上周 ${tracks[0].prevSeats}），星数环比 ${tracks[0].starRateText}。头部项目与换血共同塑造集中度。`,
    });
  }
  while (items.length < 1) {
    const top = [...(projects || [])].sort((a, b) => (Number(b.todayStars) || 0) - (Number(a.todayStars) || 0))[0];
    items.push({
      title: top ? `${projectKey(top)} 拉动周星` : '本周结构',
      body: top
        ? `${projectKey(top)} 本周新增 ${formatCount(top.todayStars)} 星，是周榜主要增量来源。`
        : '本期可拆解的叙事不足，已用结构指标兜底。',
    });
  }
  return items.slice(0, 3).map((item, idx) => ({
    index: idx + 1,
    title: item.title,
    body: item.body,
  }));
}

function buildLookahead(ai, metrics, tracks, top) {
  const fromAi = takeTextList(ai?.nextWeekPoints, 3);
  if (fromAi.length > 0) return fromAi.slice(0, 3).map((text, i) => ({ index: i + 1, text }));
  const out = [];
  if (top) {
    out.push(`头部仓 ${projectKey(top)} 连续三日日增是否仍高于本周均值；跌破则改写集中度叙事。`);
  }
  if (metrics.churnRate != null) {
    out.push(`新面孔中是否有 ≥2 个进入「连续」栏（而非一次性冲榜）。`);
  }
  if (tracks[0]) {
    out.push(`${tracks[0].label} 席位能否守住 ${tracks[0].currSeats}；若明显回落，本周补位叙事不成立。`);
  }
  while (out.length < 1) out.push('关注下周换血率与头部集中度是否同步回落。');
  return out.slice(0, 3).map((text, i) => ({ index: i + 1, text }));
}

function buildViewModel(data) {
  const week = data.weekStart || data.week || data.date;
  const metrics = data.weekMetrics || weeklyMetrics.computeWeeklyMetrics(week, { brief: data }) || {};
  const projects = data.projects || data.trending_repos || [];
  const byName = projectMap(projects);
  const ai = data.aiInsights || {};
  const prevWeek = metrics.prevWeekStats?.week || history.shiftISOWeek(week, -1);
  const prevBrief = prevWeek ? history.readWeeklyBrief(prevWeek) : null;
  const prevProjects = prevBrief?.projects || [];

  const weekNewStars = metrics.weekNewStars ?? sumStars(projects);
  const prevNewStars = metrics.prevWeekStats?.newStarsTotal ?? sumStars(prevProjects);
  const sorted = [...projects].sort((a, b) => (Number(b.todayStars) || 0) - (Number(a.todayStars) || 0));
  const top1 = sorted[0];
  const top1Stars = Number(top1?.todayStars) || 0;
  const exHeadCurr = Math.max(0, weekNewStars - top1Stars);
  const prevSorted = [...prevProjects].sort((a, b) => (Number(b.todayStars) || 0) - (Number(a.todayStars) || 0));
  const prevTop1 = Number(prevSorted[0]?.todayStars) || 0;
  const exHeadPrev = Math.max(0, prevNewStars - prevTop1);
  const exHeadRate = exHeadPrev > 0 ? Math.round(((exHeadCurr - exHeadPrev) / exHeadPrev) * 1000) / 10 : null;
  const wowRate = metrics.wow?.rate;
  const top1Share = weekNewStars > 0 ? Math.round((top1Stars / weekNewStars) * 100) : null;

  const tracks = buildTrackRows(projects, prevProjects);
  const themeLine = oneLiner(ai.weeklyTheme) || (top1
    ? `${projectKey(top1)} 领涨，周星合计 ${formatCount(weekNewStars)}`
    : `周报 ${week}`);
  const startDate = metrics.startDate || data.weekStart || '';
  const endDate = metrics.endDate || data.weekEnd || '';
  const projectCount = projects.length;

  const overviewParts = [];
  overviewParts.push(`本周周星合计 ${formatCount(weekNewStars)}${wowRate != null ? `，环比 ${formatPct(wowRate, 1)}` : ''}。`);
  if (top1 && top1Share != null) {
    overviewParts.push(`Top1 ${projectKey(top1)} 独占约 ${top1Share}%。`);
  }
  if (tracks.length > 0) {
    const head = tracks.slice(0, 3).map(t => `${t.label} 席位 ${t.currSeats}（上周 ${t.prevSeats}），星数环比 ${t.starRateText}`).join('；');
    overviewParts.push(`分类上，${head}。`);
  }
  const dailyTop3 = metrics.dailyTop3Stats || [];
  if (dailyTop3.length > 0) {
    overviewParts.push(`日榜常客：${dailyTop3.map(item => `${item.fullName}（${item.days} 天）`).join('、')}。`);
  }

  const highlights = buildHighlights(ai, metrics, tracks, projects);
  const narratives = buildNarratives(ai, projects, tracks);
  const lookahead = buildLookahead(ai, metrics, tracks, top1);

  const fullList = sorted.map((p, idx) => ({
    rank: idx + 1,
    fullName: projectKey(p),
    url: p.url || `https://github.com/${projectKey(p)}`,
    blurb: projectBlurb(p),
    stars: formatCount(p.todayStars),
    track: trackOf(p),
  }));

  const paths = {
    home: '../index.html',
    daily: latestReportHref('daily', { prefix: '../', fallbackId: startDate || null }),
    weekly: latestReportHref('weekly', { prefix: '../', fallbackId: week }),
    monthly: latestReaderPeriodHref('monthly', { prefix: '../' }) || '',
  };

  const topRows = sorted.slice(0, 10).map(p => ({
    fullName: projectKey(p),
    stars: Number(p.todayStars) || 0,
  }));
  const topChartSvg = renderWeekTopSvg(topRows, {
    total: weekNewStars,
    top1Share,
    restTotal: Math.max(0, weekNewStars - top1Stars),
    exHeadRate,
  });
  const topChartNote = weekTopFootnote(topRows, {
    total: weekNewStars,
    top1Share,
    restTotal: Math.max(0, weekNewStars - top1Stars),
    exHeadRate,
  });

  return {
    css: readCss(),
    title: `周报 ${week} · GitHub AI Trending 洞察`,
    isFail: data.isFail === true,
    nav: buildNav('weekly', paths),
    brandHome: paths.home,
    crumbWeek: week,
    h1: themeLine,
    meta: `${startDate || '—'} — ${endDate || '—'} ｜ 上榜 ${projectCount} 项目 ｜ 本周新增 Star ${formatCount(weekNewStars)}${wowRate != null ? ` ｜ 环比 ${formatPct(wowRate, 1)}` : ''}${exHeadRate != null ? `（剔除头部后 ${formatPct(exHeadRate, 0)}）` : ''}`,
    metrics: [
      {
        label: '本周新增合计',
        value: formatCount(weekNewStars),
        caption: wowRate != null ? `环比 ${formatPct(wowRate, 1)}` : '上周无可比',
        captionCls: clsDelta(wowRate),
      },
      {
        label: '环比（剔头部）',
        value: exHeadRate != null ? formatPct(exHeadRate, 0) : '—',
        caption: '去掉 Top1 后',
        captionCls: '',
      },
      {
        label: '换血率',
        value: metrics.churnRate != null ? `${metrics.churnRate}%` : '—',
        caption: '新面孔占比',
        captionCls: '',
      },
      {
        label: '上榜项目数',
        value: String(projectCount),
        caption: prevBrief ? `上周 ${(prevBrief.projects || []).length}` : '上周 —',
        captionCls: '',
      },
    ],
    caption: metrics.caption || weeklyMetrics.WEEKLY_CAPTION,
    highlights,
    overviewText: overviewParts.join(''),
    topChartSvg,
    topChartNote,
    hasTopChart: topRows.length > 0,
    hasTrackOverview: tracks.length > 0,
    trackOverviewRows: tracks,
    narratives,
    rosterNew: rosterItems(metrics.new, byName, 'new'),
    rosterCont: rosterItems(metrics.continuing, byName, 'cont').map(item => {
      // 连续栏右侧显示「周」占位：无周连胜字段时用日榜天数兜底
      const days = (metrics.dailyTop3Stats || []).find(d => d.fullName === item.fullName)?.days;
      if (days) {
        item.valueText = String(days);
        item.valueUnit = '天';
      }
      return item;
    }),
    rosterRet: rosterItems(metrics.returning, byName, 'ret'),
    trackRows: tracks,
    trackNote: tracks[0]
      ? `收束：本周是「${tracks[0].note}」主导的结构，不是全赛道普涨。`
      : '收束：本期赛道样本不足，以上为名单结构。',
    lookahead,
    fullList,
    fullCount: fullList.length,
    cmpRows: [
      {
        label: '新增合计',
        curr: formatCount(weekNewStars),
        prev: formatCount(prevNewStars),
        delta: wowRate != null ? formatPct(wowRate, 1) : '—',
        deltaCls: clsDelta(wowRate),
      },
      {
        label: '换血率',
        curr: metrics.churnRate != null ? `${metrics.churnRate}%` : '—',
        prev: '—',
        delta: metrics.churnCount != null ? `新面孔 ${metrics.churnCount}` : '—',
        deltaCls: '',
      },
      {
        label: '头部集中度 Top1',
        curr: top1Share != null ? `${top1Share}%` : '—',
        prev: prevNewStars > 0 ? `${Math.round((prevTop1 / prevNewStars) * 100)}%` : '—',
        delta: top1Share != null && prevNewStars > 0
          ? (top1Share > Math.round((prevTop1 / prevNewStars) * 100) ? '集中度升' : '集中度降')
          : '—',
        deltaCls: top1Share != null && prevNewStars > 0 && top1Share > Math.round((prevTop1 / prevNewStars) * 100) ? 'dn' : 'up',
      },
    ],
    footer: `报告站 · 周报 ${week} · r11c 趋势图 · 无 AI 四栏 / 黑马 / 出局 · 静态 SVG · 热区 a::after≥44`,
  };
}

function renderWeeklyV3(data) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return mustache.render(template, buildViewModel(data));
}

module.exports = {
  buildViewModel,
  renderWeeklyV3,
};
