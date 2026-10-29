'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const history = require('../../src/metrics/history');
const {
  appearanceCounts,
  computeDailyMetrics,
  enrichDailyBrief,
} = require('../../src/metrics/daily-metrics');
const { renderDailyV3 } = require('../../src/generator/daily-v3-view-model');
const { renderDailyV2 } = require('../../src/generator/daily-v2-view-model');
const { renderWeeklyV3 } = require('../../src/generator/weekly-v3-view-model');

const REPO = 'gap/repo';
const OTHER = 'other/repo';

let root;
let prevDataDir;

function atNoon(date) {
  return `${date}T04:00:00.000Z`;
}

function project(fullName, todayStars = 10) {
  return {
    fullName,
    todayStars,
    stars: 100,
    forks: 1,
    language: 'Python',
    url: `https://github.com/${fullName}`,
    description: '用于累计上榜测试的简介',
    analysis: { typeName: '工具', descZh: '一个用于测试的中文简介。' },
  };
}

function briefFor(date, names, scrapedAt = atNoon(date)) {
  return {
    date,
    scrapedAt,
    generatedAt: scrapedAt,
    projects: names.map(name => project(name)),
    stats: { totalProjects: names.length },
  };
}

function writeDaily(date, names, scrapedAt) {
  const brief = briefFor(date, names, scrapedAt);
  const dir = path.join(root, 'data', 'briefs', 'daily');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `data-${date}.json`), JSON.stringify(brief));
  return brief;
}

function writeWeekly(week, names) {
  const dir = path.join(root, 'data', 'briefs', 'weekly');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `data-weekly-${week}.json`), JSON.stringify({
    week,
    projects: names.map(name => project(name, 20)),
  }));
}

function handCount(name, currentBrief, currentDate) {
  const byDay = new Map();
  const dir = path.join(root, 'data', 'briefs', 'daily');
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const brief = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const day = history.getScrapedDate(brief.scrapedAt || brief.generatedAt) || brief.date;
      const time = new Date(brief.scrapedAt || brief.generatedAt || 0).getTime();
      const prev = byDay.get(day);
      if (prev && prev.time > time) continue;
      byDay.set(day, {
        time,
        names: new Set((brief.projects || []).map(item => item.fullName)),
      });
    }
  }
  if (currentBrief) {
    const day = history.getScrapedDate(currentBrief.scrapedAt || currentBrief.generatedAt) || currentDate;
    byDay.set(day, {
      time: new Date(currentBrief.scrapedAt || 0).getTime(),
      names: new Set((currentBrief.projects || []).map(item => item.fullName)),
    });
  }
  let count = 0;
  for (const entry of byDay.values()) {
    if (entry.names.has(name)) count += 1;
  }
  return count;
}

function assertNotBelowStreak(metrics, label) {
  for (const [name, streak] of Object.entries(metrics.streakDays)) {
    assert.ok(
      metrics.appearanceDays[name] >= streak,
      `${label} ${name} 累计 ${metrics.appearanceDays[name]} 应 ≥ 连续 ${streak}`
    );
  }
}

test.beforeEach(() => {
  prevDataDir = process.env.REPORT_DATA_DIR;
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'appearance-days-'));
  process.env.REPORT_DATA_DIR = path.join(root, 'data');
  history.resetHistoryCache();
});

test.afterEach(() => {
  if (prevDataDir === undefined) delete process.env.REPORT_DATA_DIR;
  else process.env.REPORT_DATA_DIR = prevDataDir;
  history.resetHistoryCache();
  fs.rmSync(root, { recursive: true, force: true });
});

test('同仓累计次数始终不小于连续天数', () => {
  writeDaily('2026-03-01', [REPO]);
  writeDaily('2026-03-02', [REPO]);
  const day2 = computeDailyMetrics('2026-03-02', { brief: briefFor('2026-03-02', [REPO]) });
  assert.equal(day2.streakDays[REPO], 2);
  assert.equal(day2.appearanceDays[REPO], 2);
  assertNotBelowStreak(day2, '连续两天');
  assert.equal(day2.appearanceDays[REPO], handCount(REPO, briefFor('2026-03-02', [REPO]), '2026-03-02'));
});

test('断档后再上榜时连续变小、累计仍增加', () => {
  writeDaily('2026-03-01', [REPO]);
  writeDaily('2026-03-02', [REPO]);
  writeDaily('2026-03-03', [OTHER]);
  const before = computeDailyMetrics('2026-03-02', { brief: briefFor('2026-03-02', [REPO]) });
  const after = computeDailyMetrics('2026-03-04', { brief: briefFor('2026-03-04', [REPO]) });

  assert.equal(before.streakDays[REPO], 2);
  assert.equal(before.appearanceDays[REPO], 2);
  assert.equal(after.streakDays[REPO], 1);
  assert.equal(after.appearanceDays[REPO], 3);
  assert.ok(after.streakDays[REPO] < before.streakDays[REPO]);
  assert.ok(after.appearanceDays[REPO] > before.appearanceDays[REPO]);
  assertNotBelowStreak(after, '断档回归');
  assert.equal(after.appearanceDays[REPO], handCount(REPO, briefFor('2026-03-04', [REPO]), '2026-03-04'));
});

