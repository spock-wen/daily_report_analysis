'use strict';

const fs = require('fs');
const nodePath = require('path');
const mustache = require('mustache');
const {
  TEMPLATE_DIR,
  readCss,
  formatCount,
  projectKey,
  projectBlurb,
  buildNav,
  oneLiner,
} = require('./wmh-v3-shared');
const { homePeriodKind, latestReportHref } = require('./report-nav');
const reportPaths = require('../utils/path');

const TEMPLATE_PATH = nodePath.join(TEMPLATE_DIR, 'home.mustache');

const PERIOD_ID = {
  weekly: /^\d{4}-W\d{2}$/,
  monthly: /^\d{4}-\d{2}$/,
};

const PERIOD_FILE_RE = {
  weekly: /^github-weekly-(\d{4}-W\d{2})\.html$/,
  monthly: /^github-monthly-(\d{4}-\d{2})\.html$/,
};

function periodRel(kind, id) {
  if (kind === 'weekly') return `weekly/github-weekly-${id}.html`;
  if (kind === 'monthly') return `monthly/github-monthly-${id}.html`;
  return null;
}

// 读者向链接只认正式 HTML。CSS 里的 .fail-banner 规则不算红条（例如 W43 仅有样式）。
function hasReaderFailChrome(html) {
  return /class="fail-banner"/.test(html) || /内容核查未通过（FAIL）/.test(html);
}

function readerPeriodHref(kind, id) {
  if (!PERIOD_ID[kind] || !PERIOD_ID[kind].test(id)) return null;
  const rel = periodRel(kind, id);
  const abs = nodePath.join(reportPaths.reportsDir(), rel);
  if (!fs.existsSync(abs)) return null;
  const html = fs.readFileSync(abs, 'utf8');
  if (hasReaderFailChrome(html)) return null;
  return rel;
}

