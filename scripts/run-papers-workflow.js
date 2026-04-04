/**
 * HuggingFace Papers 报告完整工作流脚本
 * 执行：下载 → 清洗 → AI分析 → 生成HTML → 发送通知
 *
 * 用法：
 *   node scripts/run-papers-workflow.js            # 正常执行（含推送）
 *   node scripts/run-papers-workflow.js --no-push  # 不发送推送通知
 */

const { downloadLatestPapers } = require('../src/scraper/paper-downloader');
const PapersScraper = require('../src/scraper/strategies/papers-scraper');
const PaperAnalyzer = require('../src/analyzer/paper-analyzer');
const PaperHtmlGenerator = require('../src/generator/paper-html-generator');
const PaperNotification = require('../src/notifier/paper-notification');
const { writeJson } = require('../src/utils/fs');
const logger = require('../src/utils/logger');
const { getConfig } = require('../src/utils/config');

// 解析命令行参数
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');

// 重试配置
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

async function runPapersWorkflow() {
  logger.info('============================================');
  logger.info('🚀 开始执行 HuggingFace Papers 报告工作流');
  if (noPush) {
    logger.info('📢 已禁用推送通知 (--no-push)');
  }
  logger.info('============================================');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      logger.info(`\n⏳ 第 ${attempt}/${MAX_RETRIES} 次重试...`);
    }

    try {
      const result = await executeWorkflow(noPush);

      if (result.success) {
        logger.success('============================================');
        logger.success('✅ HuggingFace Papers 工作流执行完成！');
        logger.success(`📄 HTML 路径: ${result.htmlPath || 'N/A'}`);
        logger.success(`⏱️ 耗时: ${result.duration || 'N/A'}`);
        if (attempt > 1) {
          logger.success(`🔄 重试次数: ${attempt - 1}`);
        }
        logger.success('============================================');
        return result;
      } else {
        logger.error(`❌ 第 ${attempt} 次尝试失败: ${result.error}`);

        if (attempt < MAX_RETRIES) {
          logger.info(`⏳ 等待 ${RETRY_INTERVAL_MS / 60000} 分钟后重试...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
        }
      }
    } catch (error) {
      logger.error(`❌ 第 ${attempt} 次尝试异常: ${error.message}`);

      if (attempt < MAX_RETRIES) {
        logger.info(`⏳ 等待 ${RETRY_INTERVAL_MS / 60000} 分钟后重试...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
      } else {
        throw error;
      }
    }
  }

  logger.error('============================================');
  logger.error(`❌ HuggingFace Papers 工作流执行失败，已重试 ${MAX_RETRIES} 次`);
  logger.error('============================================');
  return { success: false, error: `重试 ${MAX_RETRIES} 次后仍失败` };
}

async function executeWorkflow(disablePush) {
  const startTime = Date.now();

  // 步骤 1: 下载 latest.json
  logger.info('[Workflow] 步骤 1/5: 下载 latest.json...');
  const downloaded = await downloadLatestPapers();

  logger.success('[Workflow] 下载完成', {
    total: downloaded.papers.length,
    date: downloaded.downloadedDate
  });

  // 步骤 2: 保存完整数据（所有论文）
  logger.info('[Workflow] 步骤 2/5: 保存完整数据...');
  const scraper = new PapersScraper({ minStars: 10 });
  const filteredPapers = downloaded.papers.filter(p => p.stars >= scraper.minStars);

  const dataPath = scraper.getOutputPath(process.cwd(), new Date(downloaded.downloadedDate));
  await writeJson(dataPath, {
    scrapedAt: downloaded.downloadedAt,
    date: downloaded.downloadedDate,
    papers: downloaded.papers,
    stats: {
      totalCount: downloaded.papers.length,
      filteredCount: filteredPapers.length,
      minStars: scraper.minStars
    }
  });

  logger.success('[Workflow] 数据已保存', { path: dataPath });

  // 步骤 3: AI 分析
  logger.info('[Workflow] 步骤 3/5: AI 分析...');
  const analyzer = new PaperAnalyzer();
  const aiInsights = await analyzer.analyze({
    date: downloaded.downloadedDate,
    papers: downloaded.papers
  });

  logger.success('[Workflow] AI 分析完成', {
    oneLiner: aiInsights.oneLiner || 'N/A'
  });

  // 步骤 4: 生成 HTML
  logger.info('[Workflow] 步骤 4/5: 生成 HTML 报告...');
  const generator = new PaperHtmlGenerator();
  const htmlPath = await generator.generate({
    date: downloaded.downloadedDate,
    papers: downloaded.papers,
    aiInsights
  });

  logger.success('[Workflow] HTML 已生成', { path: htmlPath });

  // 步骤 5: 发送通知
  const notificationResults = [];
  if (!disablePush) {
    logger.info('[Workflow] 步骤 5/5: 发送通知...');
    const notifier = new PaperNotification();
    const config = getConfig();
    const baseUrl = config.report?.baseUrl || 'https://report.wenspock.site';
    const dateObj = new Date(downloaded.downloadedDate);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const reportUrl = `${baseUrl}/reports/papers/daily/papers-${year}-${month}-${day}.html`;

    notificationResults.push({
      type: 'feishu',
      result: await notifier.sendFeishu({
        date: downloaded.downloadedDate,
        papers: downloaded.papers,
        filteredPapers,
        aiInsights,
        reportUrl
      })
    });

    notificationResults.push({
      type: 'welink',
      result: await notifier.sendWeLink({
        date: downloaded.downloadedDate,
        filteredPapers,
        aiInsights,
        reportUrl,
        minStars: 10
      })
    });

    logger.success('[Workflow] 通知已发送');
  } else {
    logger.info('[Workflow] 步骤 5/5: 跳过通知 (--no-push)');
  }

  return {
    success: true,
    date: downloaded.downloadedDate,
    htmlPath,
    duration: Date.now() - startTime,
    notificationResults,
    papersCount: downloaded.papers.length,
    filteredCount: filteredPapers.length
  };
}

// 执行工作流
runPapersWorkflow()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

module.exports = { runPapersWorkflow, executeWorkflow };
