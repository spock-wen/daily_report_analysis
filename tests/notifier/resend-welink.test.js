/**
 * 安全补推入口：只发 WeLink、不写页、不发飞书、链接用 .com、回执判成功
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, describe, before, after } = require('node:test');
const {
  parseArgs,
  resendWeLinkOnly,
  protectSender
} = require('../../src/notifier/resend-welink');

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'welink-resend-3a-'));
  const briefDir = path.join(root, 'data', 'briefs', 'daily');
  const reportDir = path.join(root, 'reports', 'daily');
  fs.mkdirSync(briefDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });
  const brief = {
    date: '2026-11-26',
    projects: [
      { name: 'owner/demo', todayStars: 12, stars: 100 },
      { name: 'owner/other', todayStars: 8, stars: 80 }
    ],
    aiInsights: { oneLiner: 'fixture insight' }
  };
  fs.writeFileSync(
    path.join(briefDir, 'data-2026-11-26.json'),
    JSON.stringify(brief, null, 2)
  );
  const reportPath = path.join(reportDir, 'github-ai-trending-2026-11-26.html');
  fs.writeFileSync(reportPath, '<html>already published</html>');
  const indexPath = path.join(root, 'reports', 'index.html');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, '<html>index</html>');
  return { root, reportPath, indexPath, briefPath: path.join(briefDir, 'data-2026-11-26.json') };
}

function fingerprint(filePath) {
  const stat = fs.statSync(filePath);
  return {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    sha: fs.readFileSync(filePath, 'utf8')
  };
}

function makeMockSender(welinkImpl) {
  const calls = { welink: 0, feishu: 0, all: 0, weeklyAll: 0, monthlyAll: 0, options: null };
  return {
    calls,
    generateNotificationContent(type, data) {
      return {
        type,
        title: `title-${type}`,
        top5: (data.projects || []).slice(0, 5),
        insight: data.aiInsights && data.aiInsights.oneLiner,
        summary: `${(data.projects || []).length} 个热门项目`,
        reportUrl: 'https://report.wenspock.site/daily/should-be-overridden.html',
        welink: '正文见 https://report.wenspock.site/daily/github-ai-trending-2026-11-26.html'
      };
    },
    async sendWeLink(options) {
      calls.welink += 1;
      calls.options = options;
      if (welinkImpl) return welinkImpl(options);
      return [
        { success: true, platform: 'welink', webhookIndex: 0, result: { code: 0 } },
        { success: true, platform: 'welink', webhookIndex: 1, result: { code: 0 } }
      ];
    },
    async sendFeishu() {
      calls.feishu += 1;
      return { success: true, platform: 'feishu' };
    },
    async sendAll() {
      calls.all += 1;
      return [];
    },
    async sendWeeklyAll() {
      calls.weeklyAll += 1;
      return {};
    },
    async sendMonthlyAll() {
      calls.monthlyAll += 1;
      return {};
    }
  };
}

describe('parseArgs', () => {
  test('默认为干跑，需显式 --send 才会真发', () => {
    const dry = parseArgs(['daily', '2026-11-26']);
    assert.strictEqual(dry.dryRun, true);
    assert.strictEqual(dry.send, false);
    const explicit = parseArgs(['daily', '2026-11-26', '--dry-run']);
    assert.strictEqual(explicit.dryRun, true);
    const send = parseArgs(['daily', '2026-11-26', '--send']);
    assert.strictEqual(send.send, true);
    assert.strictEqual(send.dryRun, false);
  });

  test('不能同时 --dry-run 与 --send', () => {
    assert.throws(() => parseArgs(['daily', '2026-11-26', '--dry-run', '--send']), /不能同时/);
  });
});

describe('resendWeLinkOnly', () => {
  let fixture;

  before(() => {
    fixture = makeFixtureRoot();
  });

  after(() => {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  test('干跑不调用 WeLink/飞书，链接用 .com，不写正式页', async () => {
    const sender = makeMockSender();
    const beforeReport = fingerprint(fixture.reportPath);
    const beforeIndex = fingerprint(fixture.indexPath);
    const writes = [];
    const fsImpl = {
      existsSync: fs.existsSync,
      readFileSync: fs.readFileSync,
      writeFileSync: (...args) => {
        writes.push(args[0]);
        return fs.writeFileSync(...args);
      }
    };

    const result = await resendWeLinkOnly({
      reportType: 'daily',
      reportId: '2026-11-26',
      send: false,
      cwd: fixture.root,
      fsImpl,
      env: { REPORT_BASE_URL: 'https://report.wenspock.site' },
      sender
    });

    assert.strictEqual(result.dryRun, true);
    assert.strictEqual(result.FEISHU_CALLED, 'no');
    assert.strictEqual(result.plan.WRITE_PAGE, 'no');
    assert.strictEqual(
      result.plan.reportUrl,
      'https://report.wenspock.com/daily/github-ai-trending-2026-11-26.html'
    );
    assert.ok(!JSON.stringify(result).includes('wenspock.site'));
    assert.strictEqual(sender.calls.welink, 0);
    assert.strictEqual(sender.calls.feishu, 0);
    assert.strictEqual(sender.calls.all, 0);
    assert.deepStrictEqual(writes, []);
    assert.deepStrictEqual(fingerprint(fixture.reportPath), beforeReport);
    assert.deepStrictEqual(fingerprint(fixture.indexPath), beforeIndex);
  });

  test('--send 两群成功回执才成功，且不发飞书、不写页', async () => {
    const sender = makeMockSender();
    const beforeReport = fingerprint(fixture.reportPath);
    const result = await resendWeLinkOnly({
      reportType: 'daily',
      reportId: '2026-11-26',
      send: true,
      cwd: fixture.root,
      fsImpl: fs,
      env: { REPORT_BASE_URL: 'https://report.wenspock.com' },
      sender
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary.WELINK_OK, '2/2');
    assert.strictEqual(result.FEISHU_CALLED, 'no');
    assert.strictEqual(sender.calls.welink, 1);
    assert.strictEqual(sender.calls.feishu, 0);
    assert.strictEqual(sender.calls.all, 0);
    assert.strictEqual(sender.calls.weeklyAll, 0);
    assert.strictEqual(sender.calls.monthlyAll, 0);
    assert.strictEqual(
      sender.calls.options.reportUrl,
      'https://report.wenspock.com/daily/github-ai-trending-2026-11-26.html'
    );
    assert.ok(!JSON.stringify(sender.calls.options).includes('wenspock.site'));
    assert.deepStrictEqual(fingerprint(fixture.reportPath), beforeReport);
  });

  test('两群 501 时失败，不把结果数组非空当成功', async () => {
    const sender = makeMockSender(() => ([
      {
        success: false,
        platform: 'welink',
        webhookIndex: 0,
        result: { success: false, result: { code: 501 }, error: 'WeLink return code: 501' }
      },
      {
        success: false,
        platform: 'welink',
        webhookIndex: 1,
        result: { success: false, result: { code: 501 }, error: 'WeLink return code: 501' }
      }
    ]));

    const result = await resendWeLinkOnly({
      reportType: 'daily',
      reportId: '2026-11-26',
      send: true,
      cwd: fixture.root,
      fsImpl: fs,
      env: {},
      sender
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.summary.WELINK_OK, '0/2');
    assert.strictEqual(!![1, 2], true);
  });

  test('入口会拦截 sendFeishu / sendAll', async () => {
    const sender = makeMockSender();
    const guarded = protectSender(sender);
    await assert.rejects(() => guarded.sendFeishu({}), /sendFeishu 被补推入口禁止调用/);
    await assert.rejects(() => guarded.sendAll({}), /sendAll 被补推入口禁止调用/);
    assert.strictEqual(sender.calls.feishu, 0);
    assert.strictEqual(sender.calls.all, 0);
  });

  test('REPORT_NO_PUSH 时拒绝 --send', async () => {
    const sender = makeMockSender();
    await assert.rejects(
      () => resendWeLinkOnly({
        reportType: 'daily',
        reportId: '2026-11-26',
        send: true,
        cwd: fixture.root,
        fsImpl: fs,
        env: { REPORT_NO_PUSH: '1' },
        sender
      }),
      /REPORT_NO_PUSH/
    );
    assert.strictEqual(sender.calls.welink, 0);
  });

  test('摘要与计划不含 webhook / token 明文', async () => {
    const sender = makeMockSender(() => ([
      {
        success: true,
        platform: 'welink',
        webhookIndex: 0,
        webhookUrl: 'https://example.invalid/webhook/SECRET_TOKEN',
        result: { code: 0 }
      },
      {
        success: true,
        platform: 'welink',
        webhookIndex: 1,
        webhookUrl: 'https://example.invalid/webhook/ANOTHER_SECRET',
        result: { code: 0 }
      }
    ]));

    const result = await resendWeLinkOnly({
      reportType: 'daily',
      reportId: '2026-11-26',
      send: true,
      cwd: fixture.root,
      fsImpl: fs,
      env: {},
      sender
    });

    const dumped = JSON.stringify({ plan: result.plan, summary: result.summary, verdict: result.verdict });
    assert.ok(!dumped.includes('SECRET_TOKEN'));
    assert.ok(!dumped.includes('ANOTHER_SECRET'));
    assert.ok(!dumped.includes('webhookUrl'));
    assert.strictEqual(result.success, true);
  });
});
