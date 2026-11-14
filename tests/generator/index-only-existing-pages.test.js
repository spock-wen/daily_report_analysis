#!/usr/bin/env node
'use strict';

/**
 * 首页/侧栏只链存在的正式 HTML：brief 有而正式页不存在（及仅 *.FAIL.html）的
 * 日/周/月不得出现在 href 中；真实存在的正式页照常出现。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateIndex, collectReportsData } = require('../../scripts/generate-index');

const REPO_ROOT = path.resolve(__dirname, '../..');

let total = 0;
let passed = 0;

function assert(condition, name) {
  total += 1;
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
  }
}

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

function hrefCount(hrefs, needle) {
  return hrefs.filter(href => href.includes(needle)).length;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeHtml(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `<!doctype html><html><body>${body}</body></html>`);
}

function briefDaily(date) {
  return { date, projects: [{ repo: 'acme/demo', isAI: true, stars: 10, todayStars: 1 }] };
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
    if (result && typeof result.then === 'function') {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

async function runFixtureCase() {
  console.log('\n' + '='.repeat(60));
  console.log('  夹具：brief 有 / 正式 HTML 无 → href=0；真页放行');
  console.log('='.repeat(60) + '\n');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'index-only-existing-'));
  const dataDir = path.join(root, 'data');
  const outDir = path.join(root, 'reports');

  writeJson(path.join(dataDir, 'briefs/daily/data-2026-01-01.json'), briefDaily('2026-01-01'));
  writeJson(path.join(dataDir, 'briefs/daily/data-2026-01-02.json'), briefDaily('2026-01-02'));
  writeJson(path.join(dataDir, 'briefs/daily/data-2026-01-03.json'), briefDaily('2026-01-03'));
  writeJson(path.join(dataDir, 'briefs/daily/data-2026-01-04.json'), briefDaily('2026-01-04'));
  writeJson(path.join(dataDir, 'briefs/weekly/data-weekly-2026-W01.json'), { week: '2026-W01', date: '2026-W01', projects: [] });
  writeJson(path.join(dataDir, 'briefs/weekly/data-weekly-2026-W02.json'), { week: '2026-W02', date: '2026-W02', projects: [] });
  writeJson(path.join(dataDir, 'briefs/monthly/data-month-2026-01.json'), { month: '2026-01', date: '2026-01', projects: [] });
  writeJson(path.join(dataDir, 'briefs/monthly/data-month-2026-02.json'), { month: '2026-02', date: '2026-02', projects: [] });

  writeHtml(path.join(outDir, 'daily/github-ai-trending-2026-01-01.html'), 'daily ok');
  writeHtml(path.join(outDir, 'daily/github-ai-trending-2026-01-03.FAIL.html'), '<div class="fail-banner">内容核查未通过（FAIL）</div>');
  writeHtml(path.join(outDir, 'daily/github-ai-trending-2026-01-04.html'), '<div class="fail-banner">内容核查未通过（FAIL）</div>');
  writeHtml(path.join(outDir, 'weekly/github-weekly-2026-W01.html'), 'weekly ok');
  writeHtml(path.join(outDir, 'monthly/github-monthly-2026-01.html'), 'monthly ok');

  await withEnv({ REPORT_DATA_DIR: dataDir, REPORT_OUT_DIR: outDir }, async () => {
    const collected = collectReportsData();
    assert(collected.daily.map(d => d.date).join(',') === '2026-01-01', 'collectReportsData 只收有正式页的日报');
    assert(collected.weekly.map(w => w.week).join(',') === '2026-W01', 'collectReportsData 只收有正式页的周报');
    assert(collected.monthly.map(m => m.month).join(',') === '2026-01', 'collectReportsData 只收有正式页的月报');

    const result = await generateIndex();
    assert(result.success === true, 'generateIndex 成功');
    const indexPath = path.join(outDir, 'index.html');
    assert(fs.existsSync(indexPath), '临时目录写出 index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    const hrefs = collectHrefs(html);

    assert(hrefCount(hrefs, 'github-ai-trending-2026-01-02.html') === 0, '缺正式日报 2026-01-02 href=0（首页+侧栏）');
    assert(hrefCount(hrefs, 'github-weekly-2026-W02.html') === 0, '缺正式周报 2026-W02 href=0（首页+侧栏）');
    assert(hrefCount(hrefs, 'github-monthly-2026-02.html') === 0, '缺正式月报 2026-02 href=0（首页+侧栏）');
    assert(hrefCount(hrefs, 'github-ai-trending-2026-01-03') === 0, '仅 .FAIL 的 2026-01-03 不出现');
    assert(hrefCount(hrefs, '.FAIL') === 0, '零链接指向 .FAIL');
    assert(hrefCount(hrefs, 'github-ai-trending-2026-01-04.html') === 0, '正式名但 FAIL 红条的 2026-01-04 href=0');

    assert(hrefCount(hrefs, 'daily/github-ai-trending-2026-01-01.html') >= 1, '真实日报 2026-01-01 照常出现');
    assert(hrefCount(hrefs, 'weekly/github-weekly-2026-W01.html') >= 1, '真实周报 2026-W01 照常出现');
    assert(hrefCount(hrefs, 'monthly/github-monthly-2026-01.html') >= 1, '真实月报 2026-01 照常出现');
  });

  fs.rmSync(root, { recursive: true, force: true });
}

async function runRealDataRender() {
  console.log('\n' + '='.repeat(60));
  console.log('  本地渲染真实数据到临时目录（11-12 等缺页不出现）');
  console.log('='.repeat(60) + '\n');

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-real-render-'));
  for (const sub of ['daily', 'weekly', 'monthly']) {
    fs.symlinkSync(path.join(REPO_ROOT, 'reports', sub), path.join(outDir, sub));
  }

  await withEnv({
    REPORT_DATA_DIR: path.join(REPO_ROOT, 'data'),
    REPORT_OUT_DIR: outDir,
  }, async () => {
    const result = await generateIndex();
    assert(result.success === true, '真实数据 generateIndex 成功');
    const indexPath = path.join(outDir, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    const hrefs = collectHrefs(html);

    assert(path.resolve(indexPath).startsWith(path.resolve(outDir)), '输出在独立临时目录');
    assert(hrefCount(hrefs, 'github-ai-trending-2026-11-12.html') === 0, '缺页 2026-11-12 不出现在 href');
    assert(hrefCount(hrefs, '.FAIL') === 0, '真实渲染零链接指向 .FAIL');
    assert(hrefCount(hrefs, 'daily/github-ai-trending-2026-11-11.html') >= 1, '已有正式页 2026-11-11 照常出现');
    assert(hrefCount(hrefs, 'daily/github-ai-trending-2026-11-13.html') >= 1, '已有正式页 2026-11-13 照常出现');
  });

  fs.rmSync(outDir, { recursive: true, force: true });
}

(async () => {
  try {
    await runFixtureCase();
    await runRealDataRender();
  } catch (error) {
    console.error('\n测试异常:', error);
    process.exit(1);
  }
  console.log(`\n结果：${passed}/${total} 通过\n`);
  process.exit(passed === total && total > 0 ? 0 : 1);
})();
