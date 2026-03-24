/**
 * 月报完整工作流脚本
 * 执行数据聚合 → AI 分析 → HTML 生成 → 发送通知
 * 支持失败自动重试
 *
 * 使用方法：
 *   node scripts/run-monthly-workflow.js 2026-03           # 正常执行（含推送）
 *   node scripts/run-monthly-workflow.js 2026-03 --no-push # 不发送推送通知
 */

const path = require('path');
const logger = require('../src/utils/logger');
const { createWorkflow } = require('../src/scraper/complete-workflow');
const { MonthlyAggregator } = require('../src/scraper/aggregators');
const MonthlyAnalyzer = require('../src/analyzer/monthly-analyzer');
const MonthlyGenerator = require('../src/generator/monthly-generator');

// 解析命令行参数
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');

// 重试配置
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

async function runMonthlyWorkflow(month) {
  if (!month) {
    console.error('❌ 请指定月份参数，格式：YYYY-MM');
    console.error('示例：node scripts/run-monthly-workflow.js 2026-03');
    process.exit(1);
  }

  logger.info('============================================');
  logger.info('🚀 开始执行月报完整工作流');
  if (noPush) {
    logger.info('📢 已禁用推送通知 (--no-push)');
  }
  logger.info('============================================', { month });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      logger.info(`\n⏳ 第 ${attempt}/${MAX_RETRIES} 次重试...`);
    }

    try {
      // Step 1: 数据聚合
      logger.section('📊 步骤 1: 数据聚合');
      const aggregator = new MonthlyAggregator();
      const monthlyData = await aggregator.aggregate(month);

      logger.info('数据聚合完成', {
        totalDays: monthlyData.dailyDataList.length,
        totalWeeks: monthlyData.weeklyDataList.length,
        totalProjects: monthlyData.aggregation.totalProjects
      });

      // Step 2: AI 分析
      logger.section('🤖 步骤 2: AI 分析');
      const analyzer = new MonthlyAnalyzer();
      const aiInsights = await analyzer.analyze(monthlyData);

      // 合并 AI 分析结果到月度数据
      monthlyData.aiInsights = aiInsights;

      logger.info('AI 分析完成', {
        hasTheme: !!aiInsights.monthlyTheme,
        topProjectsCount: aiInsights.longTermValue?.length || 0
      });

      // Step 3: HTML 生成（使用完整工作流的配置）
      logger.section('📄 步骤 3: HTML 生成');

      // 创建工作流实例（支持通知等功能）
      const workflow = createWorkflow({
        enableScheduler: false,  // 不启用定时调度
        enableAI: true,          // 启用 AI 分析
        enableHTML: true,        // 生成 HTML
        enableIndex: true,       // 更新首页
        enableNotification: !noPush  // 根据参数决定是否发送通知
      });

      // 使用工作流生成 HTML（包含通知功能）
      const result = await workflow.triggerManual('monthly', { monthlyData });

      if (result.success) {
        logger.success('============================================');
        logger.success('✅ 月报工作流执行完成！');
        logger.success(`📄 报告路径：${result.htmlPath || 'N/A'}`);
        logger.success(`⏱️ 耗时：${result.duration || 'N/A'}`);
        if (attempt > 1) {
          logger.success(`🔄 重试次数：${attempt - 1}`);
        }
        logger.success('============================================');

        // 输出摘要
        console.log('\n' + '='.repeat(60));
        console.log('  月报生成摘要');
        console.log('='.repeat(60));
        console.log(`  月份：${month}`);
        console.log(`  数据来源：${monthlyData.dailyDataList.length} 天日报 + ${monthlyData.weeklyDataList.length} 周周报`);
        console.log(`  总项目数（去重）：${monthlyData.aggregation.totalProjects}`);
        console.log(`  重复上榜项目：${monthlyData.aggregation.recurringProjects?.length || 0} 个`);
        console.log(`  本月新星：${monthlyData.aggregation.newProjects?.length || 0} 个`);
        console.log(`  报告文件：${path.basename(result.htmlPath)}`);
        console.log('='.repeat(60) + '\n');

        return result;
      } else {
        logger.error(`❌ 第 ${attempt} 次尝试失败：${result.error}`);

        if (attempt < MAX_RETRIES) {
          logger.info(`⏳ 等待 ${RETRY_INTERVAL_MS / 60000} 分钟后重试...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
        } else {
          throw new Error(result.error);
        }
      }
    } catch (error) {
      logger.error(`❌ 第 ${attempt} 次尝试异常：${error.message}`);

      if (attempt < MAX_RETRIES) {
        logger.info(`⏳ 等待 ${RETRY_INTERVAL_MS / 60000} 分钟后重试...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
      } else {
        throw error;
      }
    }
  }

  // 所有重试都失败
  logger.error('============================================');
  logger.error(`❌ 月报工作流执行失败，已重试 ${MAX_RETRIES} 次`);
  logger.error('============================================');
  return { success: false, error: `重试 ${MAX_RETRIES} 次后仍失败` };
}

// 命令行执行
if (require.main === module) {
  const month = process.argv[2];
  runMonthlyWorkflow(month)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runMonthlyWorkflow };
