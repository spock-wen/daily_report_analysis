/**
 * 错误分类模块 - 定义系统中使用的各种错误类型
 * 
 * 错误类型：
 * - NetworkError: 网络错误（请求失败、超时等）
 * - ParseError: 解析错误（HTML 解析、JSON 解析等）
 * - AIError: AI 分析错误（LLM 调用失败、解析失败等）
 * - GeneratorError: 报告生成错误（HTML 生成失败、文件写入失败等）
 * - NotificationError: 通知发送错误（推送通知失败等）
 * - ConfigError: 配置错误（配置缺失、格式错误等）
 * - ValidationError: 验证错误（数据验证失败等）
 */

const logger = require('./logger');

/**
 * 基础错误类
 */
class BaseError extends Error {
  constructor(message, options = {}) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = options.code || 'UNKNOWN_ERROR';
    this.statusCode = options.statusCode || 500;
    this.isOperational = options.isOperational !== false; // 默认为运营性错误
    this.timestamp = new Date().toISOString();
    this.context = options.context || {};
    
    // 捕获堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // 记录错误日志
    this.logError();
  }
  
  /**
   * 记录错误日志
   */
  logError() {
    const logContext = {
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
      ...this.context
    };
    
    logger.error(`[${this.name}] ${this.message}`, logContext);
  }
  
  /**
   * 转换为 JSON 对象
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      isOperational: this.isOperational
    };
  }
}

/**
 * 网络错误
 * 用于表示网络请求相关的错误（HTTP 错误、超时、连接失败等）
 */
class NetworkError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'NETWORK_ERROR',
      statusCode: options.statusCode || 503
    });
  }
}

/**
 * 解析错误
 * 用于表示数据解析相关的错误（HTML 解析、JSON 解析、数据格式错误等）
 */
class ParseError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'PARSE_ERROR',
      statusCode: options.statusCode || 400
    });
  }
}

/**
 * AI 分析错误
 * 用于表示 AI 相关的错误（LLM 调用失败、API 限流、Token 不足等）
 */
class AIError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'AI_ERROR',
      statusCode: options.statusCode || 503
    });
  }
}

/**
 * 报告生成错误
 * 用于表示报告生成相关的错误（HTML 生成失败、模板渲染错误、文件写入失败等）
 */
class GeneratorError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'GENERATOR_ERROR',
      statusCode: options.statusCode || 500
    });
  }
}

/**
 * 通知发送错误
 * 用于表示推送通知相关的错误（飞书/WeLink API 失败、Webhook 错误等）
 */
class NotificationError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'NOTIFICATION_ERROR',
      statusCode: options.statusCode || 503
    });
  }
}

/**
 * 配置错误
 * 用于表示配置相关的错误（配置缺失、格式错误、环境变量未设置等）
 */
class ConfigError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'CONFIG_ERROR',
      statusCode: options.statusCode || 500
    });
  }
}

/**
 * 验证错误
 * 用于表示数据验证相关的错误（字段缺失、格式不正确、值无效等）
 */
class ValidationError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'VALIDATION_ERROR',
      statusCode: options.statusCode || 400
    });
  }
}

/**
 * 错误处理工具类
 */
class ErrorHandler {
  /**
   * 判断错误是否为运营性错误（可预期的错误）
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为运营性错误
   */
  static isOperationalError(error) {
    return error instanceof BaseError && error.isOperational;
  }
  
  /**
   * 判断错误是否为网络错误
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为网络错误
   */
  static isNetworkError(error) {
    return error instanceof NetworkError;
  }
  
  /**
   * 判断错误是否为解析错误
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为解析错误
   */
  static isParseError(error) {
    return error instanceof ParseError;
  }
  
  /**
   * 判断错误是否为 AI 错误
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为 AI 错误
   */
  static isAIError(error) {
    return error instanceof AIError;
  }
  
  /**
   * 判断错误是否为生成器错误
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为生成器错误
   */
  static isGeneratorError(error) {
    return error instanceof GeneratorError;
  }
  
  /**
   * 判断错误是否为通知错误
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为通知错误
   */
  static isNotificationError(error) {
    return error instanceof NotificationError;
  }
  
  /**
   * 判断错误是否为配置错误
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为配置错误
   */
  static isConfigError(error) {
    return error instanceof ConfigError;
  }
  
  /**
   * 判断错误是否为验证错误
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否为验证错误
   */
  static isValidationError(error) {
    return error instanceof ValidationError;
  }
  
  /**
   * 获取错误的 HTTP 状态码
   * @param {Error} error - 错误对象
   * @returns {number} HTTP 状态码
   */
  static getStatusCode(error) {
    if (error instanceof BaseError) {
      return error.statusCode;
    }
    return 500; // 默认内部服务器错误
  }
  
  /**
   * 将未知错误转换为标准错误类型
   * @param {Error} error - 错误对象
   * @param {string} defaultMessage - 默认错误消息
   * @returns {BaseError} 标准错误对象
   */
  static normalizeError(error, defaultMessage = '发生未知错误') {
    if (error instanceof BaseError) {
      return error;
    }
    
    // 根据错误名称或消息判断错误类型
    const message = error.message || defaultMessage;
    
    if (message.includes('network') || message.includes('timeout') || 
        message.includes('fetch') || message.includes('HTTP')) {
      return new NetworkError(message, { originalError: error });
    }
    
    if (message.includes('parse') || message.includes('JSON') || 
        message.includes('invalid') || message.includes('format')) {
      return new ParseError(message, { originalError: error });
    }
    
    if (message.includes('AI') || message.includes('LLM') || 
        message.includes('token') || message.includes('API limit')) {
      return new AIError(message, { originalError: error });
    }
    
    if (message.includes('generate') || message.includes('template') || 
        message.includes('render')) {
      return new GeneratorError(message, { originalError: error });
    }
    
    if (message.includes('notification') || message.includes('feishu') || 
        message.includes('welink') || message.includes('webhook')) {
      return new NotificationError(message, { originalError: error });
    }
    
    if (message.includes('config') || message.includes('env') || 
        message.includes('environment')) {
      return new ConfigError(message, { originalError: error });
    }
    
    if (message.includes('valid') || message.includes('required') || 
        message.includes('missing')) {
      return new ValidationError(message, { originalError: error });
    }
    
    // 默认为基础错误
    return new BaseError(message, { originalError: error });
  }
  
  /**
   * 记录错误详情（带上下文）
   * @param {Error} error - 错误对象
   * @param {string} module - 模块名称
   * @param {Object} context - 上下文信息
   */
  static logError(error, module, context = {}) {
    const normalizedError = this.normalizeError(error);
    
    logger.error(`[${module}] ${normalizedError.message}`, {
      code: normalizedError.code,
      stack: normalizedError.stack,
      ...context
    });
  }
  
  /**
   * 记录警告信息
   * @param {string} message - 警告消息
   * @param {string} module - 模块名称
   * @param {Object} context - 上下文信息
   */
  static logWarning(message, module, context = {}) {
    logger.warn(`[${module}] ${message}`, context);
  }
  
  /**
   * 记录成功信息
   * @param {string} message - 成功消息
   * @param {string} module - 模块名称
   * @param {Object} context - 上下文信息
   */
  static logSuccess(message, module, context = {}) {
    logger.success(`[${module}] ${message}`, context);
  }
}

module.exports = {
  BaseError,
  NetworkError,
  ParseError,
  AIError,
  GeneratorError,
  NotificationError,
  ConfigError,
  ValidationError,
  ErrorHandler
};
