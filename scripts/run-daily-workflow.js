/**
 * 日报完整工作流脚本
 * 执行抓取 → AI分析 → 生成HTML → 发送通知
 */

const { createWorkflow } = require('../src/scraper/complete-workflow');
const logger = require('../src/utils/logger');

async function runDailyWorkflow() {
  logger.info('============================================');
  logger.info('🚀 开始执行日报完整工作流');
  logger.info('============================================');

  try {
    // 创建工作流实例
    const workflow = createWorkflow({
      enableScheduler: false,  // 不启用定时调度
      enableAI: true,          // 启用 AI 分析
      enableHTML: true,        // 生成 HTML
      enableIndex: true,       // 更新首页
      enableNotification: false // 不发送通知（测试阶段）
    });

    // 执行日报抓取和报告生成
    const result = await workflow.triggerManual('daily');

    if (result.success) {
      logger.success('============================================');
      logger.success('✅ 日报工作流执行完成！');
      logger.success(`📄 报告路径: ${result.htmlPath || 'N/A'}`);
      logger.success(`⏱️ 耗时: ${result.duration || 'N/A'}`);
      logger.success('============================================');
    } else {
      logger.error('============================================');
      logger.error('❌ 日报工作流执行失败');
      logger.error(`错误: ${result.error}`);
      logger.error('============================================');
    }

    return result;
  } catch (error) {
    logger.error('============================================');
    logger.error('❌ 日报工作流执行失败');
    logger.error(`错误: ${error.message}`);
    logger.error('============================================');
    throw error;
  }
}

// 执行工作流
runDailyWorkflow()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
