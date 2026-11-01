'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { renderInsights } = require('../../src/render/placeholder-renderer');
const { buildFacts } = require('../../src/facts/build-facts');
const { check: checkB4 } = require('../../src/checker/rules/r4-binding');
const { check: checkB5 } = require('../../src/checker/rules/b5');
const { check: checkB10 } = require('../../src/checker/rules/b10');
const { check: checkB16 } = require('../../src/checker/rules/b16');
const { loadConfig } = require('../../src/checker/config');

// 线上闸证 check-weekly-2026-W44（generatedAt 2026-11-01T04:08:04.990Z）的原句结构。
const DETAILED = '2026-W44 榜单热度明显降温：合计新增 {{f1:total_week}} 星，上周合计为 {{f2:prev_week_total}} 星，变化量 {{f5:wow_delta}} 星，环比 {{f6:wow_rate}}%。换血剧烈：出局 {{f7:dropped}} 个，换血率 {{f8:churn_rate}}%，新面孔 {{f9:new}} 个，连续在榜仅 1 个，回归 {{f10:returned}} 个。主题上 Nutlope/hallmark 与 pbakaus/impeccable 双双冲上周新增 1 万星以上。';
const WEEK_POINT = '对比 cloudflare/security-audit-skill 周新增（本周 {{f33:week_stars}} 星）与累计 {{f34:stars}} 星的走势，看其能否领先安全类技能赛道的其他项目。';
const THRESHOLD_POINT = '留意 YuJunZhiXue/dsh-purge 累计 {{f70:stars}} 星下周是否低于 {{f76:threshold}} 星看点阈值或反超上涨，评估越狱类项目的持续上榜风险。';
const DEEP_CONTENT = '本周 GitHub Trending 上最深的暗流，不是又一个新模型或新框架，而是 <b>Agent Skills</b> 作为一种标准化能力封装格式的集中出现。故事的起点是基础设施的成熟：anthropics/skills（10-31）作为官方 Skill 仓库登场，expo/skills（10-29）和 mattpocock/skills（10-31）紧随其后。';

const PROJECTS = [
  'Nutlope/hallmark',
  'pbakaus/impeccable',
  'cloudflare/security-audit-skill',
  'YuJunZhiXue/dsh-purge',
  'anthropics/skills',
  'expo/skills',
  'mattpocock/skills',
  'NVIDIA/SkillSpector',
  'thedotmack/claude-mem',
  'obra/superpowers',
];

const FACTS = [
  { id: 'f1', value: 88298, role: 'total_week', project: null },
  { id: 'f2', value: 145207, role: 'prev_week_total', project: null },
  { id: 'f5', value: -56909, role: 'wow_delta', project: null },
  { id: 'f6', value: -39.2, role: 'wow_rate', project: null },
  { id: 'f7', value: 14, role: 'dropped', project: null },
  { id: 'f8', value: 93.3, role: 'churn_rate', project: null },
  { id: 'f9', value: 7, role: 'new', project: null },
  { id: 'f10', value: 7, role: 'returned', project: null },
  { id: 'f11', value: 1, role: 'kept', project: null },
  { id: 'f33', value: 11908, role: 'week_stars', project: 'cloudflare/security-audit-skill' },
  { id: 'f34', value: 55459, role: 'stars', project: 'cloudflare/security-audit-skill' },
  { id: 'f70', value: 14680, role: 'stars', project: 'YuJunZhiXue/dsh-purge' },
  { id: 'f76', value: 100000, role: 'threshold', project: null },
  { id: 'f80', value: 7, role: 'appearance_days', project: 'pbakaus/impeccable' },
];

function flatten(value, fieldPath, out) {
  if (typeof value === 'string') {
    out.push({ path: fieldPath, value, line: out.length + 1 });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${fieldPath}[${index}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      flatten(item, fieldPath ? `${fieldPath}.${key}` : key, out);
    }
  }
}

function findingsOf(rendered, facts) {
  const strings = [];
  flatten(rendered.insights, '', strings);
  const ctx = {
    r3: true,
    level: 'weekly',
    facts,
    renderMap: { entries: rendered.entries },
  };
  const doc = { kind: 'json', role: 'insights', strings, path: 'insights-2026-W44.json' };
  const config = loadConfig();
  return {
    strings,
    b4: checkB4(ctx, doc),
    b5: checkB5(ctx, doc, config),
    b10: checkB10(ctx, doc),
    b16: checkB16(ctx, doc),
  };
}

