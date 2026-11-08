'use strict';

process.env.REPORT_NO_PUSH = '1';
process.env.WELINK_ENABLED = 'false';
process.env.FEISHU_ENABLED = 'false';
process.env.REPORT_NO_WIKI = '1';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE = path.join(__dirname, '../fixtures/wiki-trending-raw/weekly-2026-10-19.json');
const PROTECTED_HTML = path.join(__dirname, '../../reports/weekly/github-weekly-2026-W44.html');
const PROTECTED_INDEX = path.join(__dirname, '../../reports/index.html');
const PROTECTED_WIKI = path.join(__dirname, '../../wiki/projects/meta_astryx.md');

const {
  assessWeeklyRaw,
  resolveExpectedWeekStart,
  runWeeklyAdmission,
  inspectWeeklyContent,
} = require('../../src/weekly/admission');
const { runIsolatedWeeklyPreflight } = require('../../src/weekly/isolated-preflight');
const { exitCodeFor, buildWeeklyAdmissionArgs, runCli } = require('../../scripts/run-weekly-workflow');

const FORMAL_HTML_RE = /^github-weekly-\d{4}-W\d{2}\.html$/;

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function readProtected() {
  return {
    html: fs.readFileSync(PROTECTED_HTML),
    index: fs.readFileSync(PROTECTED_INDEX),
    wiki: fs.existsSync(PROTECTED_WIKI) ? fs.readFileSync(PROTECTED_WIKI) : null,
  };
}

function assertProtected(before) {
  assert.deepEqual(fs.readFileSync(PROTECTED_HTML), before.html);
  assert.deepEqual(fs.readFileSync(PROTECTED_INDEX), before.index);
  if (before.wiki) assert.deepEqual(fs.readFileSync(PROTECTED_WIKI), before.wiki);
}

function makeRoots() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-admission-'));
  const wikiBase = path.join(root, 'wiki');
  const formalDataDir = path.join(root, 'formal-data');
  const formalReportsDir = path.join(root, 'formal-reports');
  const isolatedRoot = path.join(root, 'isolated');
  fs.mkdirSync(path.join(wikiBase, 'raw', 'trending-weekly'), { recursive: true });
  fs.mkdirSync(formalDataDir, { recursive: true });
  fs.mkdirSync(formalReportsDir, { recursive: true });
  fs.mkdirSync(isolatedRoot, { recursive: true });
  return { root, wikiBase, formalDataDir, formalReportsDir, isolatedRoot };
}

function rawPath(wikiBase, name = '2026-10-19.json') {
  return path.join(wikiBase, 'raw', 'trending-weekly', name);
}

function writeRaw(wikiBase, contents, name = '2026-10-19.json') {
  const file = rawPath(wikiBase, name);
  fs.writeFileSync(file, contents);
  return file;
}

function fixtureObject() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function formalHtmlPath(reportsDir, isoWeek) {
  return path.join(reportsDir, 'weekly', `github-weekly-${isoWeek}.html`);
}

