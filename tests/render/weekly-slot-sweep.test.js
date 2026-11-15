'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { renderInsights } = require('../../src/render/placeholder-renderer');
const { check: checkB10 } = require('../../src/checker/rules/b10');

// 2026-11-15 65 上 main 6aba569 对 W46 原件 nopush 试跑第 1 次：PH1×1，weeklyTheme.detailed。
// 原句取自运维证据 check-weekly-2026-W46.6aba569-run1.json 的 quote（占位原样）。
const RUN1_DETAILED = '2026-W46 周榜共 {{f1:total_projects}} 个项目，其中 AI 项目 {{f2:ai_projects}} 个，占比 {{f4:ai_ratio}}%，平均累计 {{f3:avg_stars}} 星。{{p:meta/astryx}} 以周新增 {{f33:week_stars}} 星成为本周最大黑马，单日最高新增 {{f5:max_today}} 星。整体节奏从上周的高温回调，社区注意力转向 agent 技能生态与治理工具。';

function flatten(value, fieldPath, out) {
  if (typeof value === 'string') {
    out.push({ path: fieldPath, value, line: out.length + 1 });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${fieldPath}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) flatten(item, fieldPath ? `${fieldPath}.${key}` : key, out);
  }
}

// 事实表按句子里的占位现造：id/role 取自占位，数值各不相同。
function factsFor(sentences, overrides = {}) {
  const facts = new Map();
  for (const sentence of sentences) {
    for (const match of sentence.matchAll(/\{\{f(\d+):([a-z0-9_]+)\}\}/g)) {
      const id = `f${match[1]}`;
      if (!facts.has(id)) {
        facts.set(id, { id, role: overrides[id] || match[2], value: 1000 + Number(match[1]), project: null });
      }
    }
  }
  return Array.from(facts.values());
}

function gate(insights, facts, projects = []) {
  const rendered = renderInsights({ insights, facts, projects, level: 'weekly', period: '2026-W46' });
  const strings = [];
  flatten(rendered.insights, '', strings);
  const b10 = checkB10(
    { r3: true, level: 'weekly', facts, renderMap: { entries: rendered.entries } },
    { kind: 'json', role: 'insights', strings, path: 'insights-2026-W46.json' },
  );
  return { rendered, b10 };
}

test('W46 65 试跑第 1 次：「平均累计 N 星」的 avg_stars 不再被累计槽抢走', () => {
  const facts = [
    { id: 'f1', role: 'total_projects', value: 18, project: null },
    { id: 'f2', role: 'ai_projects', value: 13, project: null },
    { id: 'f4', role: 'ai_ratio', value: 72, project: null },
    { id: 'f3', role: 'avg_stars', value: 91234, project: null },
    { id: 'f33', role: 'week_stars', value: 11908, project: 'meta/astryx' },
    { id: 'f5', role: 'max_today', value: 2300, project: null },
  ];
  const found = gate({ weeklyTheme: { oneLiner: '一句话。', detailed: RUN1_DETAILED } }, facts, ['meta/astryx']);
  assert.deepEqual(found.rendered.errors, [], JSON.stringify(found.rendered.errors));
  assert.deepEqual(found.b10, [], JSON.stringify(found.b10));
  assert.match(found.rendered.insights.weeklyTheme.detailed, /平均累计 91234 星/);
});

test('平均星数槽仍然挡错：stars 写进「平均累计」、avg_stars 写进「累计」都 FAIL', () => {
  const starsInAvg = gate(
    { highlights: ['全部上榜项目平均累计 {{f9:stars}} 星。'] },
    [{ id: 'f9', role: 'stars', value: 51274, project: 'a/b' }],
  );
  assert.ok(starsInAvg.rendered.errors.some(e => /语义槽/.test(e.message)), JSON.stringify(starsInAvg.rendered.errors));
  assert.ok(starsInAvg.b10.length > 0);

  const avgInStars = gate(
    { highlights: ['{{p:a/b}} 累计 {{f3:avg_stars}} 星。'] },
    [{ id: 'f3', role: 'avg_stars', value: 91234, project: null }],
    ['a/b'],
  );
  assert.ok(avgInStars.rendered.errors.some(e => /语义槽/.test(e.message)), JSON.stringify(avgInStars.rendered.errors));
  assert.ok(avgInStars.b10.length > 0);
});