function assertClean(rendered, facts) {
  const found = findingsOf(rendered, facts);
  assert.deepEqual(rendered.errors, [], JSON.stringify(rendered.errors));
  assert.deepEqual(found.b4, [], JSON.stringify(found.b4));
  assert.deepEqual(found.b5, [], JSON.stringify(found.b5));
  assert.deepEqual(found.b10, [], JSON.stringify(found.b10));
  assert.deepEqual(found.b16, [], JSON.stringify(found.b16));
  return found;
}

function w44Insights() {
  return {
    weeklyTheme: { detailed: DETAILED },
    // 线上字段是 nextWeekPoints[2] / [4]。空串会被样板清洗丢掉，这里只保留这两句。
    nextWeekPoints: [WEEK_POINT, THRESHOLD_POINT],
    deepTrends: {
      title: '技能成为新的封装层',
      summary: '本周上榜主线是可复用技能，而不是零散模型发布。',
      content: DEEP_CONTENT,
      evidence: [
        { name: 'anthropics/skills', day: '10-31', reason: '官方 Skill 仓库登场。' },
        { name: 'Nutlope/hallmark', day: '2026-10-28', reason: '设计品味技能进入周榜。' },
        { name: 'pbakaus/impeccable', day: '2026-10-31', reason: '为编码 Agent 提供设计语言的技能包，连续 7 天霸榜，印证技能层需求持续高热。' },
        { name: 'NVIDIA/SkillSpector', day: '10-30', reason: '技能观测工具同周出现。' },
        { name: 'cloudflare/security-audit-skill', day: '2026-10-26', reason: '安全审计技能持续在榜。' },
        { name: 'thedotmack/claude-mem', day: '10-27', reason: '记忆层技能被反复提及。' },
        { name: 'obra/superpowers', day: '10-29', reason: '代理工作流技能同场出现。' },
        { name: 'expo/skills', day: '10-29', reason: '客户端生态开始提供技能包。' },
      ],
    },
  };
}

test('W44：变化量、周新增、看点阈值和深度趋势裸引用过 B10/B4/B5/B16', () => {
  const rendered = renderInsights({
    insights: w44Insights(),
    facts: FACTS,
    projects: PROJECTS,
    level: 'weekly',
    period: '2026-W44',
  });
  const found = assertClean(rendered, FACTS);
  const detailed = found.strings.find(item => item.path === 'weeklyTheme.detailed').value;
  assert.match(detailed, /变化量 -56909 星/);
  assert.match(detailed, /环比 -39\.2%/);
  assert.match(detailed, /连续在榜仅 1 个/);
  assert.equal(detailed.includes('1 万'), false);
  assert.match(detailed, /万星以上/);
  assert.match(detailed, /Nutlope\/hallmark/);

  const point = found.strings.find(item => item.path === 'nextWeekPoints[0]').value;
  assert.match(point, /周新增（本周 11908 星）与累计 55459 星/);
  const threshold = found.strings.find(item => item.path === 'nextWeekPoints[1]').value;
  assert.match(threshold, /100000 星看点阈值/);

  const content = found.strings.find(item => item.path === 'deepTrends.content').value;
  assert.equal(/不是[^。！？!?\n]{0,80}?而是/.test(content), false);
  assert.match(content, /并非又一个新模型或新框架，实际是/);
  assert.match(content, /10月31日/);
  assert.equal(content.includes('10-31'), false);

  const reason = found.strings.find(item => item.path === 'deepTrends.evidence[2].reason').value;
  assert.match(reason, /连续 7 天霸榜/);
  const names = found.strings.filter(item => /^deepTrends\.evidence\[\d+\]\.name$/.test(item.path));
  assert.deepEqual(names.map(item => item.value), [
    'anthropics/skills',
    'Nutlope/hallmark',
    'pbakaus/impeccable',
    'NVIDIA/SkillSpector',
    'cloudflare/security-audit-skill',
    'thedotmack/claude-mem',
    'obra/superpowers',
    'expo/skills',
  ]);

  const again = renderInsights({
    insights: rendered.insights,
    facts: FACTS,
    projects: PROJECTS,
    level: 'weekly',
    period: '2026-W44',
  });
  assertClean(again, FACTS);
});

