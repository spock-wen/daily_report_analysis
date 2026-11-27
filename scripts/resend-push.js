#!/usr/bin/env node

/**
 * 安全补推入口：只发 WeLink，不写页，不发飞书。
 *
 * 用法:
 *   node scripts/resend-push.js daily 2026-11-26
 *   node scripts/resend-push.js daily 2026-11-26 --dry-run
 *   node scripts/resend-push.js daily 2026-11-26 --send
 *   node scripts/resend-push.js weekly 2026-W16 --dry-run
 */

'use strict';

const logger = require('../src/utils/logger');
const { parseArgs, helpText, resendWeLinkOnly } = require('../src/notifier/resend-welink');

async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    logger.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (args.help || !args.reportType || !args.reportId) {
    console.log(helpText());
    process.exitCode = 0;
    return;
  }

  try {
    const result = await resendWeLinkOnly({
      reportType: args.reportType,
      reportId: args.reportId,
      send: args.send
    });

    if (result.dryRun) {
      logger.info('干跑完成，未发送 WeLink / 飞书，未写页');
      logger.info(`计划推送链接: ${result.plan.reportUrl}`);
      logger.info('FEISHU_CALLED=no');
      logger.info('要实际补推请加 --send');
      process.exitCode = 0;
      return;
    }

    const summary = result.summary;
    logger.info(`WELINK_OK=${summary.WELINK_OK}`);
    for (const line of summary.groups) {
      logger.info(line);
    }
    logger.info('FEISHU_CALLED=no');

    if (result.success) {
      logger.success('两个群均返回成功且有回执');
      process.exitCode = 0;
      return;
    }

    logger.error(`补推未成功：${summary.reason || '回执未齐'}`);
    process.exitCode = 1;
  } catch (error) {
    logger.error(`补推失败：${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