// 扫描表：周报里每类事实在模型自然写法下都要落在自己的槽里（经归一器 + 渲染 + B10）。
// 修前在 main 上失败的行（证据：65 试跑 run1、本机 6 次 glm-5.3-flash 生成、月 10 已提交数据）标注 [FIX]。
const SWEEP = [

['avg_stars','平均累计 {{f3:avg_stars}} 星。'],
['avg_stars','平均 Stars 为 {{f3:avg_stars}} 星。'],
['avg_stars','平均每个项目累计 {{f3:avg_stars}} 星。'],
['avg_stars','上榜项目平均累计 Stars 为 {{f3:avg_stars}}，低于上周。'],
['avg_stars','平均星数 {{f3:avg_stars}}，较上周的 {{f14:prev_avg_stars}} 下降。'],
['avg_stars','项目平均 Stars 达 {{f3:avg_stars}}。'],
['prev_avg_stars','低于上周的平均 Stars {{f14:prev_avg_stars}}。'],
['prev_avg_stars','上周平均累计 {{f14:prev_avg_stars}} 星。'],
['prev_week_total','较上周的 {{f7:prev_week_total}} 星减少 {{f8:wow_delta}} 星'],
['prev_week_total','上周合计新增 {{f7:prev_week_total}} 星。'],
['prev_week_total','对比上周的 {{f7:prev_week_total}} 星。'],
['prev_week_total','观察能否回到上周 {{f7:prev_week_total}} 星的水平'],
['wow_delta','较上周下降 {{f8:wow_delta}} 星。'],
['wow_delta','较上周减少 {{f8:wow_delta}} 星，环比 {{f9:wow_rate}}%。'],
['wow_rate','较上周下降 {{f9:wow_rate}}%。'],
['wow_rate','周榜合计新增 {{f6:total_week}} 星，较上周下滑 {{f9:wow_rate}}%'],
['week_stars','周新增能否翻倍于本周 {{f48:week_stars}} 星'],
['week_stars','周新增 {{f48:week_stars}} 星，是上周的两倍'],
['max_today','单日最高新增 {{f5:max_today}} 星'],
['max_today','最大黑马单日新增 {{f5:max_today}} 星'],
['max_today','单日峰值达 {{f5:max_today}} 星'],
['max_today','单日最高 {{f5:max_today}} 星'],
['max_today','最高单日涨幅 {{f5:max_today}} 星'],
['total_week','本周合计新增 {{f6:total_week}} 星'],
['total_week','整周共新增 {{f6:total_week}} 星'],
['total_week','榜内总新增 {{f6:total_week}} 星'],
['churn_count','{{f10:churn_count}} 个项目出局'],
['churn_count','换血 {{f10:churn_count}} 个，换血率 {{f11:churn_rate}}%'],
['churn_rate','换血率高达 {{f11:churn_rate}}%'],
['new','新面孔 {{f23:new}} 个，回归 {{f25:returned}} 个，出局 {{f26:dropped}} 个'],
['new','{{f23:new}} 个新面孔'],
['new','新上榜项目 {{f23:new}} 个'],
['kept','连续在榜 {{f24:kept}} 个'],
['kept','{{f24:kept}} 个项目连续在榜'],
['kept','留存 {{f24:kept}} 个项目'],
['dropped','{{f26:dropped}} 个项目掉榜'],
['dropped','上周的项目有 {{f26:dropped}} 个出局'],
['prev_total_projects','上周上榜 {{f12:prev_total_projects}} 个项目'],
['prev_total_projects','由上周 {{f12:prev_total_projects}} 个增至本周 {{f1:total_projects}} 个项目'],
['prev_ai_projects','上周 AI 项目 {{f13:prev_ai_projects}} 个'],
['ai_ratio','AI 项目占比 {{f4:ai_ratio}}%'],
['ai_ratio','AI 项目占比达 {{f4:ai_ratio}}%，较上周提升'],
['ai_projects','其中 AI 项目 {{f2:ai_projects}} 个'],
['ai_projects','AI 相关项目 {{f2:ai_projects}} 个'],
['total_projects','周榜共 {{f1:total_projects}} 个项目'],
['daily_count','周一日报共 {{f60:daily_count}} 个项目'],
['daily_count','日报项目数 {{f60:daily_count}} 个'],
['daily_count','周日日报仅 {{f60:daily_count}} 个'],
['stars','累计 {{f40:stars}} 星'],
['stars','累计超过 {{f40:stars}} 星'],
['stars','总星数 {{f40:stars}}'],
['stars','Star 数达 {{f40:stars}}'],
['stars','已有 {{f40:stars}} 星'],
['stars','周新增 {{f39:week_stars}} 星，累计 {{f40:stars}} 星、Fork {{f41:forks}} 个'],
['forks','Fork {{f41:forks}} 个'],
['forks','其累计体量与 {{f38:forks}} 个 Fork 显示长期社区基础扎实。'],
['forks','累计 {{f46:stars}} 星与 {{f47:forks}} 个 Fork 表明技能治理需要提上日程。'],
['forks','累计 {{f46:stars}} 星且 {{f47:forks}} 个分支'],
['forks','{{f41:forks}} 个 Fork'],
['forks','分支数 {{f41:forks}}'],
['forks','Forks 数 {{f41:forks}}'],
['threshold','{{f76:threshold}} 星看点阈值'],
['threshold','{{p:a/b}} 累计 {{f46:stars}} 星与 {{f89:threshold}} 星看点的差距，看周新增是否超过。'],
['threshold','能否站上 {{f76:threshold}} 星阈值'],
['threshold','跨过 {{f76:threshold}} 星的看点线'],
['threshold','突破 {{f76:threshold}} 星门槛'],
['top3_days','本周日报上榜 {{f1:top3_days}} 天'],
['top3_stars','日报累计新增 {{f2:top3_stars}} 星'],
['top3_stars','日报新增 {{f2:top3_stars}} 星'],
['top3_stars','日报期间新增 {{f2:top3_stars}} 星'],
['appearance_days','本周日报出现 {{f2:appearance_days}} 天'],
['appearance_days','连续 {{f2:appearance_days}} 天出现在日报'],
['appearance_days','日报中出现 {{f2:appearance_days}} 天'],
['appearance_days','在日报榜单出现 {{f2:appearance_days}} 天'],
['appearance_days','出现在 {{f2:appearance_days}} 天日报中'],
['appearance_days','本周 {{f2:appearance_days}} 天上榜日报'],
['appearance_days','累计 {{f40:stars}} 星且出现 {{f2:appearance_days}} 天'],
];

