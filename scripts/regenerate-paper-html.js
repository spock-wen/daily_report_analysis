#!/usr/bin/env node
/**
 * 重新生成论文日报 HTML
 */

const PaperHtmlGenerator = require('../src/generator/paper-html-generator');
const { readJson } = require('../src/utils/fs');
const logger = require('../src/utils/logger');
const { getPaperDataPath, getPaperInsightsPath } = require('../src/utils/path');

async function regenerateHtml() {
  logger.info('===========================================');
  logger.info('🚀 重新生成论文日报 HTML');
  logger.info('===========================================');

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

    // 生成 HTML
    logger.info('📄 生成 HTML 报告...');
    const generator = new PaperHtmlGenerator();
    const filePath = await generator.generate({
      date: dateStr,
      papers: papersData.papers,
      aiInsights
    });

    logger.success(`✅ HTML 报告已重新生成: ${filePath}`);
    logger.info('===========================================');

  } catch (error) {
    logger.error(`❌ 重新生成失败: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
}

regenerateHtml()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
