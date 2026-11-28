/**
 * 真发路径日志不得回显 webhook / token（使用明显假 URL，不触达真实群）
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, describe, before, after, afterEach } = require('node:test');

const FAKE_WEBHOOK_1 = 'https://example.test/webhook/fake';
const FAKE_WEBHOOK_2 = 'https://example.test/webhook/fake-token-value';
const SECRET_MARKERS = [
  FAKE_WEBHOOK_1,
  FAKE_WEBHOOK_2,
  'example.test/webhook',
  'fake-token-value'
];

const originalFetch = globalThis.fetch;
const originalLog = console.log;
const originalWelinkEnabled = process.env.WELINK_ENABLED;
const originalWebhookUrls = process.env.WELINK_WEBHOOK_URLS;

async function blockedFetch() {
  throw new Error('unexpected real fetch in welink log tests (blocked)');
}

globalThis.fetch = blockedFetch;

function setFakeWebhookEnv() {
  process.env.WELINK_ENABLED = 'true';
  process.env.WELINK_WEBHOOK_URLS = `${FAKE_WEBHOOK_1},${FAKE_WEBHOOK_2}`;
}

function restoreEnv() {
  if (originalWelinkEnabled === undefined) delete process.env.WELINK_ENABLED;
  else process.env.WELINK_ENABLED = originalWelinkEnabled;
  if (originalWebhookUrls === undefined) delete process.env.WELINK_WEBHOOK_URLS;
  else process.env.WELINK_WEBHOOK_URLS = originalWebhookUrls;
}

function freshSender() {
  setFakeWebhookEnv();
  const senderPath = require.resolve('../../src/notifier/message-sender');
  delete require.cache[senderPath];
  const { getConfig } = require('../../src/utils/config');
  getConfig(true);
  const MessageSender = require('../../src/notifier/message-sender');
  return new MessageSender();
}

function mockFetchWithCode(code) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init && init.method });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code }),
      json: async () => ({ code })
    };
  };
  return calls;
}

async function captureLogs(fn) {
  const lines = [];
  console.log = (...args) => {
    lines.push(args.map((item) => (typeof item === 'string' ? item : String(item))).join(' '));
  };
  try {
    const result = await fn();
    return { result, logs: lines.join('\n') };
  } finally {
    console.log = originalLog;
  }
}

function assertNoSecrets(text, label) {
  for (const marker of SECRET_MARKERS) {
    assert.ok(
      !String(text).includes(marker),
      `${label} 不应包含 ${marker}`
    );
  }
}

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'welink-log-p1-'));
  const briefDir = path.join(root, 'data', 'briefs', 'daily');
  fs.mkdirSync(briefDir, { recursive: true });
  fs.writeFileSync(
    path.join(briefDir, 'data-2026-11-26.json'),
    JSON.stringify({
      date: '2026-11-26',
      projects: [{ name: 'owner/demo', todayStars: 12, stars: 100 }],
      aiInsights: { oneLiner: 'fixture insight' }
    })
  );
  return root;
}

describe('welink 真发日志不回显 webhook', { concurrency: false }, () => {

describe('logger 红行与旧 meta 对照', () => {
  const logger = require('../../src/utils/logger');

  test('旧行为：把 webhookUrl 放进 meta 后 JSON.stringify 会泄露假 URL', () => {
    const oldMeta = { webhookUrl: FAKE_WEBHOOK_1, token: 'fake-token-value' };
    const leaked = JSON.stringify(oldMeta);
    assert.ok(leaked.includes(FAKE_WEBHOOK_1));
    assert.ok(leaked.includes('fake-token-value'));
  });

  test('新行为：formatLog / logger.info 对同样 meta 不再回显 webhook 或 token', async () => {
    const oldMeta = { webhookUrl: FAKE_WEBHOOK_1, token: 'fake-token-value' };
    const formatted = logger.formatLog('INFO', 'WeLink 群组 1 推送成功', oldMeta);
    assertNoSecrets(formatted, 'formatLog');
    assert.ok(formatted.includes('[REDACTED]'));

    const { logs } = await captureLogs(() => {
      logger.info('WeLink 群组 1 推送成功', oldMeta);
    });
    assertNoSecrets(logs, 'logger.info');
    assert.ok(logs.includes('[REDACTED]'));
  });

  test('报告站 .com 链接不会被误红行', () => {
    const reportUrl = 'https://report.wenspock.com/daily/github-ai-trending-2026-11-26.html';
    const formatted = logger.formatLog('INFO', `计划推送链接: ${reportUrl}`, { reportUrl });
    assert.ok(formatted.includes(reportUrl));
  });
});

describe('MessageSender.sendWeLink 真发日志', { concurrency: false }, () => {
  afterEach(() => {
    globalThis.fetch = blockedFetch;
    console.log = originalLog;
  });

  after(() => {
    restoreEnv();
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  });

  test('模拟两群成功：捕获日志不含假 webhook，且仍按回执成功', async () => {
    const sender = freshSender();
    const fetchCalls = mockFetchWithCode(0);
    const { result, logs } = await captureLogs(() => sender.sendWeLink({
      type: 'daily',
      title: 'test-daily',
      content: 'hello'
    }));

    assert.strictEqual(fetchCalls.length, 2);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.every((item) => item.success === true), true);
    assert.ok(logs.includes('推送成功'));
    assertNoSecrets(logs, '成功路径日志');
    assert.ok(!logs.includes('webhookUrl'));
  });

  test('模拟两群失败：捕获日志不含假 webhook，失败路径可观测', async () => {
    const sender = freshSender();
    const fetchCalls = mockFetchWithCode(501);
    const { result, logs } = await captureLogs(() => sender.sendWeLink({
      type: 'daily',
      title: 'test-daily',
      content: 'hello'
    }));

    assert.strictEqual(fetchCalls.length, 2);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.every((item) => item.success === false), true);
    assert.ok(logs.includes('推送失败'));
    assertNoSecrets(logs, '失败路径日志');
    assert.ok(!logs.includes('webhookUrl'));
  });
});

describe('补推 --send 调用链（模拟 fetch，不真推）', { concurrency: false }, () => {
  let fixtureRoot;
  const { resendWeLinkOnly } = require('../../src/notifier/resend-welink');

  before(() => {
    fixtureRoot = makeFixtureRoot();
  });

  after(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    restoreEnv();
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  });

  afterEach(() => {
    globalThis.fetch = blockedFetch;
    console.log = originalLog;
  });

  test('成功路径：日志与摘要都不含假 webhook', async () => {
    const sender = freshSender();
    mockFetchWithCode(0);
    const { result, logs } = await captureLogs(() => resendWeLinkOnly({
      reportType: 'daily',
      reportId: '2026-11-26',
      send: true,
      cwd: fixtureRoot,
      fsImpl: fs,
      env: { REPORT_BASE_URL: 'https://report.wenspock.com' },
      sender
    }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary.WELINK_OK, '2/2');
    const dumped = `${logs}\n${JSON.stringify({
      plan: result.plan,
      summary: result.summary,
      verdict: result.verdict
    })}`;
    assertNoSecrets(dumped, '补推成功日志与摘要');
  });

  test('失败路径：日志与摘要都不含假 webhook', async () => {
    const sender = freshSender();
    mockFetchWithCode(501);
    const { result, logs } = await captureLogs(() => resendWeLinkOnly({
      reportType: 'daily',
      reportId: '2026-11-26',
      send: true,
      cwd: fixtureRoot,
      fsImpl: fs,
      env: { REPORT_BASE_URL: 'https://report.wenspock.com' },
      sender
    }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.summary.WELINK_OK, '0/2');
    const dumped = `${logs}\n${JSON.stringify({
      plan: result.plan,
      summary: result.summary,
      verdict: result.verdict
    })}`;
    assertNoSecrets(dumped, '补推失败日志与摘要');
  });
});
});