const FIXED_BEFORE = new Set([
  '其累计体量与 {{f38:forks}} 个 Fork 显示长期社区基础扎实。',
  '累计 {{f46:stars}} 星与 {{f47:forks}} 个 Fork 表明技能治理需要提上日程。',
  '{{p:a/b}} 累计 {{f46:stars}} 星与 {{f89:threshold}} 星看点的差距，看周新增是否超过。',
  '平均累计 {{f3:avg_stars}} 星。',
  '平均每个项目累计 {{f3:avg_stars}} 星。',
  '上榜项目平均累计 Stars 为 {{f3:avg_stars}}，低于上周。',
  '上周平均累计 {{f14:prev_avg_stars}} 星。',
  '周新增能否翻倍于本周 {{f48:week_stars}} 星',
  '日报累计新增 {{f2:top3_stars}} 星',
  '日报期间新增 {{f2:top3_stars}} 星',
  '本周 {{f2:appearance_days}} 天上榜日报',
  '累计 {{f40:stars}} 星且出现 {{f2:appearance_days}} 天',
]);

test('周报事实槽扫描：每类事实的自然句式都落在自己的槽里', () => {
  const failures = [];
  for (const [role, sentence] of SWEEP) {
    const facts = factsFor([sentence]);
    const found = gate({ highlights: [sentence] }, facts, ['a/b']);
    if (found.rendered.errors.length > 0 || found.b10.length > 0) {
      failures.push(`${role} | ${sentence} | ${JSON.stringify(found.rendered.errors.map(e => e.message))}`);
    }
  }
  assert.deepEqual(failures, []);
  for (const sentence of FIXED_BEFORE) assert.ok(SWEEP.some(([, s]) => s === sentence), sentence);
});

test('扫描后仍挡错：错 role 放进别的槽照旧 FAIL（闸规则未放松）', () => {
  const wrong = [
    ['日报合计新增槽只认 top3_stars', '日报合计新增 {{f2:week_stars}} 星。'],
    ['翻倍不是倍数槽，但真倍数槽仍只认比值', '是上周的 {{f2:week_stars}} 倍。'],
    ['没有「日报」的合计新增仍落周榜合计槽，不认 top3_stars', '日报上榜 {{f1:top3_days}} 天，合计新增 {{f2:top3_stars}} 星。'],
    ['「N 个 Fork」槽不认累计星', '累计体量与 {{f2:stars}} 个 Fork 显示。'],
    ['没有看点 / 阈值线索的 threshold 仍被累计槽挡', '{{p:a/b}} 累计 {{f46:stars}} 星能否增长至超过 {{f88:threshold}} 星。'],
    ['平均槽不认项目累计星', '平均累计 {{f2:forks}} 个。'],
    ['日报出现天数槽不认累计星', '本周日报出现 {{f2:stars}} 天。'],
  ];
  for (const [label, sentence] of wrong) {
    const found = gate({ highlights: [sentence] }, factsFor([sentence]), ['a/b']);
    assert.ok(found.rendered.errors.some(e => /语义槽/.test(e.message)), `${label}: ${JSON.stringify(found.rendered.errors)}`);
    assert.ok(found.b10.length > 0, label);
  }
});

test('已提交的月 10 数据：「平均累计 62000 星」的 avg_stars 不再是 B10 findings', () => {
  const root = path.join(__dirname, '..', '..', 'data');
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const insights = read('insights/monthly/insights-2026-10.json');
  const facts = read('facts/facts-monthly-2026-10.json');
  const renderMap = read('render/render_map-monthly-2026-10.json');
  const strings = [];
  flatten(insights, '', strings);
  const findings = checkB10({ r3: true, level: 'monthly', facts, renderMap }, {
    kind: 'json', role: 'insights', strings, path: 'insights-2026-10.json',
  });
  assert.equal(findings.some(item => /avg_stars/.test(item.message)), false, JSON.stringify(findings.filter(item => /avg_stars/.test(item.message))));
});
