/**
 * 调度器测试脚本
 * 用于验证定时任务调度器的基本功能
 */

require('dotenv').config();
const { 
  ScraperScheduler, 
  RetryHandler,
  DailyScraper, 
  WeeklyScraper, 
  MonthlyScraper 
} = require('../../src/scraper');
const logger = require('../../src/utils/logger');

// 启用调度器（用于测试）
process.env.SCHEDULER_ENABLED = 'true';

logger.title('开始测试定时任务调度器');

// 创建重试处理器
const retryHandler = new RetryHandler({
  maxRetries: 12,
  retryInterval: 5 * 60 * 1000 // 5 分钟
});

// 创建抓取器实例
const scrapers = {
  daily: new DailyScraper(),
  weekly: new WeeklyScraper(),
  monthly: new MonthlyScraper()
};

// 创建调度器
const scheduler = new ScraperScheduler({
  scrapers,
  retryHandler,
  enabled: true
});

// 设置回调函数
scheduler.onScraperSuccess((data, type) => {
  logger.success(`[测试] 收到抓取成功回调`, { type, hasData: !!data });
});

scheduler.onScraperFailure((error, type) => {
  logger.error(`[测试] 收到抓取失败回调`, { type, error: error.message });
});

scheduler.triggerReportGeneration((type, data) => {
  logger.info(`[测试] 触发报告生成`, { type, dataKeys: data ? Object.keys(data) : [] });
});

// 测试功能
async function runTests() {
  logger.title('测试 1: 获取调度器状态（启动前）');
  const statusBefore = scheduler.getStatus();
  console.log(JSON.stringify(statusBefore, null, 2));

  logger.title('测试 2: 启动调度器');
  const started = scheduler.start();
  console.log('启动结果:', started);

  logger.title('测试 3: 获取调度器状态（启动后）');
  const statusAfter = scheduler.getStatus();
  console.log(JSON.stringify(statusAfter, null, 2));

  // 如果启用了手动测试，执行所有任务
  if (process.env.RUN_MANUAL_TEST === 'true') {
    logger.title('测试 4: 手动触发所有任务');
    const results = await scheduler.executeAll();
    console.log('执行结果:', JSON.stringify(results, null, 2));
  } else {
    logger.info('跳过手动执行测试（设置 RUN_MANUAL_TEST=true 以启用）');
  }

  // 测试单独触发某个任务
  if (process.env.RUN_SINGLE_TEST === 'true') {
    logger.title('测试 5: 手动触发日报任务');
    const dailyResult = await scheduler.triggerManual('daily');
    console.log('日报结果:', dailyResult ? '成功' : '失败');
  }

  // 等待一段时间后停止
  logger.info('等待 5 秒后停止调度器...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  logger.title('测试 6: 停止调度器');
  scheduler.stop();

  logger.title('测试 7: 获取调度器状态（停止后）');
  const statusAfterStop = scheduler.getStatus();
  console.log(JSON.stringify(statusAfterStop, null, 2));

  logger.success('所有测试完成');
  
  // 销毁调度器
  scheduler.destroy();
}

// 运行测试
runTests().catch(error => {
  logger.error('测试执行失败', { error: error.message, stack: error.stack });
  process.exit(1);
});
