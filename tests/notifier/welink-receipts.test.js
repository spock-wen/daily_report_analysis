/**
 * WeLink 回执判据与报告链接解析
 */

'use strict';

const assert = require('assert');
const { test, describe } = require('node:test');
const {
  DEFAULT_REPORT_BASE_URL,
  resolveReportBaseUrl,
  buildReportUrl,
  rewriteSiteUrls,
  evaluateWeLinkReceipts,
  evaluatePipelineNotification
} = require('../../src/notifier/welink-receipts');

const okGroup = (index) => ({
  success: true,
  platform: 'welink',
  webhookIndex: index,
  result: { code: 0, message: 'ok' }
});

const fail501 = (index) => ({
  success: false,
  platform: 'welink',
  webhookIndex: index,
  result: { success: false, result: { code: 501, message: '无权限访问！' }, error: 'WeLink return code: 501' },
  error: 'WeLink return code: 501'
});

describe('resolveReportBaseUrl', () => {
  test('未设置时默认使用 .com', () => {
    const resolved = resolveReportBaseUrl(undefined);
    assert.strictEqual(resolved.baseUrl, DEFAULT_REPORT_BASE_URL);
    assert.strictEqual(resolved.baseUrl, 'https://report.wenspock.com');
    assert.strictEqual(resolved.rewritten, false);
  });

  test('写成 .site 时改写为 .com', () => {
    const resolved = resolveReportBaseUrl('https://report.wenspock.site');
    assert.strictEqual(resolved.baseUrl, 'https://report.wenspock.com');
    assert.strictEqual(resolved.rewritten, true);
  });

  test('已是 .com 时保持不变', () => {
    const resolved = resolveReportBaseUrl('https://report.wenspock.com/');
    assert.strictEqual(resolved.baseUrl, 'https://report.wenspock.com');
    assert.strictEqual(resolved.rewritten, false);
  });
});

describe('buildReportUrl / rewriteSiteUrls', () => {
  test('日报链接走 .com 且不含 .site', () => {
    const url = buildReportUrl('daily', '2026-11-26', 'https://report.wenspock.com');
    assert.strictEqual(
      url,
      'https://report.wenspock.com/daily/github-ai-trending-2026-11-26.html'
    );
    assert.ok(!url.includes('wenspock.site'));
  });

  test('重写正文里写死的 .site', () => {
    const text = rewriteSiteUrls(
      '看报告 https://report.wenspock.site/weekly/github-weekly-2026-W47.html'
    );
    assert.strictEqual(
      text,
      '看报告 https://report.wenspock.com/weekly/github-weekly-2026-W47.html'
    );
  });
});

describe('evaluateWeLinkReceipts', () => {
  test('两个群都成功且有 code=0 回执才算成功', () => {
    const verdict = evaluateWeLinkReceipts([okGroup(0), okGroup(1)]);
    assert.strictEqual(verdict.ok, true);
    assert.strictEqual(verdict.okCount, 2);
    assert.strictEqual(verdict.expectedGroupCount, 2);
    assert.ok(verdict.groups.every((group) => group.hasReceipt));
  });

  test('两个群都返回 501 时失败（11-26 假绿对照）', () => {
    const results = [fail501(0), fail501(1)];
    const verdict = evaluateWeLinkReceipts(results);
    assert.ok(results, '结果数组非空，正是流水线 notificationSent 会采信的形态');
    assert.strictEqual(!!results, true);
    assert.strictEqual(verdict.ok, false);
    assert.strictEqual(verdict.okCount, 0);
    assert.ok(verdict.groups.every((group) => group.hasReceipt));
    assert.ok(verdict.groups.every((group) => group.code === 501));
    assert.match(verdict.reason, /0\/2/);
  });

  test('一群成功一群失败不算成功', () => {
    const verdict = evaluateWeLinkReceipts([okGroup(0), fail501(1)]);
    assert.strictEqual(verdict.ok, false);
    assert.strictEqual(verdict.okCount, 1);
  });

  test('只有一群成功回执也不算成功', () => {
    const verdict = evaluateWeLinkReceipts([okGroup(0)]);
    assert.strictEqual(verdict.ok, false);
    assert.match(verdict.reason, /群数 1/);
  });

  test('无回执（网络错误）不算成功', () => {
    const verdict = evaluateWeLinkReceipts([
      { success: false, platform: 'welink', webhookIndex: 0, result: { success: false, error: 'Request failed' } },
      { success: false, platform: 'welink', webhookIndex: 1, result: { success: false, error: 'Request failed' } }
    ]);
    assert.strictEqual(verdict.ok, false);
    assert.ok(verdict.groups.every((group) => group.hasReceipt === false));
  });

  test('success=true 但没有服务端回执不算成功', () => {
    const verdict = evaluateWeLinkReceipts([
      { success: true, platform: 'welink', webhookIndex: 0 },
      { success: true, platform: 'welink', webhookIndex: 1 }
    ]);
    assert.strictEqual(verdict.ok, false);
  });

  test('不把流水线 notificationResults 非空当作成功', () => {
    const notificationResults = [fail501(0), fail501(1)];
    const falseGreen = !!notificationResults;
    const verdict = evaluatePipelineNotification(notificationResults);
    assert.strictEqual(falseGreen, true);
    assert.strictEqual(verdict.ok, false);
  });

  test('sendAll 扁平结果会忽略飞书项，只看两个 WeLink 群', () => {
    const verdict = evaluateWeLinkReceipts([
      { success: false, platform: 'feishu', error: '飞书通知已禁用' },
      okGroup(0),
      okGroup(1)
    ]);
    assert.strictEqual(verdict.ok, true);
    assert.strictEqual(verdict.groupCount, 2);
  });

  test('周报 { welink } 结构同样按两群回执判断', () => {
    const verdict = evaluateWeLinkReceipts({
      feishu: { success: false },
      welink: [okGroup(0), okGroup(1)],
      logs: ['ignored']
    });
    assert.strictEqual(verdict.ok, true);
  });

  test('空结果或跳过不是成功', () => {
    assert.strictEqual(evaluateWeLinkReceipts(null).ok, false);
    assert.strictEqual(evaluateWeLinkReceipts({ success: false, platform: 'welink', skipped: true }).ok, false);
  });
});
