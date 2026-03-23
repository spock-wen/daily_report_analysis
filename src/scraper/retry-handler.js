const logger = require('../utils/logger');

/**
 * RetryHandler - 重试处理器
 * 处理抓取失败后的重试逻辑
 * 
 * 特性：
 * - 固定间隔 5 分钟重试
 * - 最大 12 次重试
 * - 详细日志记录
 * - 从环境变量读取配置
 */
class RetryHandler {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.maxRetries - 最大重试次数（默认 12）
   * @param {number} options.retryInterval - 重试间隔（毫秒，默认 5 分钟）
   * @param {string} options.name - 处理器名称
   */
  constructor(options = {}) {
    // 从环境变量读取配置，如果未提供则使用默认值
    this.maxRetries = options.maxRetries || parseInt(process.env.MAX_RETRIES, 10) || 12;
    this.retryInterval = options.retryInterval || parseInt(process.env.RETRY_INTERVAL_MS, 10) || 5 * 60 * 1000; // 默认 5 分钟
    this.name = options.name || 'RetryHandler';
    
    // 重试记录
    this.retryRecords = new Map();
    
    logger.info(`[${this.name}] 初始化完成`, {
      maxRetries: this.maxRetries,
      retryInterval: `${this.retryInterval / 1000}秒`
    });
  }

  /**
   * 生成重试记录的唯一键
   * @param {string} url - 目标 URL
   * @param {string} scraperName - 抓取器名称
   * @returns {string} 唯一键
   */
  generateKey(url, scraperName) {
    return `${scraperName}:${url}`;
  }

  /**
   * 获取重试记录
   * @param {string} url - 目标 URL
   * @param {string} scraperName - 抓取器名称
   * @returns {Object} 重试记录
   */
  getRetryRecord(url, scraperName) {
    const key = this.generateKey(url, scraperName);
    
    if (!this.retryRecords.has(key)) {
      this.retryRecords.set(key, {
        url,
        scraperName,
        attempts: 0,
        lastAttempt: null,
        lastError: null,
        nextRetry: null,
        success: false
      });
    }
    
    return this.retryRecords.get(key);
  }

  /**
   * 处理重试请求
   * @param {Object} context - 重试上下文
   * @param {Object} context.scraper - 抓取器实例
   * @param {string} context.url - 目标 URL
   * @param {Error} context.error - 错误对象
   * @param {Object} context.options - 执行选项
   * @returns {Promise<boolean>} 是否进行重试
   */
  async handleRetry(context) {
    const { scraper, url, error, options } = context;
    const scraperName = scraper.name || 'UnknownScraper';
    
    // 获取或创建重试记录
    const record = this.getRetryRecord(url, scraperName);
    
    // 增加重试次数
    record.attempts++;
    record.lastAttempt = new Date().toISOString();
    record.lastError = error.message;
    
    logger.warn(`[${this.name}] 抓取失败`, {
      url,
      attempt: record.attempts,
      maxRetries: this.maxRetries,
      error: error.message
    });

    // 检查是否超过最大重试次数
    if (record.attempts > this.maxRetries) {
      logger.error(`[${this.name}] 超过最大重试次数，放弃重试`, {
        url,
        totalAttempts: record.attempts
      });
      
      record.success = false;
      return false;
    }

    // 计算下次重试时间
    const nextRetryTime = new Date(Date.now() + this.retryInterval);
    record.nextRetry = nextRetryTime.toISOString();

    // 输出重试信息
    logger.info(`[${this.name}] 安排重试`, {
      url,
      attempt: record.attempts,
      nextRetry: nextRetryTime.toLocaleString('zh-CN'),
      retryInterval: `${this.retryInterval / 1000}秒`
    });

    // 设置定时器进行重试
    this.scheduleRetry(scraper, url, options, record);

    return true;
  }

  /**
   * 调度重试
   * @param {Object} scraper - 抓取器实例
   * @param {string} url - 目标 URL
   * @param {Object} options - 执行选项
   * @param {Object} record - 重试记录
   */
  scheduleRetry(scraper, url, options, record) {
    const retryDelay = this.retryInterval;
    
    setTimeout(async () => {
      logger.info(`[${this.name}] 开始执行重试 (第 ${record.attempts} 次)...`, {
        url,
        scraper: scraper.name
      });

      try {
        // 重新执行抓取
        const result = await scraper.execute({
          url,
          ...options,
          saveToFile: options.saveToFile || false
        });

        if (result) {
          record.success = true;
          logger.success(`[${this.name}] 重试成功`, {
            url,
            attempts: record.attempts
          });
          
          // 清理成功的记录（可选保留一段时间）
          // this.retryRecords.delete(this.generateKey(url, scraper.name));
        }
      } catch (retryError) {
        logger.error(`[${this.name}] 重试失败`, {
          url,
          attempt: record.attempts,
          error: retryError.message
        });
        
        // 如果还有重试机会，继续安排下一次重试
        if (record.attempts < this.maxRetries) {
          record.nextRetry = new Date(Date.now() + this.retryInterval).toISOString();
          this.scheduleRetry(scraper, url, options, record);
        } else {
          record.success = false;
          logger.error(`[${this.name}] 所有重试均已失败`, {
            url,
            totalAttempts: record.attempts
          });
        }
      }
    }, retryDelay);
  }

  /**
   * 获取所有重试记录
   * @returns {Array} 重试记录数组
   */
  getAllRecords() {
    return Array.from(this.retryRecords.values());
  }

  /**
   * 获取指定 URL 的重试状态
   * @param {string} url - 目标 URL
   * @param {string} scraperName - 抓取器名称
   * @returns {Object|null} 重试状态或 null
   */
  getRetryStatus(url, scraperName) {
    const key = this.generateKey(url, scraperName);
    return this.retryRecords.get(key) || null;
  }

  /**
   * 清除所有重试记录
   */
  clearRecords() {
    this.retryRecords.clear();
    logger.info(`[${this.name}] 已清除所有重试记录`);
  }

  /**
   * 清除失败记录
   * @param {string} url - 目标 URL
   * @param {string} scraperName - 抓取器名称
   */
  clearRecord(url, scraperName) {
    const key = this.generateKey(url, scraperName);
    const deleted = this.retryRecords.delete(key);
    
    if (deleted) {
      logger.info(`[${this.name}] 已清除重试记录`, { url, scraperName });
    }
    
    return deleted;
  }

  /**
   * 手动触发重试
   * @param {Object} scraper - 抓取器实例
   * @param {string} url - 目标 URL
   * @param {Object} options - 执行选项
   * @returns {Promise<boolean>} 是否成功触发重试
   */
  async triggerRetry(scraper, url, options = {}) {
    const scraperName = scraper.name || 'UnknownScraper';
    const record = this.getRetryStatus(url, scraperName);
    
    if (!record) {
      logger.warn(`[${this.name}] 未找到重试记录，无法手动触发`, { url, scraperName });
      return false;
    }

    if (record.success) {
      logger.warn(`[${this.name}] 该任务已成功，无需重试`, { url, scraperName });
      return false;
    }

    logger.info(`[${this.name}] 手动触发重试`, {
      url,
      scraperName,
      previousAttempts: record.attempts
    });

    // 重置重试次数以便重新尝试
    record.attempts = 0;
    return await this.handleRetry({ scraper, url, error: new Error('手动触发'), options });
  }
}

module.exports = RetryHandler;
