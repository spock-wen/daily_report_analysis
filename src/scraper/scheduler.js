const cron = require('node-cron');
const logger = require('../utils/logger');
const config = require('../utils/config');

/**
 * ScraperScheduler - 定时任务调度器
 * 负责管理和执行所有定时抓取任务
 * 
 * 功能：
 * - 日报：每天 8:00 执行
 * - 周报：每周一 8:30 执行
 * - 月报：每月 1 日 9:00 执行
 * - 支持重试机制（5 分钟间隔，最多 12 次）
 * - 集成报告生成流程
 */
class ScraperScheduler {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Object} options.scrapers - 抓取器实例集合 { daily, weekly, monthly }
   * @param {Object} options.retryHandler - 重试处理器实例
   * @param {boolean} options.enabled - 是否启用调度器（从环境变量读取）
   */
  constructor(options = {}) {
    this.scrapers = options.scrapers || {};
    this.retryHandler = options.retryHandler || null;
    
    // 从环境变量或配置读取是否启用调度器
    this.enabled = options.enabled !== undefined 
      ? options.enabled 
      : process.env.SCHEDULER_ENABLED === 'true';
    
    // 定时任务实例存储
    this.scheduledTasks = new Map();
    
    // 任务执行状态
    this.isRunning = false;
    
    // 回调函数
    this.onScraperSuccessCallback = null;
    this.onScraperFailureCallback = null;
    this.triggerReportGenerationCallback = null;
    
    logger.title('[Scheduler] 定时任务调度器初始化');
    logger.info('[Scheduler] 配置信息', {
      enabled: this.enabled,
      scrapers: Object.keys(this.scrapers),
      retryHandler: this.retryHandler ? '已配置' : '未配置'
    });
  }

  /**
   * 设置抓取成功回调
   * @param {Function} callback - 回调函数 (data, type) => void
   */
  onScraperSuccess(callback) {
    this.onScraperSuccessCallback = callback;
    logger.info('[Scheduler] 抓取成功回调已注册');
  }

  /**
   * 设置抓取失败回调
   * @param {Function} callback - 回调函数 (error, type) => void
   */
  onScraperFailure(callback) {
    this.onScraperFailureCallback = callback;
    logger.info('[Scheduler] 抓取失败回调已注册');
  }

  /**
   * 设置报告生成触发器
   * @param {Function} callback - 回调函数 (type, data) => void
   */
  triggerReportGeneration(callback) {
    this.triggerReportGenerationCallback = callback;
    logger.info('[Scheduler] 报告生成触发器已注册');
  }

  /**
   * 启动所有定时任务
   */
  start() {
    if (!this.enabled) {
      logger.warn('[Scheduler] 调度器已禁用，跳过启动');
      return false;
    }

    if (this.isRunning) {
      logger.warn('[Scheduler] 调度器已在运行中');
      return false;
    }

    logger.title('[Scheduler] 启动定时任务调度器');

    try {
      // 配置日报任务：每天 8:00
      this.scheduleTask('daily', '0 8 * * *', '日报');
      
      // 配置周报任务：每周一 8:30
      this.scheduleTask('weekly', '30 8 * * 1', '周报');
      
      // 配置月报任务：每月 1 日 9:00
      this.scheduleTask('monthly', '0 9 1 * *', '月报');

      this.isRunning = true;
      logger.success('[Scheduler] 所有定时任务已启动');
      this.logScheduleInfo();
      
      return true;
    } catch (error) {
      logger.error('[Scheduler] 启动失败', { error: error.message });
      this.stop();
      return false;
    }
  }

  /**
   * 停止所有定时任务
   */
  stop() {
    logger.title('[Scheduler] 停止定时任务调度器');

    // 停止所有定时任务
    this.scheduledTasks.forEach((task, type) => {
      task.stop();
      logger.info(`[Scheduler] 已停止任务：${type}`);
    });

    this.scheduledTasks.clear();
    this.isRunning = false;
    
    logger.success('[Scheduler] 所有定时任务已停止');
  }

  /**
   * 获取调度器状态
   * @returns {Object} 调度器状态信息
   */
  getStatus() {
    const status = {
      enabled: this.enabled,
      isRunning: this.isRunning,
      tasks: {},
      totalTasks: this.scheduledTasks.size
    };

    this.scheduledTasks.forEach((task, type) => {
      status.tasks[type] = {
        scheduled: true,
        nextExecution: task.nextExecution ? task.nextExecution() : '未知'
      };
    });

    return status;
  }

  /**
   * 调度单个任务
   * @param {string} type - 任务类型 (daily/weekly/monthly)
   * @param {string} cronPattern - Cron 表达式
   * @param {string} name - 任务名称
   * @private
   */
  scheduleTask(type, cronPattern, name) {
    if (!this.scrapers[type]) {
      logger.warn(`[Scheduler] 未找到${name}抓取器，跳过调度`);
      return;
    }

    logger.info(`[Scheduler] 配置${name}任务`, {
      type,
      cronPattern,
      scraper: this.scrapers[type].name || type
    });

    // 创建定时任务
    const task = cron.schedule(cronPattern, async () => {
      logger.title(`[Scheduler] 触发${name}抓取任务`);
      await this.executeScraper(type, this.scrapers[type]);
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai' // 使用东八区时间
    });

    this.scheduledTasks.set(type, task);
  }

  /**
   * 执行抓取器
   * @param {string} type - 抓取器类型 (daily/weekly/monthly)
   * @param {Object} scraper - 抓取器实例
   * @returns {Promise<Object|null>} 抓取结果或 null
   */
  async executeScraper(type, scraper) {
    const scraperName = scraper.name || type;
    logger.title(`[Scheduler] 开始执行${scraperName}抓取任务`);

    try {
      // 执行抓取
      const data = await scraper.execute({
        saveToFile: true
      });

      if (data) {
        logger.success(`[Scheduler] ${scraperName}抓取成功`);
        
        // 触发成功回调
        if (this.onScraperSuccessCallback) {
          this.onScraperSuccessCallback(data, type);
        }

        // 触发报告生成
        if (this.triggerReportGenerationCallback) {
          this.triggerReportGenerationCallback(type, data);
        }

        return data;
      } else {
        logger.warn(`[Scheduler] ${scraperName}抓取返回空数据`);
        return null;
      }
    } catch (error) {
      logger.error(`[Scheduler] ${scraperName}抓取失败`, {
        error: error.message,
        stack: error.stack
      });

      // 触发失败回调
      if (this.onScraperFailureCallback) {
        this.onScraperFailureCallback(error, type);
      }

      // 如果配置了重试处理器，使用重试机制
      if (this.retryHandler) {
        logger.info(`[Scheduler] 启动重试机制...`);
        const shouldRetry = await this.retryHandler.handleRetry({
          scraper,
          url: scraper.url,
          error,
          options: { saveToFile: true }
        });

        if (shouldRetry) {
          logger.info(`[Scheduler] 重试机制已启动，等待重试...`);
        } else {
          logger.error(`[Scheduler] 重试机制未启动或已放弃`);
        }
      } else {
        logger.warn('[Scheduler] 未配置重试处理器，跳过重试');
      }

      return null;
    }
  }

  /**
   * 手动触发指定类型的抓取任务
   * @param {string} type - 任务类型 (daily/weekly/monthly)
   * @returns {Promise<Object|null>} 抓取结果
   */
  async triggerManual(type) {
    if (!this.scrapers[type]) {
      logger.error(`[Scheduler] 未找到${type}类型的抓取器`);
      return null;
    }

    logger.info(`[Scheduler] 手动触发${type}类型抓取任务`);
    return await this.executeScraper(type, this.scrapers[type]);
  }

  /**
   * 输出调度信息
   * @private
   */
  logScheduleInfo() {
    logger.info('[Scheduler] 定时任务配置', {
      daily: '每天 08:00 (cron: 0 8 * * *)',
      weekly: '每周一 08:30 (cron: 30 8 * * 1)',
      monthly: '每月 1 日 09:00 (cron: 0 9 1 * *)'
    });

    logger.info('[Scheduler] 时区', {
      timezone: 'Asia/Shanghai (UTC+8)'
    });
  }

  /**
   * 立即执行所有任务（用于测试）
   * @returns {Promise<Object>} 所有任务的执行结果
   */
  async executeAll() {
    logger.title('[Scheduler] 立即执行所有抓取任务（测试模式）');
    
    const results = {};
    
    for (const [type, scraper] of Object.entries(this.scrapers)) {
      try {
        logger.info(`[Scheduler] 执行${type}任务...`);
        results[type] = await this.executeScraper(type, scraper);
      } catch (error) {
        results[type] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * 销毁调度器，释放资源
   */
  destroy() {
    logger.info('[Scheduler] 销毁调度器...');
    this.stop();
    this.scheduledTasks.clear();
    this.scrapers = {};
    this.retryHandler = null;
    this.onScraperSuccessCallback = null;
    this.onScraperFailureCallback = null;
    this.triggerReportGenerationCallback = null;
    logger.success('[Scheduler] 调度器已销毁');
  }
}

module.exports = ScraperScheduler;
