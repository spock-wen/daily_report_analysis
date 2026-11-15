'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('node:test');
const { renderInsights } = require('../../src/render/placeholder-renderer');
const { check: checkB5 } = require('../../src/checker/rules/b5');
const { check: checkB10 } = require('../../src/checker/rules/b10');
const { loadConfig } = require('../../src/checker/config');

// 夹具来自 W46 线上闸证（运维 2026-11-15 证据 report-weekly-W46-nopush-rerun-20261115.md）：
//   12:07 cron：B5×3，deepTrends 里 {{p:google/skills}}、{{p:cloudflare/security-audit-skill}} 榜外；
//   12:47 nopush 第 1 次：PH1+B10，recommendations.developers[2] 「累计 N 星且日报出现 M 天」；
//   12:49 nopush 第 2 次：PH1+B10×2，highlights[1]/[2]「本周日报上榜 N 天」绑 appearance_days。
// 事实 id / 数值取自当次 check JSON 渲染后的原句（51274、4 天、111864、3 天 …）。
const RUN1_DEV = '尝试用 {{p:vercel-labs/agent-browser}} 让代理执行浏览器任务，其累计 {{f43:stars}} 星且日报出现 {{f108:appearance_days}} 天，适合纳入自动化测试流程。';
const RUN2_SHERLOCK = '{{p:sherlock-project/sherlock}} 周新增 {{f36:week_stars}} 星，累计 {{f37:stars}} 星、Fork {{f38:forks}} 个，跨社交网络按用户名检索账号的 OSINT 工具，本周日报上榜 {{f102:appearance_days}} 天，安全取证场景热度攀升。';
const RUN2_SKILLS = '{{p:anthropics/skills}} 周新增 {{f39:week_stars}} 星，累计 {{f40:stars}} 星、Fork {{f41:forks}} 个，官方 Agent Skills 公共仓库持续吸金，本周日报上榜 {{f74:appearance_days}} 天，技能生态正成为事实标准。';

const AGENT = 'vercel-labs/agent-browser';
const SHERLOCK = 'sherlock-project/sherlock';
const SKILLS = 'anthropics/skills';
const PROJECTS = [AGENT, SHERLOCK, SKILLS, 'obra/superpowers'];

