'use strict';

/**
 * r11b：周/月/首页结构门（必块在、砍项不在）。
 * 同类点各需 pass/fail 夹具；Checker 0 不算过。
 */

const { makeFinding } = require('./util');

const WEEKLY_REQUIRED = [
  { id: 'metrics', re: /id="metrics"|本期速览|本周新增合计|换血率/ },
  { id: 'highlights', re: /id="highlights"|本期速览/ },
  { id: 'overview', re: /id="overview"|本周总览/ },
  { id: 'narratives', re: /id="narratives"|核心叙事/ },
  { id: 'roster', re: /id="roster"|三类榜单|新面孔/ },
  { id: 'tracks', re: /id="tracks"|赛道复盘/ },
  { id: 'lookahead', re: /id="lookahead"|下周看点/ },
];

const WEEKLY_FORBIDDEN = [
  { id: 'ai-quad', re: /class="ai-insights|AI 深度洞察|重点项目推荐/ },
  { id: 'dark-horse', re: /最大黑马|黑马卡/ },
  { id: 'out-roster', re: />出局</ },
];

const MONTHLY_REQUIRED = [
  { id: 'pattern', re: /id="pattern"|本月 vs 上月|格局变了什么/ },
  { id: 'top', re: /id="top"|本月 Top|按本月新增/ },
  { id: 'crowns', re: /id="crowns"|三大王冠|持久王|单日星增王|新秀精选/ },
  { id: 'langdom', re: /id="langdom"|语言环比|领域热度/ },
  { id: 'insights', re: /id="insights"|深度洞察|回落/ },
  { id: 'weeks', re: /id="weeks"|四周主题/ },
  { id: 'kpi', re: /id="kpi"|关键指标/ },
];

const MONTHLY_FORBIDDEN = [
  { id: 'dark-horse', re: /月度黑马|class="dark-horse"|darkHorse/ },
  { id: 'forecast', re: /下月预测|nextMonthForecast|next-month-forecast/ },
  { id: 'wiki-wall', re: /wiki-tracking|Wiki 知识追踪|domain-wall|class=\"wiki-domain/ },
];

const HOME_REQUIRED = [
  { id: 'entries', re: /id="entries"|打开日报|打开周报|打开月报/ },
  { id: 'top5', re: /id="top5"|今日 Top5/ },
  { id: 'archives', re: /id="archives"|存档/ },
];

const HOME_FORBIDDEN = [
  { id: 'trend14', re: /id="trend14"|近14日趋势图|近\s*14\s*日走势|cdn\.jsdelivr\.net\/npm\/chart/i },
];

function checkBlocks(doc, required, forbidden, prefix) {
  const findings = [];
  const raw = doc.raw || '';
  for (const item of required) {
    if (item.re.test(raw)) continue;
    findings.push(makeFinding('R11B', doc, {
      field: `${prefix}.missing.${item.id}`,
      line: null,
      quote: item.id,
      message: `r11b 缺必块：${item.id}`,
    }));
  }
  for (const item of forbidden) {
    if (!item.re.test(raw)) continue;
    findings.push(makeFinding('R11B', doc, {
      field: `${prefix}.forbidden.${item.id}`,
      line: null,
      quote: item.id,
      message: `r11b 残留砍项：${item.id}`,
    }));
  }
  return findings;
}

function check(ctx, doc) {
  if (doc.role !== 'html' || doc.kind !== 'html') return [];
  if (ctx.level === 'weekly') return checkBlocks(doc, WEEKLY_REQUIRED, WEEKLY_FORBIDDEN, 'weekly');
  if (ctx.level === 'monthly') return checkBlocks(doc, MONTHLY_REQUIRED, MONTHLY_FORBIDDEN, 'monthly');
  if (ctx.level === 'home' || /index\.html$/i.test(doc.path || '')) {
    return checkBlocks(doc, HOME_REQUIRED, HOME_FORBIDDEN, 'home');
  }
  return [];
}

function applies(ctx, doc) {
  if (doc.role !== 'html') return false;
  if (ctx.level === 'weekly' || ctx.level === 'monthly') return true;
  if (ctx.level === 'home') return true;
  if (/index\.html$/i.test(doc.path || '')) return true;
  return false;
}

module.exports = {
  id: 'R11B',
  applies,
  check,
};
