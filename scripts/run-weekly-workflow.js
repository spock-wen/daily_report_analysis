/**
 * 周报完整工作流脚本
 * 执行抓取 → AI分析 → 生成HTML → 发送通知
 * 支持失败自动重试
 * 
 * 用法：
 *   node scripts/run-weekly-workflow.js           # 正常执行（含推送）
 *   node scripts/run-weekly-workflow.js --no-push # 不发送推送通知
 */

const { createWorkflow } = require('../src/scraper/complete-workflow');
const logger = require('../src/utils/logger');

// 解析命令行参数
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');

// 重试配置
const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

async function runWeeklyWorkflow() {
  logger.info('============================================');
  logger.info('🚀 开始执行周报完整工作流');
  if (noPush) {
    logger.info('📢 已禁用推送通知 (--no-push)');
  }
  logger.info('============================================');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      logger.info(`\n⏳ 第 ${attempt}/${MAX_RETRIES} 次重试...`);
    }

    try {
      // 创建工作流实例
      const workflow = createWorkflow({
        enableScheduler: false,  // 不启用定时调度
        enableAI: true,          // 启用 AI 分析
        enableHTML: true,        // 生成 HTML
        enableIndex: true,       // 更新首页
        enableNotification: !noPush  // 根据参数决定是否发送通知
      });

      // 执行周报抓取和报告生成
      const result = await workflow.triggerManual('weekly');

      if (result.success) {
        logger.success('============================================');
        logger.success('✅ 周报工作流执行完成！');
        logger.success(`📄 报告路径: ${result.htmlPath || 'N/A'}`);
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

  // 所有重试都失败
  logger.error('============================================');
  logger.error(`❌ 周报工作流执行失败，已重试 ${MAX_RETRIES} 次`);
  logger.error('============================================');
  return { success: false, error: `重试 ${MAX_RETRIES} 次后仍失败` };
}

// 执行工作流
runWeeklyWorkflow()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });