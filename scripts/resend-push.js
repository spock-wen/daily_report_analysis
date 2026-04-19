#!/usr/bin/env node

/**
 * 重新发送推送通知脚本
 *
 * 用法:
 *   node scripts/resend-push.js daily 2026-04-15
 *   node scripts/resend-push.js weekly 2026-W16
 *   node scripts/resend-push.js monthly 2026-03
 *   node scripts/resend-push.js papers 2026-04-01
 */

const path = require('path');
const logger = require('../src/utils/logger');

// 命令行参数
const args = process.argv.slice(2);
const reportType = args[0];
const reportId = args[1];
const shouldHelp = args.includes('--help') || args.includes('-h');

if (shouldHelp || !reportType || !reportId) {
  console.log(`
重新发送推送通知脚本

用法:
  node scripts/resend-push.js <type> <id>

参数:
  type      报告类型：daily, weekly, monthly, papers
  id        报告标识：
            - daily:   日期格式 YYYY-MM-DD (如 2026-04-15)
            - weekly:  周数格式 YYYY-Www (如 2026-W16)
            - monthly: 月份格式 YYYY-MM (如 2026-03)
            - papers:  日期格式 YYYY-MM-DD (如 2026-04-01)

示例:
  node scripts/resend-push.js daily 2026-04-15
  node scripts/resend-push.js weekly 2026-W16
  node scripts/resend-push.js monthly 2026-03
  node scripts/resend-push.js papers 2026-04-01
`);
  process.exit(0);
}

/**
 * 发送推送通知
 */
async function resendPush(reportType, reportId) {
  logger.info(`\n=== 重新发送推送通知：${reportType} ${reportId} ===\n`);

  try {
    const MessageSender = require('../src/notifier/message-sender');
    const sender = new MessageSender();

    // 构建报告 URL
    let reportUrl;
    const baseUrl = 'https://report.wenspock.site';

    switch (reportType) {
      case 'daily':
        reportUrl = `${baseUrl}/daily/github-ai-trending-${reportId}.html`;
        break;
      case 'weekly':
        reportUrl = `${baseUrl}/weekly/github-weekly-${reportId}.html`;
        break;
      case 'monthly':
        reportUrl = `${baseUrl}/monthly/github-monthly-${reportId}.html`;
        break;
      case 'papers':
        reportUrl = `${baseUrl}/papers/papers-${reportId}.html`;
        break;
      default:
        throw new Error(`未知的报告类型：${reportType}`);
    }

    logger.info(`推送 URL: ${reportUrl}`);

    // 发送通知
    const result = await sender.sendFeishu({
      type: reportType,
      title: `GitHub ${reportType === 'daily' ? '日报' : reportType === 'weekly' ? '周报' : reportType === 'monthly' ? '月报' : '论文'}报告`,
      reportUrl: reportUrl
    });

    if (result.success) {
      logger.success('\n✅ 推送通知已发送\n');
    } else {
      logger.error('\n❌ 推送发送失败:', result.error);
      process.exit(1);
    }

  } catch (error) {
    logger.error(`❌ 推送发送失败：${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

resendPush(reportType, reportId);