test('缺少抓取日不打断连续，累计只计有 brief 的抓取日', () => {
  writeDaily('2026-03-01', [REPO]);
  const metrics = computeDailyMetrics('2026-03-03', { brief: briefFor('2026-03-03', [REPO]) });
  assert.equal(metrics.streakDays[REPO], 2);
  assert.equal(metrics.appearanceDays[REPO], 2);
  assertNotBelowStreak(metrics, '缺日');
});

test('本期 brief 尚未落盘时仍计入当天', () => {
  writeDaily('2026-03-01', [REPO]);
  const current = briefFor('2026-03-02', [REPO]);
  const metrics = computeDailyMetrics('2026-03-02', { brief: current });
  assert.equal(metrics.streakDays[REPO], 2);
  assert.equal(metrics.appearanceDays[REPO], 2);
  assert.equal(fs.existsSync(path.join(root, 'data', 'briefs', 'daily', 'data-2026-03-02.json')), false);
});

test('同一抓取日多份快照只计 1 次，以最新一份为准', () => {
  writeDaily('2026-04-01', [REPO], '2026-04-01T01:00:00.000Z');
  writeDaily('2026-04-02', [OTHER], '2026-04-01T10:00:00.000Z');
  const current = briefFor('2026-04-03', [REPO]);
  const metrics = computeDailyMetrics('2026-04-03', { brief: current });
  assert.equal(metrics.appearanceDays[REPO], 1);
  assert.equal(metrics.streakDays[REPO], 1);
  assert.equal(metrics.appearanceDays[REPO], handCount(REPO, current, '2026-04-03'));
});

test('超过 30 个抓取日的更早出现计入累计，不拉长连续', () => {
  const start = '2026-05-01';
  const dates = [];
  for (let offset = 0; offset < 35; offset += 1) {
    dates.push(history.addDays(start, offset));
  }
  dates.forEach((date, index) => {
    writeDaily(date, index === 0 ? [OTHER] : [REPO]);
  });
  history.resetHistoryCache();
  const last = dates[dates.length - 1];
  const metrics = computeDailyMetrics(last, { brief: briefFor(last, [REPO]) });
  assert.equal(metrics.streakDays[REPO], 31);
  assert.equal(metrics.appearanceDays[REPO], 34);
  assert.ok(metrics.appearanceDays[REPO] > metrics.streakDays[REPO]);
  assert.equal(metrics.appearanceDays[REPO], handCount(REPO, briefFor(last, [REPO]), last));
});

test('enrich 不把累计次数写回 brief', () => {
  writeDaily('2026-03-01', [REPO]);
  const brief = briefFor('2026-03-01', [REPO]);
  const metrics = enrichDailyBrief(brief, { date: '2026-03-01' });
  assert.equal(brief.appearanceDays, undefined);
  assert.equal(metrics.appearanceDays[REPO], 1);
  assert.equal(appearanceCounts({ brief, date: '2026-03-01' })[REPO], 1);
});

test('日报 v3/v2 项目卡同时写出连续与累计', () => {
  writeDaily('2026-03-01', [REPO]);
  writeDaily('2026-03-02', [REPO]);
  writeDaily('2026-03-03', [OTHER]);
  const current = briefFor('2026-03-04', [REPO]);
  current.streakDays = { [REPO]: 1 };
  history.resetHistoryCache();

  for (const render of [renderDailyV3, renderDailyV2]) {
    const html = render(current);
    const cardAt = html.indexOf('id="p-gap-repo"');
    assert.ok(cardAt >= 0, '项目卡锚点存在');
    const card = html.slice(cardAt, cardAt + 2500);
    assert.match(card, /连续上榜/);
    assert.match(card, /1 天/);
    assert.match(card, /累计上榜/);
    assert.match(card, /3 次/);
    assert.match(html, /repeat\(5,minmax\(0,1fr\)\)/);
  }
});

test('周报连续花名册与完整列表使用同一累计口径', () => {
  writeDaily('2026-01-05', [REPO]);
  writeDaily('2026-01-06', [REPO]);
  writeDaily('2026-01-08', [REPO]);
  const week = history.getISOWeekId('2026-01-08');
  const prev = history.shiftISOWeek(week, -1);
  writeWeekly(prev, [REPO]);
  history.resetHistoryCache();

  const html = renderWeeklyV3({
    weekStart: week,
    projects: [project(REPO, 20)],
  });
  const contAt = html.indexOf('roster-h cont');
  const retAt = html.indexOf('roster-h ret');
  assert.ok(contAt >= 0 && retAt > contAt);
  const cont = html.slice(contAt, retAt);
  assert.match(cont, /gap(?:\/|&#x2F;)repo/);
  assert.match(cont, /累计上榜 3 次/);
  assert.match(html, /完整列表/);
  assert.match(html, /累计上榜 3 次/);
  assert.equal(appearanceCounts()[REPO], 3);
});