function listFormalHtml(reportsDir) {
  const dir = path.join(reportsDir, 'weekly');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => FORMAL_HTML_RE.test(name));
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (current) => {
    for (const name of fs.readdirSync(current)) {
      if (name === '.locks') continue;
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.endsWith('.json') || name.endsWith('.html')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function baseOptions(roots, extra = {}) {
  return {
    wikiBase: roots.wikiBase,
    weekStart: '2026-10-19',
    formalDataDir: roots.formalDataDir,
    formalReportsDir: roots.formalReportsDir,
    isolatedRoot: roots.isolatedRoot,
    waitMs: 0,
    pollMs: 10,
    settleMs: 0,
    noPush: true,
    enableIndex: false,
    enableNotification: false,
    enableWiki: false,
    ...extra,
  };
}

describe('周报 raw 就绪', () => {
  it('周日对应的周期是当周周一，而不是上一周', () => {
    assert.equal(resolveExpectedWeekStart({ asOf: '2026-11-08' }).weekStart, '2026-11-02');
    assert.equal(resolveExpectedWeekStart({ asOf: '2026-11-01' }).weekStart, '2026-10-26');
    assert.equal(resolveExpectedWeekStart({ weekStart: '2026-10-19' }).weekStart, '2026-10-19');
  });

  it('非周一的 week-start 不能进入预检', () => {
    const resolved = resolveExpectedWeekStart({ weekStart: '2026-11-08' });
    assert.equal(resolved.ok, false);
    assert.equal(resolved.code, 'WEEK_START_NOT_MONDAY');
  });

  it('完整、非空且周期吻合才算就绪', () => {
    const roots = makeRoots();
    writeRaw(roots.wikiBase, fs.readFileSync(FIXTURE));
    const ready = assessWeeklyRaw({ wikiBase: roots.wikiBase, weekStart: '2026-10-19' });
    assert.equal(ready.ready, true);
    assert.equal(ready.weekStart, '2026-10-19');
    assert.equal(ready.isoWeek, '2026-W43');
    assert.equal(ready.hash, sha256(fs.readFileSync(rawPath(roots.wikiBase))));
    assert.equal(ready.mapped.projects[0].fullName, 'cloudflare/security-audit-skill');
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('缺文件不是 PASS', () => {
    const roots = makeRoots();
    const ready = assessWeeklyRaw({ wikiBase: roots.wikiBase, weekStart: '2026-10-19' });
    assert.equal(ready.ready, false);
    assert.equal(ready.code, 'RAW_MISSING');
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('空文件与半截 JSON 不是就绪', () => {
    const roots = makeRoots();
    writeRaw(roots.wikiBase, '   ');
    assert.equal(assessWeeklyRaw({ wikiBase: roots.wikiBase, weekStart: '2026-10-19' }).code, 'RAW_EMPTY');
    writeRaw(roots.wikiBase, '{"week_start":"2026-10-19","projects":[');
    const partial = assessWeeklyRaw({ wikiBase: roots.wikiBase, weekStart: '2026-10-19' });
    assert.equal(partial.ready, false);
    assert.equal(partial.code, 'RAW_PARTIAL');
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('空榜、字段残缺或错误周期不是就绪', () => {
    const roots = makeRoots();
    const empty = fixtureObject();
    empty.projects = [];
    empty.count = 0;
    writeRaw(roots.wikiBase, JSON.stringify(empty));
    assert.equal(assessWeeklyRaw({ wikiBase: roots.wikiBase, weekStart: '2026-10-19' }).code, 'RAW_INCOMPLETE');

    const broken = fixtureObject();
    broken.projects = [{ rank: 1, repo: 'not-a-repo' }];
    broken.count = 1;
    writeRaw(roots.wikiBase, JSON.stringify(broken));
    assert.equal(assessWeeklyRaw({ wikiBase: roots.wikiBase, weekStart: '2026-10-19' }).code, 'RAW_INCOMPLETE');

    const wrong = fixtureObject();
    wrong.date = '2026-10-12';
    wrong.week_start = '2026-10-12';
    wrong.week_end = '2026-10-18';
    writeRaw(roots.wikiBase, JSON.stringify(wrong));
    const mismatch = assessWeeklyRaw({ wikiBase: roots.wikiBase, weekStart: '2026-10-19' });
    assert.equal(mismatch.ready, false);
    assert.equal(mismatch.code, 'PERIOD_MISMATCH');
    fs.rmSync(roots.root, { recursive: true, force: true });
  });
});

describe('周报准入', () => {
  let protectedBefore;

  before(() => {
    protectedBefore = readProtected();
  });

  after(() => {
    assertProtected(protectedBefore);
    assert.equal(process.env.REPORT_NO_PUSH, '1');
    assert.equal(process.env.REPORT_NO_WIKI, '1');
  });

  it('数据未齐时有限等待后失败，不预检、不写正式产物、不推送', async () => {
    const roots = makeRoots();
    let now = 0;
    let sleeps = 0;
    let preflight = 0;
    let published = 0;
    let notified = 0;
    const result = await runWeeklyAdmission(baseOptions(roots, {
      waitMs: 1000,
      pollMs: 100,
      now: () => now,
      sleep: async (ms) => {
        sleeps += 1;
        now += ms;
      },
      preflight: async () => {
        preflight += 1;
        return { pass: true, content: {} };
      },
      htmlWriter: async () => {
        published += 1;
        return 'nope';
      },
      notify: async () => {
        notified += 1;
      },
    }));
    assert.equal(result.success, false);
    assert.equal(result.code, 'RAW_MISSING');
    assert.equal(result.pass, false);
    assert.equal(preflight, 0);
    assert.equal(published, 0);
    assert.equal(notified, 0);
    assert.ok(now <= 1000);
    assert.ok(sleeps > 0);
    assert.deepEqual(listFormalHtml(roots.formalReportsDir), []);
    assert.deepEqual(listJson(roots.formalDataDir), []);
    assert.equal(fs.existsSync(path.join(roots.formalReportsDir, 'index.html')), false);
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('半写和错误周期都不会进入预检或正式发布', async () => {
    const roots = makeRoots();
    const calls = [];
    writeRaw(roots.wikiBase, '{"week_start":');
    const partial = await runWeeklyAdmission(baseOptions(roots, {
      preflight: async () => {
        calls.push('partial');
        return { pass: true, content: {} };
      },
      htmlWriter: async () => 'x',
    }));
    assert.equal(partial.code, 'RAW_PARTIAL');
    assert.equal(partial.pass, false);

    const wrong = fixtureObject();
    wrong.week_start = '2026-10-12';
    wrong.date = '2026-10-12';
    wrong.week_end = '2026-10-18';
    writeRaw(roots.wikiBase, JSON.stringify(wrong));
    const mismatch = await runWeeklyAdmission(baseOptions(roots, {
      preflight: async () => {
        calls.push('mismatch');
        return { pass: true, content: {} };
      },
      htmlWriter: async () => 'x',
    }));
    assert.equal(mismatch.code, 'PERIOD_MISMATCH');
    assert.deepEqual(calls, []);
    assert.deepEqual(listFormalHtml(roots.formalReportsDir), []);
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('ContentGate 失败时不写正式 HTML、不推送，并保留 FAIL 文件名', async () => {
    const roots = makeRoots();
    writeRaw(roots.wikiBase, fs.readFileSync(FIXTURE));
    const failName = path.join(roots.formalReportsDir, 'weekly', 'github-weekly-2026-W43.FAIL.html');
    fs.mkdirSync(path.dirname(failName), { recursive: true });
    fs.writeFileSync(failName, '<html>review only</html>');
    const beforeFail = fs.readFileSync(failName);
    let notified = 0;
    let indexed = 0;
    let wiki = 0;
    const result = await runWeeklyAdmission(baseOptions(roots, {
      notify: async () => {
        notified += 1;
      },
      indexWriter: async () => {
        indexed += 1;
      },
      wikiWriter: async () => {
        wiki += 1;
      },
      htmlWriter: async () => {
        throw new Error('失败路径不得渲染正式 HTML');
      },
      preflight: async (ctx) => inspectWeeklyContent({
        snapshot: ctx.snapshot,
        isolatedRoot: ctx.isolatedRoot,
        insights: { nextWeekPoints: ['看看后续'] },
        brief: {
          date: ctx.snapshot.isoWeek,
          projects: [{ fullName: 'acme/widget', description: 'demo' }],
        },
      }),
    }));
    assert.equal(result.success, false);
    assert.equal(result.code, 'CONTENT_CHECK_FAILED');
    assert.equal(result.pass, false);
    assert.ok(result.findings.some((item) => item.rule_id === 'B5'));
    assert.equal(notified, 0);
    assert.equal(indexed, 0);
    assert.equal(wiki, 0);
    assert.deepEqual(listFormalHtml(roots.formalReportsDir), []);
    assert.equal(fs.readFileSync(failName).equals(beforeFail), true);
    assert.equal(fs.existsSync(path.join(roots.formalDataDir, '.admission', 'weekly-2026-W43.json')), false);
    const dataDir = process.env.REPORT_DATA_DIR;
    assert.ok(!dataDir || !dataDir.startsWith(roots.root));
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('通过后的正式发布复用同一次预检内容，且不再生成', async () => {
    const roots = makeRoots();
    const raw = fs.readFileSync(FIXTURE);
    writeRaw(roots.wikiBase, raw);
    const expectedHash = sha256(raw);
    let preflight = 0;
    let original;
    const result = await runWeeklyAdmission(baseOptions(roots, {
      notify: async () => {
        throw new Error('nopush 不得推送');
      },
      indexWriter: async () => {
        throw new Error('本用例关闭首页');
      },
      wikiWriter: async () => {
        throw new Error('本用例关闭 wiki');
      },
      preflight: async (ctx) => {
        preflight += 1;
        original = {
          marker: 'frozen-marker',
          rawHash: ctx.snapshot.hash,
          isoWeek: ctx.snapshot.isoWeek,
          weekStart: ctx.snapshot.weekStart,
          insights: { weeklyTheme: { detailed: '冻结洞察' } },
          aiCalls: 1,
        };
        return { pass: true, content: original };
      },
      htmlWriter: async (content) => {
        assert.notStrictEqual(content, original);
        original.marker = 'changed-after-check';
        original.aiCalls = 99;
        assert.equal(content.marker, 'frozen-marker');
        assert.equal(content.rawHash, expectedHash);
        assert.equal(content.aiCalls, 1);
        return `<!doctype html><title>${content.isoWeek}</title>${content.marker}`;
      },
    }));
    assert.equal(result.success, true);
    assert.equal(result.code, 'PUBLISHED');
    assert.equal(preflight, 1);
    const html = fs.readFileSync(formalHtmlPath(roots.formalReportsDir, '2026-W43'), 'utf8');
    assert.match(html, /frozen-marker/);
    assert.equal(html.includes('changed-after-check'), false);
    const insights = JSON.parse(fs.readFileSync(
      path.join(roots.formalDataDir, 'insights', 'weekly', 'insights-2026-W43.json'),
      'utf8'
    ));
    assert.equal(insights.weeklyTheme.detailed, '冻结洞察');
    const receipt = JSON.parse(fs.readFileSync(
      path.join(roots.formalDataDir, '.admission', 'weekly-2026-W43.json'),
      'utf8'
    ));
    assert.equal(receipt.rawHash, expectedHash);
    assert.equal(receipt.content.marker, 'frozen-marker');
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('预检之后 raw 被换掉就不得发布', async () => {
    const roots = makeRoots();
    writeRaw(roots.wikiBase, fs.readFileSync(FIXTURE));
    let published = 0;
    const result = await runWeeklyAdmission(baseOptions(roots, {
      preflight: async (ctx) => {
        const swapped = fixtureObject();
        swapped.projects[0].repo = 'example/other';
        fs.writeFileSync(ctx.snapshot.filePath, JSON.stringify(swapped));
        return {
          pass: true,
          content: {
            marker: 'stale',
            rawHash: ctx.snapshot.hash,
            isoWeek: ctx.snapshot.isoWeek,
            weekStart: ctx.snapshot.weekStart,
            insights: { ok: true },
          },
        };
      },
      htmlWriter: async () => {
        published += 1;
        return 'should-not-write';
      },
    }));
    assert.equal(result.success, false);
    assert.equal(result.code, 'INPUT_CHANGED');
    assert.equal(published, 0);
    assert.deepEqual(listFormalHtml(roots.formalReportsDir), []);
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('已发布正式页不被第二次执行改写', async () => {
    const roots = makeRoots();
    writeRaw(roots.wikiBase, fs.readFileSync(FIXTURE));
    const htmlPath = formalHtmlPath(roots.formalReportsDir, '2026-W43');
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
    fs.writeFileSync(htmlPath, '<html>already published</html>');
    const before = fs.readFileSync(htmlPath);
    let preflight = 0;
    const result = await runWeeklyAdmission(baseOptions(roots, {
      preflight: async () => {
        preflight += 1;
        return { pass: true, content: { marker: 'new' } };
      },
      htmlWriter: async () => 'replacement',
    }));
    assert.equal(result.code, 'ALREADY_PUBLISHED');
    assert.equal(result.success, true);
    assert.equal(preflight, 0);
    assert.equal(fs.readFileSync(htmlPath).equals(before), true);
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('并发的第二次调用不得预检或发布', async () => {
    const roots = makeRoots();
    writeRaw(roots.wikiBase, fs.readFileSync(FIXTURE));
    let release;
    const hold = new Promise((resolve) => {
      release = resolve;
    });
    let started = 0;
    let secondPreflight = 0;
    const first = runWeeklyAdmission(baseOptions(roots, {
      preflight: async (ctx) => {
        started += 1;
        await hold;
        return {
          pass: true,
          content: {
            marker: 'first',
            rawHash: ctx.snapshot.hash,
            isoWeek: ctx.snapshot.isoWeek,
            weekStart: ctx.snapshot.weekStart,
            insights: { n: 1 },
          },
        };
      },
      htmlWriter: async (content) => content.marker,
    }));
    while (started === 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const second = await runWeeklyAdmission(baseOptions(roots, {
      preflight: async () => {
        secondPreflight += 1;
        return { pass: true, content: { marker: 'second' } };
      },
      htmlWriter: async () => 'second-html',
    }));
    assert.equal(second.code, 'ALREADY_RUNNING');
    assert.equal(second.success, false);
    assert.equal(secondPreflight, 0);
    release();
    const firstResult = await first;
    assert.equal(firstResult.code, 'PUBLISHED');
    assert.equal(fs.readFileSync(formalHtmlPath(roots.formalReportsDir, '2026-W43'), 'utf8'), 'first');
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('发布失败后的重跑复用已通过内容，不再预检', async () => {
    const roots = makeRoots();
    const raw = fs.readFileSync(FIXTURE);
    writeRaw(roots.wikiBase, raw);
    let preflight = 0;
    let writes = 0;
    const options = baseOptions(roots, {
      preflight: async (ctx) => {
        preflight += 1;
        return {
          pass: true,
          content: {
            marker: 'reuse-me',
            rawHash: ctx.snapshot.hash,
            isoWeek: ctx.snapshot.isoWeek,
            weekStart: ctx.snapshot.weekStart,
            insights: { weeklyTheme: { detailed: '同一份' } },
          },
        };
      },
      htmlWriter: async (content) => {
        writes += 1;
        if (writes === 1) throw new Error('模拟落盘失败');
        assert.equal(content.marker, 'reuse-me');
        return content.marker;
      },
    });
    const failed = await runWeeklyAdmission(options);
    assert.equal(failed.code, 'PUBLISH_FAILED');
    assert.equal(preflight, 1);
    assert.deepEqual(listFormalHtml(roots.formalReportsDir), []);
    const again = await runWeeklyAdmission(options);
    assert.equal(again.code, 'PUBLISHED');
    assert.equal(preflight, 1);
    assert.equal(fs.readFileSync(formalHtmlPath(roots.formalReportsDir, '2026-W43'), 'utf8'), 'reuse-me');
    fs.rmSync(roots.root, { recursive: true, force: true });
  });
});

describe('隔离预检与正式入口', () => {
  it('隔离预检只写临时目录，并带着同一份 raw 进入流水线', async () => {
    const roots = makeRoots();
    writeRaw(roots.wikiBase, fs.readFileSync(FIXTURE));
    const snapshot = assessWeeklyRaw({ wikiBase: roots.wikiBase, weekStart: '2026-10-19' });
    const kept = path.join(roots.formalDataDir, 'briefs', 'daily', 'data-2026-10-19.json');
    fs.mkdirSync(path.dirname(kept), { recursive: true });
    fs.writeFileSync(kept, '{"keep":true}\n');
    const before = fs.readFileSync(kept);
    const seen = [];
    const prevData = process.env.REPORT_DATA_DIR;
    const prevOut = process.env.REPORT_OUT_DIR;
    const prevWiki = process.env.REPORT_NO_WIKI;
    const result = await runIsolatedWeeklyPreflight({
      snapshot,
      isolatedRoot: roots.isolatedRoot,
      formalDataDir: roots.formalDataDir,
      formalReportsDir: roots.formalReportsDir,
      createWorkflow: (options) => {
        seen.push({
          options,
          dataDir: process.env.REPORT_DATA_DIR,
          outDir: process.env.REPORT_OUT_DIR,
          noWiki: process.env.REPORT_NO_WIKI,
          noPush: process.env.REPORT_NO_PUSH,
        });
        return {
          async triggerManual(type, triggerOptions) {
            assert.equal(type, 'weekly');
            assert.equal(triggerOptions.weeklyPreflight, true);
            assert.equal(triggerOptions.data.weekStart, snapshot.isoWeek);
            assert.equal(triggerOptions.data.__weeklyAdmission.purpose, 'isolated-preflight');
            assert.equal(triggerOptions.data.__weeklyAdmission.rawHash, snapshot.hash);
            assert.equal(triggerOptions.data.projects[0].fullName, 'cloudflare/security-audit-skill');
            const brief = path.join(process.env.REPORT_DATA_DIR, 'briefs', 'weekly', 'data-weekly-2026-W43.json');
            fs.mkdirSync(path.dirname(brief), { recursive: true });
            fs.writeFileSync(brief, '{"staged":true}\n');
            return {
              success: true,
              insights: { marker: 'once' },
              data: triggerOptions.data,
            };
          },
        };
      },
    });
    assert.equal(result.pass, true);
    assert.equal(result.content.marker || result.content.insights.marker, 'once');
    assert.equal(result.content.rawHash, snapshot.hash);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].options.enableHTML, false);
    assert.equal(seen[0].options.enableIndex, false);
    assert.equal(seen[0].options.enableNotification, false);
    assert.equal(seen[0].options.enableAI, true);
    assert.equal(seen[0].options.contentCheck, true);
    assert.equal(seen[0].noWiki, '1');
    assert.equal(seen[0].noPush, '1');
    assert.ok(seen[0].dataDir.startsWith(roots.isolatedRoot));
    assert.ok(seen[0].outDir.startsWith(roots.isolatedRoot));
    assert.equal(fs.readFileSync(kept).equals(before), true);
    assert.equal(
      fs.existsSync(path.join(roots.formalDataDir, 'briefs', 'weekly', 'data-weekly-2026-W43.json')),
      false
    );
    assert.equal(
      fs.readFileSync(path.join(roots.isolatedRoot, 'data', 'briefs', 'daily', 'data-2026-10-19.json'), 'utf8').includes('keep'),
      true
    );
    assert.equal(process.env.REPORT_DATA_DIR, prevData);
    assert.equal(process.env.REPORT_OUT_DIR, prevOut);
    assert.equal(process.env.REPORT_NO_WIKI, prevWiki);
    fs.rmSync(roots.root, { recursive: true, force: true });
  });

  it('直接 triggerManual 周报不能绕过准入', async () => {
    const { createWorkflow } = require('../../src/scraper/complete-workflow');
    const workflow = createWorkflow({
      enableScheduler: false,
      enableAI: false,
      enableHTML: true,
      enableIndex: true,
      enableNotification: true,
      contentCheck: false,
    });
    const result = await workflow.triggerManual('weekly');
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'WEEKLY_ADMISSION_REQUIRED');
    await assert.rejects(
      () => workflow.executePipeline({ repositories: [{ fullName: 'acme/widget' }] }, 'weekly'),
      (error) => error.code === 'WEEKLY_ADMISSION_REQUIRED'
    );
  });

  it('命令行只调用一次准入，缺数据不会重跑正式流程', async () => {
    const args = buildWeeklyAdmissionArgs(['--no-push', '--week-start', '2026-11-02'], {
      WEEKLY_RAW_WAIT_MS: '180000',
      REPORT_NO_PUSH: '1',
      REPORT_NO_WIKI: '1',
    });
    assert.equal(args.weekStart, '2026-11-02');
    assert.equal(args.noPush, true);
    assert.equal(args.enableNotification, false);
    assert.equal(args.enableWiki, false);
    assert.equal(args.enableIndex, true);
    assert.equal(args.waitMs, 180000);
    const dataDir = path.join(os.tmpdir(), 'weekly-data-example');
    const reportsDir = path.join(os.tmpdir(), 'weekly-out-example');
    const wikiBase = path.join(os.tmpdir(), 'weekly-wiki-example');
    const custom = buildWeeklyAdmissionArgs(['--week-start', '2026-11-02'], {
      REPORT_DATA_DIR: dataDir,
      REPORT_OUT_DIR: reportsDir,
      WIKI_TRENDING_BASE: wikiBase,
      REPORT_NO_WIKI: '1',
    });
    assert.equal(custom.formalDataDir, path.resolve(dataDir));
    assert.equal(custom.formalReportsDir, path.resolve(reportsDir));
    assert.equal(custom.wikiBase, wikiBase);
    assert.equal(custom.noPush, false);
    assert.equal(exitCodeFor({ success: true, code: 'PUBLISHED' }), 0);
    assert.equal(exitCodeFor({ success: true, code: 'ALREADY_PUBLISHED' }), 0);
    assert.equal(exitCodeFor({ success: false, code: 'RAW_MISSING' }), 2);
    assert.equal(exitCodeFor({ success: false, code: 'PERIOD_MISMATCH' }), 2);
    assert.equal(exitCodeFor({ success: false, code: 'CONTENT_CHECK_FAILED' }), 3);
    assert.equal(exitCodeFor({ success: false, code: 'ALREADY_RUNNING' }), 4);
    assert.equal(exitCodeFor({ success: false, code: 'INPUT_CHANGED' }), 5);

    let calls = 0;
    const code = await runCli(['--no-push', '--week-start', '2026-11-02'], {
      runWeeklyAdmission: async () => {
        calls += 1;
        return { success: false, code: 'RAW_NOT_READY' };
      },
    });
    assert.equal(calls, 1);
    assert.equal(code, 2);
  });
});
