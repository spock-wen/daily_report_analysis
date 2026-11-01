'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { renderInsights } = require('../../src/render/placeholder-renderer');
const { check: checkB10 } = require('../../src/checker/rules/b10');

// 线上闸证 https://report.wenspock.site/check/check-monthly-2026-10.md
// generatedAt 2026-11-01T03:05:04.206Z，PH1×4 的原句。
const DETAILED = '这一结构性变化从头部集中度看得最清楚：Top5 项目占本月新增星的比例达到 {{f8:top5_share}}%，而上月仅为 {{f13:prev_top5_share}}%。从 {{p:mattpocock/skills}} 到 {{p:anthropics/knowledge-work-plugins}}、{{p:cloudflare/security-audit-skill}}，「为 AI agent 提供可复用能力包」已从新概念变为上榜主力。 榜单结构方面，新秀数为 {{f6:new}}，非新秀项目数为 {{f7:prior}}，另有 {{f5:recurring}} 个项目重复上榜（两天及以上），说明头部项目的生命力在拉长：{{p:pbakaus/impeccable}} 累计 {{f30:days_on_list}} 天在榜，{{p:morluto/rea}} 也在 {{f15:days_on_list}} 天里贡献了本月最惊人的增量。单点爆款方面，{{p:morluto/rea}} 本月新增 {{f14:month_stars}} 星，与其累计 {{f16:stars}} 星形成极高的本月转化率，成为当之无愧的月度主角。 值得注意的是，主流基础设施类仓库（如 {{p:php/php-src}}、{{p:supabase/supabase}}、{{p:pytorch/pytorch}}）虽只在上榜几天内贡献了少量月度增量，但它们的出现稳定了榜单的技术底色，与 AI agent 类项目的爆发形成互补。';

const LATE = '下旬榜单的气质发生了明显变化：AI agent 类目依旧主导，但 {{p:php/php-src}}、{{p:supabase/supabase}} 等传统基础设施项目重新出现，为火热的 agent 叙事补回了工程底座。{{p:anthropics/knowledge-work-plugins}} 本月新增 {{f86:month_stars}} 星，上榜 {{f87:days_on_list}} 天，累计 {{f88:stars}} 星，代表官方生态开始系统性地输出面向知识工作的插件体系；{{p:cursor/plugins}}、{{p:anthropics/claude-plugins-official}} 的同场登榜进一步印证「插件化」是月下旬的共识方向。{{p:DietrichGebert/ponytail}} 再次进入下旬关键项目，其累计 {{f25:stars}} 星与 {{f24:days_on_list}} 天的在榜纪录显示出跨阶段的持续热度。下旬的价值在于沉淀：概念从上旬的尝试、中旬的爆发，走向了可与现有工程栈对接的产品形态。';

const ONE = '{{p:morluto/rea}} 是本月增速最猛的黑马仓库，在 {{f15:days_on_list}} 天上榜中新增 {{f14:month_stars}} 星，累计 {{f16:stars}} 星。';

function factsFrom(texts) {
  const facts = [];
  const seen = new Set();
  let n = 0;
  for (const text of texts) {
    for (const match of text.matchAll(/\{\{f(\d+):([a-z0-9_]+)\}\}/g)) {
      const id = `f${match[1]}`;
      if (seen.has(id)) continue;
      seen.add(id);
      n += 1;
      facts.push({ id, value: 1000 + n, role: match[2], project: null });
    }
  }
  return facts;
}

function projectsFrom(texts) {
  const names = new Set();
  for (const text of texts) {
    for (const match of text.matchAll(/\{\{p:([^{}]+)\}\}/g)) names.add(match[1]);
  }
  return Array.from(names);
}

test('PH1×4：月10 闸证原句的槽与 role 对齐', () => {
  const texts = [DETAILED, LATE, ONE];
  const facts = factsFrom(texts);
  const rendered = renderInsights({
    insights: {
      monthlyTheme: { detailed: DETAILED },
      trendEvolution: [{}, {}, { analysis: LATE }],
      longTermValue: [{ oneSentence: ONE }],
    },
    facts,
    projects: projectsFrom(texts),
    level: 'monthly',
    period: '2026-10',
  });
  assert.deepEqual(rendered.errors, []);

  const strings = [
    { path: 'monthlyTheme.detailed', value: rendered.insights.monthlyTheme.detailed, line: 1 },
    { path: 'trendEvolution[2].analysis', value: rendered.insights.trendEvolution[2].analysis, line: 2 },
    { path: 'longTermValue[0].oneSentence', value: rendered.insights.longTermValue[0].oneSentence, line: 3 },
  ];
  const findings = checkB10(
    { r3: true, facts, renderMap: { entries: rendered.entries } },
    { role: 'insights', strings },
  );
  assert.deepEqual(findings, []);
  assert.match(rendered.insights.monthlyTheme.detailed, /占本月新增星的比例达到 1001%/);
  assert.match(rendered.insights.monthlyTheme.detailed, /累计 1006 天在榜/);
  assert.match(rendered.insights.trendEvolution[2].analysis, /天的在榜纪录/);
  assert.match(rendered.insights.longTermValue[0].oneSentence, /天上榜中新增 1008 星/);
});

test('集中度百分比仍不能落进本月新增槽，累计星仍不能写成上榜天数', () => {
  const rendered = renderInsights({
    insights: {
      monthlyTheme: {
        detailed: '本月新增 {{f1:top5_share}}%。累计 {{f2:days_on_list}} 星。',
      },
    },
    facts: [
      { id: 'f1', value: 40, role: 'top5_share', project: null },
      { id: 'f2', value: 9, role: 'days_on_list', project: null },
    ],
    projects: [],
    level: 'monthly',
    period: '2026-10',
  });
  assert.equal(rendered.errors.length, 2);
  assert.equal(rendered.errors[0].placeholder, '{{f1:top5_share}}');
  assert.equal(rendered.errors[1].placeholder, '{{f2:days_on_list}}');
});

test('月报提示写明这四类槽的说法', () => {
  const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/prompts.json'), 'utf8'));
  const text = `${prompts.monthly.systemPrompt}\n${prompts.monthly.userPrompt}`;
  assert.match(text, /占本月新增星的比例/);
  assert.match(text, /天在榜/);
  assert.match(text, /天的在榜纪录/);
  assert.match(text, /星的新增/);
  assert.match(text, /数字前不要写累计/);
});
