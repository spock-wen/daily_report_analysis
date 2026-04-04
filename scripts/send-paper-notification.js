#!/usr/bin/env node
/**
 * 重新发送论文报告推送通知
 * 利用已有的数据，只发送通知
 */

const PapersScraper = require('../src/scraper/strategies/papers-scraper');
const PaperNotification = require('../src/notifier/paper-notification');
const { readJson } = require('../src/utils/fs');
const logger = require('../src/utils/logger');
const { getConfig } = require('../src/utils/config');
const { getPaperDataPath, getPaperInsightsPath } = require('../src/utils/path');

async function sendNotification() {
  logger.info('============================================');
  logger.info('🚀 重新发送论文报告推送通知');
  logger.info('============================================');

  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];

  try {
    // 加载数据
    logger.info('📦 加载已有数据...');
    const papersPath = getPaperDataPath(dateStr);
    const insightsPath = getPaperInsightsPath(dateStr);

    const papersData = await readJson(papersPath);
    const aiInsights = await readJson(insightsPath);

    logger.success(`✅ 数据加载成功`, {
      papersCount: papersData.papers.length,
      insights: !!aiInsights
    });

    // 过滤论文（Stars >= 10）
    const filteredPapers = papersData.papers.filter(p => p.stars >= 10);

    // 构建报告 URL
    const config = getConfig();
    const baseUrl = config.report?.baseUrl || 'https://report.wenspock.site';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const reportUrl = `${baseUrl}/papers/daily/papers-${year}-${month}-${day}.html`;

    logger.info(`📄 报告 URL: ${reportUrl}`);

    // 发送通知
    const notifier = new PaperNotification();
    const notificationResults = [];

    logger.info('📢 发送飞书通知...');
    notificationResults.push({
      type: 'feishu',
      result: await notifier.sendFeishu({
        date: dateStr,
        papers: papersData.papers,
        filteredPapers,
        aiInsights,
        reportUrl
      })
    });

    logger.info('📢 发送 WeLink 通知...');
    notificationResults.push({
      type: 'welink',
      result: await notifier.sendWeLink({
        date: dateStr,
        filteredPapers,
        aiInsights,
        reportUrl,
        minStars: 10
      })
    });

    // 统计结果
    const successCount = notificationResults.filter(r => 
      (Array.isArray(r.result) ? r.result.some(x => x.success) : r.result.success)
    ).length;

    logger.info('============================================');
    if (successCount > 0) {
      logger.success(`✅ 推送通知发送成功！成功 ${successCount}/${notificationResults.length} 个`);
    } else {
      logger.error(`❌ 推送通知发送失败`);
    }
    logger.info('============================================');

    return notificationResults;

  } catch (error) {
    logger.error(`❌ 发送失败: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
}

sendNotification()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
