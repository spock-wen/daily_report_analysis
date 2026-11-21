#!/usr/bin/env node
'use strict';

/**
 * 2A：当周周报未发布时，日报页「本周周报」链最近一篇已发布周报；
 * 当周正式页存在后链当周。渲染 HTML 零读者链指向缺正式名或 .FAIL。
 * 晨检脚本离线模式能抓住日报页死链，放行可达链。
 */

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { test } = require('node:test');

const { renderDailyV3, buildArchive } = require('../../src/generator/daily-v3-view-model');
const { renderHomeV3 } = require('../../src/generator/home-v3-view-model');
const { renderWeeklyV3 } = require('../../src/generator/weekly-v3-view-model');

const LINKCHECK = path.resolve(__dirname, '../../scripts/report-link-check.py');

function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function collectHrefs(html) {
  const hrefs = [];
  const re = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let match;
  while ((match = re.exec(html))) {
    hrefs.push(decodeEntities(match[1] || match[2] || ''));
  }
  return hrefs;
}

function readerHrefs(hrefs) {
  return hrefs.filter(href => {
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return false;
    if (/^https?:\/\//i.test(href) && !/report\.wenspock\./i.test(href)) return false;
    return true;
  });
}

function officialTargetExists(reportsDir, fromFile, href) {
  const resolved = path.resolve(path.dirname(fromFile), href.split('#')[0]);
  return resolved.startsWith(path.resolve(reportsDir)) && fs.existsSync(resolved)
    && !/\.FAIL/i.test(href)
    && !/class="fail-banner"|内容核查未通过（FAIL）/.test(fs.readFileSync(resolved, 'utf8'));
}

function writePage(filePath, body = 'ok') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `<!doctype html><html><body>${body}</body></html>`);
}