test('裸变化量绑回 wow_delta 时不把负号再写一遍', () => {
  const rendered = renderInsights({
    insights: { weeklyTheme: { oneLiner: '变化量 -56909 星，环比 -39.2%。' } },
    facts: [
      { id: 'f5', value: -56909, role: 'wow_delta', project: null },
      { id: 'f6', value: -39.2, role: 'wow_rate', project: null },
    ],
    projects: [],
    level: 'weekly',
    period: '2026-W44',
  });
  assert.equal(rendered.errors.length, 0);
  assert.equal(rendered.insights.weeklyTheme.oneLiner, '变化量 -56909 星，环比 -39.2%。');
});

test('B16 规则仍然拦截「不是……而是……」', () => {
  const findings = checkB16({}, {
    kind: 'json',
    role: 'insights',
    strings: [{
      path: 'deepTrends.content',
      value: '不是又一个新模型或新框架，而是',
      line: 163,
    }],
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule_id, 'B16');
});

test('周报事实表纳入本周日榜仓库，7 天出现次数可绑定', () => {
  const doc = buildFacts({
    level: 'weekly',
    period: '2026-W44',
    brief: {
      weekStart: '2026-W44',
      date: '2026-W44',
      projects: [{
        fullName: 'cloudflare/security-audit-skill',
        todayStars: 11908,
        stars: 55459,
        forks: 1,
      }],
      stats: { totalProjects: 1, aiProjects: 1, avgStars: 1000 },
      weekMetrics: {
        wow: { previous: 100, delta: -10, rate: -10 },
        churnCount: 1,
        churnRate: 50,
        new: [],
        continuing: [],
        returning: [],
        out: [],
        dailyTop3Stats: [],
      },
    },
  });
  assert.ok(doc.projects.includes('pbakaus/impeccable'));
  assert.ok(doc.projects.includes('anthropics/skills'));
  const days = doc.facts.find(fact => fact.role === 'appearance_days' && fact.project === 'pbakaus/impeccable');
  assert.ok(days);
  assert.equal(days.value, 7);

  const rendered = renderInsights({
    insights: {
      deepTrends: {
        content: '不是技能清单，而是一层新的封装。',
        evidence: [{
          name: 'pbakaus/impeccable',
          day: '10-31',
          reason: '连续 7 天霸榜。',
        }],
      },
    },
    facts: doc.facts,
    projects: doc.projects,
    level: 'weekly',
    period: '2026-W44',
  });
  assertClean(rendered, doc.facts);
  assert.match(rendered.insights.deepTrends.evidence[0].reason, /连续 7 天霸榜/);
  assert.equal(rendered.insights.deepTrends.evidence[0].day, '10月31日');
});

test('周报和深度趋势提示写出槽配对、p: 和禁用句式', () => {
  const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/prompts.json'), 'utf8'));
  const weekly = `${prompts.weekly.systemPrompt}\n${prompts.weekly.userPrompt}`;
  assert.match(weekly, /wow_delta/);
  assert.match(weekly, /wow_rate/);
  assert.match(weekly, /week_stars/);
  assert.match(weekly, /星看点阈值/);
  assert.match(weekly, /不是……而是/);
  assert.match(weekly, /万星以上/);

  const deep = `${prompts.deepTrends.systemPrompt}\n${prompts.deepTrends.userPrompt}`;
  assert.match(deep, /\{\{p:owner\/repo\}\}/);
  assert.match(deep, /\{repoList\}/);
  assert.match(deep, /不是……而是/);
  assert.equal(deep.includes('必须使用完整的'), false);
  assert.match(deep, /10-31/);
  const analyzerSource = fs.readFileSync(path.join(__dirname, '../../src/analyzer/insight-analyzer.js'), 'utf8');
  assert.match(analyzerSource, /attachSystemPrompt\('weekly'/);
  assert.match(analyzerSource, /buildDeepTrendsPrompt/);
  assert.match(analyzerSource, /attachSystemPrompt\('deepTrends'/);
});
