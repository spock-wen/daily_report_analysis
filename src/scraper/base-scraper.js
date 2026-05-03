const logger = require('../utils/logger');

/**
 * BaseScraper - 抓取器基类
 * 提供基础接口和通用功能，所有具体抓取器都应继承此类
 */
class BaseScraper {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.name - 抓取器名称
   * @param {string} options.url - 目标 URL
   * @param {Object} options.headers - 请求头
   * @param {number} options.timeout - 请求超时时间（毫秒）
   */
  constructor(options = {}) {
    this.name = options.name || 'BaseScraper';
    this.url = options.url || '';
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    this.headers = { ...defaultHeaders, ...options.headers };
    this.timeout = options.timeout || 30000; // 默认 30 秒超时
    this.retryHandler = null;
  }

  /**
   * 设置重试处理器
   * @param {RetryHandler} retryHandler - 重试处理器实例
   */
  setRetryHandler(retryHandler) {
    this.retryHandler = retryHandler;
    return this;
  }

  /**
   * 获取网页内容
   * @param {string} url - 目标 URL
   * @param {Object} options - 请求选项
   * @returns {Promise<string>} HTML 内容
   * @throws {Error} 请求失败时抛出错误
   */
  async fetch(url, options = {}) {
    const targetUrl = url || this.url;
    
    if (!targetUrl) {
      throw new Error('未指定目标 URL');
    }

    logger.info(`[${this.name}] 开始抓取：${targetUrl}`);

    try {
      const response = await fetch(targetUrl, {
        headers: { ...this.headers, ...options.headers },
        timeout: options.timeout || this.timeout,
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP 错误：${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      logger.success(`[${this.name}] 抓取成功，内容长度：${html.length} 字节`);
      
      return html;
    } catch (error) {
      logger.error(`[${this.name}] 抓取失败：${error.message}`, { url: targetUrl });
      throw error;
    }
  }

  /**
   * 解析 HTML 内容
   * @param {string} html - HTML 内容
   * @returns {Promise<Object>} 解析后的数据
   * @throws {Error} 解析失败时抛出错误
   */
  async parse(html) {
    logger.info(`[${this.name}] 开始解析 HTML 内容...`);
    
    if (!html || typeof html !== 'string') {
      throw new Error('无效的 HTML 内容');
    }

    try {
      const data = await this.parseHTML(html);
      logger.success(`[${this.name}] 解析完成`);
      return data;
    } catch (error) {
      logger.error(`[${this.name}] 解析失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 解析 HTML 的具体实现（由子类实现）
   * @param {string} html - HTML 内容
   * @returns {Promise<Object>} 解析后的数据
   */
  async parseHTML(html) {
    throw new Error('parseHTML 方法必须由子类实现');
  }

  /**
   * 保存数据
   * @param {Object} data - 要保存的数据
   * @param {string} outputPath - 输出路径
   * @returns {Promise<boolean>} 是否保存成功
   */
  async save(data, outputPath) {
    logger.info(`[${this.name}] 保存数据到：${outputPath}`);

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // 确保目录存在
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // 写入 JSON 文件
      await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
      
      logger.success(`[${this.name}] 数据已保存`);
      return true;
    } catch (error) {
      logger.error(`[${this.name}] 保存失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 执行完整的抓取流程
   * @param {Object} options - 执行选项
   * @param {string} options.url - 目标 URL（可选，覆盖构造函数中的 URL）
   * @param {string} options.outputPath - 输出路径（可选）
   * @param {boolean} options.saveToFile - 是否保存到文件（默认 false）
   * @returns {Promise<Object>} 抓取并解析后的数据
   */
  async execute(options = {}) {
    const url = options.url || this.url;
    const saveToFile = options.saveToFile || false;
    const outputPath = options.outputPath;

    logger.title(`[${this.name}] 开始执行抓取任务`);

    try {
      // 1. 抓取
      const html = await this.fetch(url);

      // 2. 解析
      const data = await this.parse(html);

      // 3. 保存（可选）
      if (saveToFile && outputPath) {
        await this.save(data, outputPath);
      }

      logger.success(`[${this.name}] 抓取任务完成`);
      return data;
    } catch (error) {
      logger.error(`[${this.name}] 抓取任务失败：${error.message}`);
      
      // 如果配置了重试处理器，尝试重试
      if (this.retryHandler) {
        logger.info(`[${this.name}] 准备通过重试处理器进行重试...`);
        const shouldRetry = await this.retryHandler.handleRetry({
          scraper: this,
          url,
          error,
          options
        });
        
        if (shouldRetry) {
          logger.info(`[${this.name}] 重试处理器已接管，等待重试...`);
          return null; // 返回 null 表示重试中
        }
      }
      
      throw error;
    }
  }
}

module.exports = BaseScraper;