function withEnv(env, fn) {
  const prev = {};
  for (const [key, value] of Object.entries(env)) {
    prev[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  try {
    const result = fn();
    if (result && typeof result.then === 'function') return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-weekly-link-'));
  const reports = path.join(root, 'reports');
  const data = path.join(root, 'data');
  fs.mkdirSync(path.join(reports, 'daily'), { recursive: true });
  fs.mkdirSync(path.join(reports, 'weekly'), { recursive: true });
  fs.mkdirSync(path.join(reports, 'monthly'), { recursive: true });
  fs.mkdirSync(path.join(data, 'briefs', 'daily'), { recursive: true });
  fs.mkdirSync(path.join(data, 'briefs', 'weekly'), { recursive: true });
  fs.mkdirSync(path.join(data, 'briefs', 'monthly'), { recursive: true });
  writePage(path.join(reports, 'index.html'), '<a href="weekly/github-weekly-2026-W46.html">W46</a>');
  writePage(path.join(reports, 'weekly', 'github-weekly-2026-W46.html'), 'W46 official');
  writePage(path.join(reports, 'weekly', 'github-weekly-2026-W45.html'), 'W45 official');
  writePage(path.join(reports, 'monthly', 'github-monthly-2026-10.html'), '2026-10 official');
  writePage(path.join(reports, 'daily', 'github-ai-trending-2026-11-19.html'), '11-19 official');
  writePage(path.join(reports, 'daily', 'github-ai-trending-2026-11-20.html'), '11-20 official');
  fs.writeFileSync(
    path.join(data, 'briefs', 'daily', 'data-2026-11-20.json'),
    JSON.stringify({ date: '2026-11-20', projects: [{ repo: 'acme/demo', todayStars: 10, stars: 100, isAI: true }] }),
  );
  return { root, reports, data };
}

function dailyData(date = '2026-11-20') {
  return {
    date,
    projects: [{ fullName: 'acme/demo', repo: 'acme/demo', todayStars: 10, stars: 100, isAI: true, language: 'JS' }],
    stats: { totalProjects: 1, aiProjects: 1, totalToday: 10 },
    scrapedAt: `${date}T00:00:00.000Z`,
    generatedAt: `${date}T00:30:00.000Z`,
  };
}

function assertNoDeadReaderLinks(html, reportsDir, fromFile, label) {
  const hrefs = readerHrefs(collectHrefs(html));
  const dead = hrefs.filter(href => {
    if (!href) return false;
    if (href === '../wiki-index.html' || href === 'wiki-index.html') return false;
    if (!/\.html($|\?)/.test(href) && !/index\.html$/.test(href) && !href.endsWith('/')) {
      // 站内相对页
      if (!/\.(html|css)$/.test(href) && !href.includes('/')) return false;
    }
    if (/\.FAIL/i.test(href)) return true;
    const dest = path.resolve(path.dirname(fromFile), href.split('#')[0]);
    if (!dest.startsWith(path.resolve(reportsDir))) return false;
    if (!fs.existsSync(dest)) return true;
    const body = fs.readFileSync(dest, 'utf8');
    return /class="fail-banner"|内容核查未通过（FAIL）/.test(body);
  });
  assert.deepEqual(dead, [], `${label} 不得链缺正式名或 .FAIL：${dead.join(', ')}`);
}

test('未发布当周时，日报页链最近已发布周报 W46，不链 W47', () => {
  const { root, reports, data } = fixtureRoot();
  try {
    withEnv({ REPORT_OUT_DIR: reports, REPORT_DATA_DIR: data }, () => {
      const html = renderDailyV3(dailyData('2026-11-20'));
      const hrefs = collectHrefs(html);
      const weekly = hrefs.filter(href => href.includes('github-weekly-'));
      assert.ok(weekly.some(href => href.includes('2026-W46')), '应链到已发布的 W46');
      assert.equal(weekly.filter(href => href.includes('2026-W47')).length, 0, '不得链未发布的 W47');
      assert.match(html, /2026-W46/);
      const outFile = path.join(reports, 'daily', 'github-ai-trending-2026-11-20.html');
      fs.writeFileSync(outFile, html);
      assertNoDeadReaderLinks(html, reports, outFile, '日报未发布当周');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('当周正式页存在时，日报页链当周 W47', () => {
  const { root, reports, data } = fixtureRoot();
  try {
    writePage(path.join(reports, 'weekly', 'github-weekly-2026-W47.html'), 'W47 official');
    withEnv({ REPORT_OUT_DIR: reports, REPORT_DATA_DIR: data }, () => {
      const html = renderDailyV3(dailyData('2026-11-20'));
      const hrefs = collectHrefs(html);
      const crumb = html.match(/aria-label="面包屑"[\s\S]*?<\/nav>/);
      assert.ok(crumb, '应有面包屑');
      const crumbHrefs = collectHrefs(crumb[0]);
      assert.ok(crumbHrefs.some(href => href.includes('2026-W47')), '面包屑应链当周 W47');
      assert.equal(crumbHrefs.filter(href => href.includes('2026-W46')).length, 0);
      const outFile = path.join(reports, 'daily', 'github-ai-trending-2026-11-20.html');
      fs.writeFileSync(outFile, html);
      assertNoDeadReaderLinks(html, reports, outFile, '日报已发布当周');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('首页与周报渲染：零读者链指向缺正式名或 .FAIL', () => {
  const { root, reports, data } = fixtureRoot();
  try {
    writePage(path.join(reports, 'weekly', 'github-weekly-2026-W47.FAIL.html'), '<div class="fail-banner">内容核查未通过（FAIL）</div>');
    withEnv({ REPORT_OUT_DIR: reports, REPORT_DATA_DIR: data }, () => {
      const home = renderHomeV3({
        daily: [{ date: '2026-11-20', projectCount: 1, projects: [{ fullName: 'acme/demo', todayStars: 10 }] }],
        weekly: [
          { week: '2026-W46', projectCount: 1, projects: [{ fullName: 'acme/demo', todayStars: 10 }] },
          { week: '2026-W47', projectCount: 1, projects: [] },
        ],
        monthly: [{ month: '2026-10', projectCount: 1 }],
      });
      const indexPath = path.join(reports, 'index.html');
      fs.writeFileSync(indexPath, home);
      assert.equal(collectHrefs(home).filter(href => href.includes('W47') || href.includes('.FAIL')).length, 0);
      assertNoDeadReaderLinks(home, reports, indexPath, '首页');

      const weeklyHtml = renderWeeklyV3({
        weekStart: '2026-W46',
        weekEnd: '2026-11-15',
        week: '2026-W46',
        projects: [{ fullName: 'acme/demo', todayStars: 10, stars: 100 }],
        weekMetrics: { startDate: '2026-11-09', endDate: '2026-11-15', weekNewStars: 10, week: '2026-W46' },
      });
      const weeklyFile = path.join(reports, 'weekly', 'github-weekly-2026-W46.html');
      fs.writeFileSync(weeklyFile, weeklyHtml);
      const weeklyHrefs = collectHrefs(weeklyHtml);
      assert.equal(weeklyHrefs.filter(href => href.includes('W47') || href.includes('.FAIL')).length, 0);
      assertNoDeadReaderLinks(weeklyHtml, reports, weeklyFile, '周报');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('buildArchive：未发布当周回退到最近已发布周，且 href 去重仍成立', () => {
  const { root, reports, data } = fixtureRoot();
  try {
    withEnv({ REPORT_OUT_DIR: reports, REPORT_DATA_DIR: data }, () => {
      const items = buildArchive({ date: '2026-11-20', weekLabel: '2026-W47', priorDates: ['2026-11-19'] });
      const weekItems = items.filter(item => /github-weekly-/.test(item.href || ''));
      assert.ok(weekItems.some(item => item.href.includes('2026-W46')));
      assert.equal(weekItems.filter(item => item.href.includes('2026-W47')).length, 0);
      const hrefs = items.map(item => item.href).filter(Boolean);
      assert.equal(new Set(hrefs).size, hrefs.length, 'href 唯一');
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('晨检 LINKCHECK 离线：能抓住日报页死链，放行可达链', () => {
  const { root, reports } = fixtureRoot();
  try {
    const daily = path.join(reports, 'daily', 'github-ai-trending-2026-11-20.html');
    fs.writeFileSync(
      daily,
      `<!doctype html><html><body>
        <a href="../weekly/github-weekly-2026-W47.html">本周周报</a>
        <a href="../index.html">首页</a>
      </body></html>`,
    );
    const bad = execFileSync('python3', [
      LINKCHECK, '--offline', '--no-today-daily',
      '--reports-root', reports,
      '--index', path.join(reports, 'index.html'),
      '--page', daily,
    ], { encoding: 'utf8' });
    // 上面应失败。execFileSync 会抛错，改用 try。
    assert.fail(`死链夹具应当失败，实际输出：${bad}`);
  } catch (error) {
    const out = String(error.stdout || '') + String(error.stderr || '');
    assert.match(out, /BAD_LINK/);
    assert.match(out, /2026-W47/);
    assert.match(out, /缺正式名/);
  } finally {
    // continue to pass case in same test after cleanup? do pass case below
    fs.rmSync(root, { recursive: true, force: true });
  }

  const passFix = fixtureRoot();
  try {
    const daily = path.join(passFix.reports, 'daily', 'github-ai-trending-2026-11-20.html');
    fs.writeFileSync(
      daily,
      `<!doctype html><html><body>
        <a href="../weekly/github-weekly-2026-W46.html">本周周报</a>
        <a href="../index.html">首页</a>
      </body></html>`,
    );
    const out = execFileSync('python3', [
      LINKCHECK, '--offline', '--include-today-daily', '--today', '2026-11-20',
      '--reports-root', passFix.reports,
      '--index', path.join(passFix.reports, 'index.html'),
    ], { encoding: 'utf8' });
    assert.match(out, /links_checked=\d+/);
    assert.match(out, /bad=0/);
  } finally {
    fs.rmSync(passFix.root, { recursive: true, force: true });
  }
});