function latestReaderPeriodHref(kind) {
  const dirName = kind === 'weekly' ? 'weekly' : 'monthly';
  const dir = nodePath.join(reportPaths.reportsDir(), dirName);
  if (!fs.existsSync(dir)) return null;
  const ids = fs.readdirSync(dir)
    .map(name => {
      const match = PERIOD_FILE_RE[kind].exec(name);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort()
    .reverse();
  for (const id of ids) {
    const href = readerPeriodHref(kind, id);
    if (href) return href;
  }
  return null;
}

function periodEntryLink(kind, id) {
  const href = readerPeriodHref(kind, id);
  if (href) {
    return {
      linkable: true,
      href,
      go: kind === 'weekly' ? '打开周报' : '打开月报',
    };
  }
  return {
    linkable: false,
    href: '',
    go: kind === 'weekly' ? '周报审阅中' : '月报审阅中',
  };
}

function periodArchiveItem(kind, id) {
  const href = readerPeriodHref(kind, id);
  if (href) return { label: id, href };
  return { label: `${id}（下架）`, href: '' };
}

function sumToday(projects) {
  return (projects || []).reduce((s, p) => s + (Number(p.todayStars) || 0), 0);
}

function tagFor(project) {
  // 简易：无 streak 时用 todayStars 启发式；有 isNew/returning 字段则优先
  if (project?.isNew || project?.tag === 'new') return { text: '新', cls: 'acc' };
  if (project?.isReturning || project?.tag === 'returning') return { text: '回归', cls: '' };
  if ((project?.streakDays || project?.consecutiveDays || 0) >= 2) return { text: '连续', cls: 'pri' };
  return { text: '今日', cls: '' };
}

function buildViewModel(reportsData) {
  const daily = [...(reportsData.daily || [])].sort((a, b) => a.date.localeCompare(b.date));
  const weekly = [...(reportsData.weekly || [])].sort((a, b) => a.week.localeCompare(b.week));
  const monthly = [...(reportsData.monthly || [])].sort((a, b) => a.month.localeCompare(b.month));

  const latestDaily = daily[daily.length - 1] || null;
  const latestWeekly = weekly[weekly.length - 1] || null;
  const latestMonthly = monthly[monthly.length - 1] || null;

  const dailyStars = latestDaily ? sumToday(latestDaily.projects) : 0;
  const weeklyStars = latestWeekly ? sumToday(latestWeekly.projects) : 0;
  // 月报 projects 常空，优先用报告自带 avg/theme，星数用 brief 侧字段若有
  const monthlyStarsLabel = latestMonthly
    ? (latestMonthly.newStarsDisplay || latestMonthly.avgStars || '—')
    : '—';

  const entries = [];
  if (latestDaily) {
    const lead = oneLiner(latestDaily.theme) || `上榜 ${latestDaily.projectCount} 项目，日新增合计 ${formatCount(dailyStars)}。`;
    entries.push({
      kind: '今日 · 日报',
      title: latestDaily.date,
      sum: lead,
      nums: [
        { label: '项目', value: String(latestDaily.projectCount) },
        { label: '星', value: formatCount(dailyStars) },
      ],
      linkable: true,
      href: `daily/github-ai-trending-${latestDaily.date}.html`,
      go: '打开日报',
    });
  }
  if (latestWeekly) {
    const theme = oneLiner(latestWeekly.theme) || latestWeekly.week;
    const link = periodEntryLink('weekly', latestWeekly.week);
    entries.push({
      kind: homePeriodKind('weekly', latestWeekly.week),
      title: theme, // 完整标题，不截断（P2 债顺带）
      sum: `${latestWeekly.week} · 上榜 ${latestWeekly.projectCount} · 周星 ${formatCount(weeklyStars)}`,
      nums: [
        { label: '项目', value: String(latestWeekly.projectCount) },
        { label: '周星', value: formatCount(weeklyStars) },
      ],
      linkable: link.linkable,
      href: link.href,
      go: link.go,
    });
  }
  if (latestMonthly) {
    const theme = oneLiner(latestMonthly.theme) || latestMonthly.month;
    const link = periodEntryLink('monthly', latestMonthly.month);
    entries.push({
      kind: homePeriodKind('monthly', latestMonthly.month),
      title: theme,
      sum: `${latestMonthly.month} · 收录 ${latestMonthly.projectCount}`,
      nums: [
        { label: '项目', value: String(latestMonthly.projectCount) },
        { label: '月星', value: String(monthlyStarsLabel) },
      ],
      linkable: link.linkable,
      href: link.href,
      go: link.go,
    });
  }

  const topProjects = (latestDaily?.projects || [])
    .slice()
    .sort((a, b) => (Number(b.todayStars) || 0) - (Number(a.todayStars) || 0))
    .slice(0, 5)
    .map((p, idx) => {
      const tag = tagFor(p);
      return {
        rank: idx + 1,
        fullName: projectKey(p),
        url: p.url || `https://github.com/${projectKey(p)}`,
        blurb: projectBlurb(p),
        stars: `+${formatCount(p.todayStars)}`,
        tag: tag.text,
        tagCls: tag.cls,
        href: latestDaily
          ? `daily/github-ai-trending-${latestDaily.date}.html`
          : '#',
      };
    });

  const paths = {
    home: 'index.html',
    daily: latestReportHref('daily', {
      prefix: '',
      fallbackId: latestDaily ? latestDaily.date : null,
    }),
    weekly: latestReaderPeriodHref('weekly') || '',
    monthly: latestReaderPeriodHref('monthly') || '',
  };

  const now = new Date();
  const stamp = now.toLocaleString('zh-CN', { timeZone: 'Asia/Singapore', hour12: false });

  return {
    css: readCss(),
    title: '首页 · GitHub AI Trending 洞察',
    nav: buildNav('home', paths),
    brandHome: 'index.html',
    meta: `入口层：日 / 周 / 月各一张卡 + 今日 Top5 + 存档。无近14日趋势。更新 ${stamp}（Asia/Singapore）`,
    entries,
    topProjects,
    topDate: latestDaily?.date || '—',
    archives: {
      daily: daily.slice(-10).reverse().map(d => ({
        label: d.date,
        href: `daily/github-ai-trending-${d.date}.html`,
      })),
      weekly: weekly.slice(-8).reverse().map(w => periodArchiveItem('weekly', w.week)),
      monthly: monthly.slice(-6).reverse().map(m => periodArchiveItem('monthly', m.month)),
    },
    footer: '报告站 · 首页 · r11b · 入口层 · 无近14日趋势 · 热区 a::after≥44',
  };
}

function renderHomeV3(reportsData) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return mustache.render(template, buildViewModel(reportsData));
}

module.exports = {
  buildViewModel,
  renderHomeV3,
};
