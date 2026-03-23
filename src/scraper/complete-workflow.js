/**
 * CompleteWorkflow - 完整工作流集成器
 * 整合 ScraperScheduler 和 ReportPipeline，实现从抓取到推送的端到端流程
 * 
 * 功能：
 * - 统一管理抓取和报告生成流程
 * - 提供统一的入口函数
 * - 支持手动触发和自动调度
 * - 完整的错误处理和日志记录
 */

const logger = require('../utils/logger');
const ScraperScheduler = require('./scheduler');
const ReportPipeline = require('./report-pipeline');
const RetryHandler = require('./retry-handler');

// 导入抓取器
const DailyScraper = require('./strategies/daily-scraper');
const WeeklyScraper = require('./strategies/weekly-scraper');
const MonthlyScraper = require('./strategies/monthly-scraper');

/**
 * 完整工作流类
 */
class CompleteWorkflow {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {boolean} options.enableScheduler - 是否启用定时调度（默认 false）
   * @param {boolean} options.enableAI - 是否启用 AI 分析（默认 true）
   * @param {boolean} options.enableHTML - 是否生成 HTML（默认 true）
   * @param {boolean} options.enableIndex - 是否更新首页（默认 true）
   * @param {boolean} options.enableNotification - 是否发送通知（默认 true）
   * @param {boolean} options.autoStart - 是否自动启动（默认 false）
   */
  constructor(options = {}) {
    this.options = {
      enableScheduler: options.enableScheduler || false,
      enableAI: options.enableAI !== undefined ? options.enableAI : true,
      enableHTML: options.enableHTML !== undefined ? options.enableHTML : true,
      enableIndex: options.enableIndex !== undefined ? options.enableIndex : true,
      enableNotification: options.enableNotification !== undefined ? options.enableNotification : true,
      autoStart: options.autoStart || false
    };
    
    logger.info('[CompleteWorkflow] 初始化完整工作流...', this.options);
    
    // 初始化抓取器
    this.scrapers = {
      daily: new DailyScraper(),
      weekly: new WeeklyScraper(),
      monthly: new MonthlyScraper()
    };
    
    // 初始化重试处理器
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      retryDelay: 5 * 60 * 1000 // 5 分钟
    });
    
    // 初始化调度器
    this.scheduler = new ScraperScheduler({
      scrapers: this.scrapers,
      retryHandler: this.retryHandler,
      enabled: this.options.enableScheduler
    });
    
    // 初始化报告流水线
    this.pipeline = new ReportPipeline({
      enableAI: this.options.enableAI,
      enableHTML: this.options.enableHTML,
      enableIndex: this.options.enableIndex,
      enableNotification: this.options.enableNotification
    });
    
    // 注册回调
    this.setupCallbacks();
    
    // 工作流状态
    this.isRunning = false;
    this.executionHistory = [];
    
    logger.success('[CompleteWorkflow] 完整工作流初始化完成');
  }

  /**
   * 设置回调函数
   * @private
   */
  setupCallbacks() {
    // 抓取成功回调：触发报告生成
    this.scheduler.onScraperSuccess((data, type) => {
      logger.info('[CompleteWorkflow] 抓取成功，准备生成报告', { type });
      // 报告生成由 scheduler 的 triggerReportGeneration 回调处理
    });
    
    // 抓取失败回调：记录日志
    this.scheduler.onScraperFailure((error, type) => {
      logger.error('[CompleteWorkflow] 抓取失败', { type, error: error.message });
    });
    
    // 报告生成触发器：执行报告流水线
    this.scheduler.triggerReportGeneration(async (type, data) => {
      logger.info('[CompleteWorkflow] 触发报告生成流程', { type });
      try {
        await this.executePipeline(data, type);
      } catch (error) {
        logger.error('[CompleteWorkflow] 报告生成失败', { type, error: error.message });
      }
    });
  }

  /**
   * 启动工作流
   * @returns {boolean} 启动是否成功
   */
  start() {
    logger.title('[CompleteWorkflow] 启动完整工作流');
    
    if (this.isRunning) {
      logger.warn('[CompleteWorkflow] 工作流已在运行中');
      return false;
    }
    
    try {
      // 如果启用了调度器，启动定时任务
      if (this.options.enableScheduler) {
        const schedulerStarted = this.scheduler.start();
        if (!schedulerStarted) {
          throw new Error('调度器启动失败');
        }
      } else {
        logger.info('[CompleteWorkflow] 调度器已禁用，仅支持手动触发');
      }
      
      this.isRunning = true;
      logger.success('[CompleteWorkflow] 工作流启动成功');
      
      return true;
    } catch (error) {
      logger.error('[CompleteWorkflow] 启动失败', { error: error.message });
      this.isRunning = false;
      return false;
    }
  }

  /**
   * 停止工作流
   */
  stop() {
    logger.title('[CompleteWorkflow] 停止完整工作流');
    
    if (!this.isRunning) {
      logger.warn('[CompleteWorkflow] 工作流未运行');
      return;
    }
    
    try {
      // 停止调度器
      if (this.options.enableScheduler) {
        this.scheduler.stop();
      }
      
      this.isRunning = false;
      logger.success('[CompleteWorkflow] 工作流已停止');
    } catch (error) {
      logger.error('[CompleteWorkflow] 停止失败', { error: error.message });
    }
  }

  /**
   * 执行报告生成流水线
   * @param {Object} data - 抓取到的数据
   * @param {string} type - 报告类型
   * @returns {Promise<Object>} 执行结果
   */
  async executePipeline(data, type) {
    const executionId = `${type}-${Date.now()}`;
    logger.info('[CompleteWorkflow] 开始执行报告流水线', { type, executionId });
    
    const startTime = Date.now();
    const executionRecord = {
      id: executionId,
      type,
      startTime,
      endTime: null,
      status: 'running',
      result: null
    };
    
    try {
      // 执行流水线
      const result = await this.pipeline.execute(data, type);
      
      // 记录执行历史
      executionRecord.endTime = Date.now();
      executionRecord.status = 'success';
      executionRecord.result = result;
      this.executionHistory.push(executionRecord);
      
      logger.success('[CompleteWorkflow] 报告流水线执行成功', {
        type,
        executionId,
        duration: `${executionRecord.endTime - startTime}ms`
      });
      
      return result;
    } catch (error) {
      // 记录执行失败
      executionRecord.endTime = Date.now();
      executionRecord.status = 'failed';
      executionRecord.error = error.message;
      this.executionHistory.push(executionRecord);
      
      logger.error('[CompleteWorkflow] 报告流水线执行失败', {
        type,
        executionId,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      });
      
      // 尝试清理
      await this.pipeline.cleanup({
        success: false,
        errors: [{ step: 'pipeline', error: error.message }]
      });
      
      throw error;
    }
  }

  /**
   * 手动触发抓取并生成报告（端到端流程）
   * @param {string} type - 报告类型 (daily/weekly/monthly)
   * @returns {Promise<Object>} 执行结果
   */
  async triggerManual(type) {
    logger.title(`[CompleteWorkflow] 手动触发${type}报告生成流程`);
    
    if (!this.scrapers[type]) {
      logger.error('[CompleteWorkflow] 未找到指定的抓取器', { type });
      return {
        success: false,
        error: `未找到${type}类型的抓取器`
      };
    }
    
    try {
      // 步骤 1: 执行抓取
      logger.info('[CompleteWorkflow] 步骤 1/2: 执行抓取...');
      const scraper = this.scrapers[type];
      const data = await scraper.execute({ saveToFile: true });
      
      if (!data) {
        throw new Error('抓取返回空数据');
      }
      
      logger.success('[CompleteWorkflow] 抓取完成', { 
        type, 
        projectsCount: data.projects?.length || 0 
      });
      
      // 步骤 2: 生成报告
      logger.info('[CompleteWorkflow] 步骤 2/2: 生成报告...');
      const result = await this.executePipeline(data, type);
      
      logger.success('[CompleteWorkflow] 手动触发流程完成', {
        type,
        success: result.success,
        htmlPath: result.htmlPath,
        duration: `${result.duration}ms`
      });
      
      return result;
    } catch (error) {
      logger.error('[CompleteWorkflow] 手动触发失败', {
        type,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        type
      };
    }
  }

  /**
   * 触发所有类型的抓取和报告生成
   * @returns {Promise<Object>} 所有执行结果
   */
  async triggerAll() {
    logger.title('[CompleteWorkflow] 触发所有报告生成流程');
    
    const results = {
      daily: null,
      weekly: null,
      monthly: null,
      summary: {
        total: 3,
        success: 0,
        failed: 0
      }
    };
    
    const types = ['daily', 'weekly', 'monthly'];
    
    for (const type of types) {
      try {
        logger.info(`[CompleteWorkflow] 执行${type}任务...`);
        results[type] = await this.triggerManual(type);
        
        if (results[type].success) {
          results.summary.success++;
        } else {
          results.summary.failed++;
        }
      } catch (error) {
        results[type] = {
          success: false,
          error: error.message,
          type
        };
        results.summary.failed++;
      }
    }
    
    logger.info('[CompleteWorkflow] 所有任务执行完成', results.summary);
    return results;
  }

  /**
   * 获取工作流状态
   * @returns {Object} 工作流状态信息
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      options: this.options,
      scheduler: this.scheduler.getStatus(),
      pipeline: {
        enableAI: this.pipeline.enableAI,
        enableHTML: this.pipeline.enableHTML,
        enableIndex: this.pipeline.enableIndex,
        enableNotification: this.pipeline.enableNotification
      },
      executionHistory: {
        total: this.executionHistory.length,
        success: this.executionHistory.filter(r => r.status === 'success').length,
        failed: this.executionHistory.filter(r => r.status === 'failed').length,
        lastExecution: this.executionHistory.length > 0 
          ? this.executionHistory[this.executionHistory.length - 1] 
          : null
      }
    };
  }

  /**
   * 获取执行历史
   * @param {number} limit - 限制返回数量
   * @returns {Array} 执行历史记录
   */
  getExecutionHistory(limit = 10) {
    return this.executionHistory
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * 销毁工作流，释放资源
   */
  destroy() {
    logger.info('[CompleteWorkflow] 销毁工作流...');
    
    this.stop();
    this.scheduler.destroy();
    this.scrapers = {};
    this.retryHandler = null;
    this.pipeline = null;
    this.executionHistory = [];
    this.isRunning = false;
    
    logger.success('[CompleteWorkflow] 工作流已销毁');
  }
}

/**
 * 创建工作流实例（工厂函数）
 * @param {Object} options - 配置选项
 * @returns {CompleteWorkflow} 工作流实例
 */
function createWorkflow(options = {}) {
  return new CompleteWorkflow(options);
}

module.exports = {
  CompleteWorkflow,
  createWorkflow
};