const FACTS = [
  { id: 'f43', value: 51274, role: 'stars', project: AGENT },
  { id: 'f108', value: 4, role: 'appearance_days', project: AGENT },
  { id: 'f36', value: 12401, role: 'week_stars', project: SHERLOCK },
  { id: 'f37', value: 111864, role: 'stars', project: SHERLOCK },
  { id: 'f38', value: 12946, role: 'forks', project: SHERLOCK },
  { id: 'f102', value: 3, role: 'appearance_days', project: SHERLOCK },
  { id: 'f39', value: 6220, role: 'week_stars', project: SKILLS },
  { id: 'f40', value: 194685, role: 'stars', project: SKILLS },
  { id: 'f41', value: 22903, role: 'forks', project: SKILLS },
  { id: 'f74', value: 3, role: 'appearance_days', project: SKILLS },
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

function gate(insights, facts = FACTS, projects = PROJECTS) {
  const rendered = renderInsights({ insights, facts, projects, level: 'weekly', period: '2026-W46' });
  const strings = [];
  flatten(rendered.insights, '', strings);
  const ctx = { r3: true, level: 'weekly', facts, renderMap: { entries: rendered.entries } };
  const doc = { kind: 'json', role: 'insights', strings, path: 'insights-2026-W46.json' };
  return {
    rendered,
    b10: checkB10(ctx, doc),
    b5: checkB5(ctx, doc, loadConfig()),
  };
}

test('W46 PH1/B10 第 1 次重跑：「累计 N 星且日报出现 M 天」不再被累计槽抢走', () => {
  const found = gate({ recommendations: { developers: ['a。', 'b。', RUN1_DEV] } });
  assert.deepEqual(found.rendered.errors, [], JSON.stringify(found.rendered.errors));
  assert.deepEqual(found.b10, [], JSON.stringify(found.b10));
  assert.match(found.rendered.insights.recommendations.developers[2], /累计 51274 星且日报出现 4 天/);
});

test('W46 PH1/B10 第 2 次重跑：「本周日报上榜 N 天」绑 appearance_days 时确定性改写成「日报出现 N 天」', () => {
  const found = gate({ highlights: ['x。', RUN2_SHERLOCK, RUN2_SKILLS] });
  assert.deepEqual(found.rendered.errors, [], JSON.stringify(found.rendered.errors));
  assert.deepEqual(found.b10, [], JSON.stringify(found.b10));
  assert.match(found.rendered.insights.highlights[1], /本周日报出现 3 天，安全取证/);
  assert.match(found.rendered.insights.highlights[2], /本周日报出现 3 天，技能生态/);
  assert.doesNotMatch(found.rendered.insights.highlights[1], /上榜/);
});

test('天数槽仍然挡错：appearance_days 的数字写进「累计 N 星」槽、stars 的数字写进「日报出现 N 天」槽都 FAIL', () => {
  const swapped = FACTS.map(fact => (fact.id === 'f43' ? { ...fact, role: 'appearance_days' } : fact));
  const wrongSlot = gate({ recommendations: { developers: ['a。', 'b。', RUN1_DEV] } }, swapped);
  assert.ok(wrongSlot.rendered.errors.some(error => /f43/.test(error.placeholder) && /语义槽/.test(error.message)),
    JSON.stringify(wrongSlot.rendered.errors));
  assert.ok(wrongSlot.b10.length > 0);

  const starsInDays = gate({
    highlights: ['{{p:sherlock-project/sherlock}} 本周日报出现 {{f37:stars}} 天，热度攀升。'],
  });
  assert.ok(starsInDays.rendered.errors.some(error => /f37/.test(error.placeholder) && /语义槽/.test(error.message)),
    JSON.stringify(starsInDays.rendered.errors));
  assert.ok(starsInDays.b10.length > 0);
});

test('W46 B5：deepTrends 里的榜外仓库所在句被确定性删除并留痕，闸 B5 不再出现', () => {
  const insights = {
    deepTrends: {
      title: '技能生态走向标准化',
      summary: '多个技能仓库同时走热。',
      content: `{{p:${SKILLS}}} 是官方技能仓库。{{p:google/skills}} 同日出现，{{p:cloudflare/security-audit-skill}} 紧随其后。多日持续。`,
      evidence: [
        { name: `{{p:${SKILLS}}}`, day: '2026-11-10', reason: '官方仓库。' },
        { name: '{{p:google/skills}}', day: '2026-11-08', reason: '榜外。' },
      ],
    },
  };
  const found = gate(insights);
  const deep = found.rendered.insights.deepTrends;
  assert.equal(deep.content, `${SKILLS} 是官方技能仓库。多日持续。`);
  assert.equal(deep.evidence.length, 1);
  assert.equal(deep.evidence[0].name, SKILLS);
  assert.deepEqual(found.rendered.errors, [], JSON.stringify(found.rendered.errors));
  assert.deepEqual(found.b5, [], JSON.stringify(found.b5));
  const droppedNames = found.rendered.dropped.flatMap(item => item.names).sort();
  assert.deepEqual(droppedNames, ['cloudflare/security-audit-skill', 'google/skills', 'google/skills']);
  assert.ok(found.rendered.dropped.every(item => /不在当期项目清单/.test(item.message)));
});

test('W46 B5：清单内的仓库占位原样保留，不误删', () => {
  const found = gate({ highlights: [`{{p:${SKILLS}}} 持续吸金。`] });
  assert.deepEqual(found.rendered.dropped, []);
  assert.equal(found.rendered.insights.highlights[0], `${SKILLS} 持续吸金。`);
});

test('W46 根因：loadWeeklyDailyData 在 UTC+8 也读周一到周日，不混入上周日', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w46-load-'));
  try {
    const daily = path.join(dir, 'briefs', 'daily');
    fs.mkdirSync(daily, { recursive: true });
    for (let day = 8; day <= 16; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      fs.writeFileSync(path.join(daily, `data-${date}.json`), JSON.stringify({ projects: [] }));
    }
    const script = `
      const RP = require(${JSON.stringify(path.join(__dirname, '..', '..', 'src', 'scraper', 'report-pipeline.js'))});
      Object.create(RP.prototype).loadWeeklyDailyData('2026-W46')
        .then(days => process.stdout.write('DATES=' + days.map(d => d.date).join(',')));
    `;
    for (const tz of ['Asia/Singapore', 'UTC', 'America/Los_Angeles']) {
      const out = execFileSync(process.execPath, ['-e', script], {
        env: { ...process.env, TZ: tz, REPORT_DATA_DIR: dir },
        encoding: 'utf8',
      });
      const dates = /DATES=(\S*)/.exec(out)[1];
      assert.equal(dates, '2026-11-09,2026-11-10,2026-11-11,2026-11-12,2026-11-13,2026-11-14,2026-11-15', `TZ=${tz}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('W46 真实日榜：google/skills 与 cloudflare/security-audit-skill 只在 11-08（W45）出现，天数与失败样例一致', () => {
  const history = require('../../src/metrics/history');
  const { listWeeklyDailyAppearances } = require('../../src/facts/build-facts');
  const w46 = listWeeklyDailyAppearances({ weekStart: '2026-W46' });
  const byName = new Map(w46.map(item => [item.fullName, item.days]));
  assert.equal(byName.has('google/skills'), false);
  assert.equal(byName.has('cloudflare/security-audit-skill'), false);
  // 失败样例渲染后的天数：agent-browser 4、sherlock 3、anthropics/skills 3。
  assert.equal(byName.get(AGENT), 4);
  assert.equal(byName.get(SHERLOCK), 3);
  assert.equal(byName.get(SKILLS), 3);

  const names08 = new Set((history.readDailyBrief('2026-11-08')?.projects || []).map(history.projectKey));
  assert.ok(names08.has('google/skills'));
  assert.ok(names08.has('cloudflare/security-audit-skill'));

  // 用真实天数构造事实，失败样例句式整体过 B10 / B5。
  const facts = FACTS.map(fact => (fact.role === 'appearance_days' ? { ...fact, value: byName.get(fact.project) } : fact));
  const found = gate({
    recommendations: { developers: ['a。', 'b。', RUN1_DEV] },
    highlights: ['x。', RUN2_SHERLOCK, RUN2_SKILLS],
  }, facts);
  assert.deepEqual(found.rendered.errors, []);
  assert.deepEqual(found.b10, []);
  assert.deepEqual(found.b5, []);
});
