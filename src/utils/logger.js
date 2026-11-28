/**
 * 统一日志工具模块
 * 提供结构化的日志输出功能
 */

// 日志级别
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// 当前日志级别（从环境变量读取，默认为 INFO）
const currentLevel = parseInt(process.env.LOG_LEVEL || '1', 10);

// 日志颜色（ANSI 颜色码）
const colors = {
  reset: '\x1b[0m',
  debug: '\x1b[36m',   // 青色
  info: '\x1b[32m',    // 绿色
  warn: '\x1b[33m',    // 黄色
  error: '\x1b[31m',   // 红色
  success: '\x1b[35m', // 紫色
};

/**
 * 日志 meta 中需要红行的密钥/webhook 字段名（大小写不敏感）
 */
const SENSITIVE_META_KEY = /^(webhookurl|webhookurls|token|accesstoken|access_token|tenant_access_token|appsecret|app_secret|authorization|password|apikey|api_key|secret)$/i;

/**
 * 将看起来像 webhook 的 URL 替换为占位符
 * @param {string} text
 * @returns {string}
 */
function redactSecretUrls(text) {
  return text.replace(/https?:\/\/[^\s'"]+/gi, (url) => {
    try {
      const parsed = new URL(url);
      const haystack = `${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (/webhook|token|secret|hook/i.test(haystack)) {
        return '[REDACTED_URL]';
      }
    } catch {
      if (/webhook|token|secret|hook/i.test(url)) return '[REDACTED_URL]';
    }
    return url;
  });
}

/**
 * 递归红行 meta 中的敏感字段，避免日志回显 webhook 或 token
 * @param {any} value
 * @returns {any}
 */
function redactMeta(value) {
  if (typeof value === 'string') {
    return redactSecretUrls(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactMeta);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = SENSITIVE_META_KEY.test(key) ? '[REDACTED]' : redactMeta(child);
    }
    return out;
  }
  return value;
}

/**
 * 格式化日志消息
 * @param {string} level - 日志级别
 * @param {string} message - 消息内容
 * @param {Object} meta - 附加信息
 */
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const safeMessage = typeof message === 'string' ? redactSecretUrls(message) : message;
  const safeMeta = redactMeta(meta);
  let metaStr = '';
  if (safeMeta && typeof safeMeta === 'object') {
    if (Object.keys(safeMeta).length > 0) {
      metaStr = ` ${JSON.stringify(safeMeta)}`;
    }
  } else if (safeMeta !== undefined && safeMeta !== null) {
    metaStr = ` ${JSON.stringify(safeMeta)}`;
  }
  return `[${timestamp}] [${level}]${metaStr} ${safeMessage}`;
}

/**
 * 输出日志
 * @param {string} level - 日志级别
 * @param {string} color - 颜色码
 * @param {string} message - 消息内容
 * @param {Object} meta - 附加信息
 */
function log(level, color, message, meta = {}) {
  // 将级别转换为大写以匹配 LogLevel
  const levelKey = level.toUpperCase();
  // 默认为 INFO 级别 (1)
  const messageLevel = LogLevel[levelKey] !== undefined ? LogLevel[levelKey] : 1;
  
  if (messageLevel >= currentLevel) {
    const formatted = formatLog(level, message, meta);
    console.log(`${color}${formatted}${colors.reset}`);
  }
}

// 日志方法
const logger = {
  /**
   * 调试日志
   * @param {string} message - 消息内容
   * @param {Object} meta - 附加信息
   */
  debug(message, meta) {
    log('DEBUG', colors.debug, message, meta);
  },

  /**
   * 信息日志
   * @param {string} message - 消息内容
   * @param {Object} meta - 附加信息
   */
  info(message, meta) {
    log('INFO', colors.info, message, meta);
  },

  /**
   * 警告日志
   * @param {string} message - 消息内容
   * @param {Object} meta - 附加信息
   */
  warn(message, meta) {
    log('WARN', colors.warn, message, meta);
  },

  /**
   * 错误日志
   * @param {string} message - 消息内容
   * @param {Object} meta - 附加信息
   */
  error(message, meta) {
    log('ERROR', colors.error, message, meta);
  },

  /**
   * 成功日志
   * @param {string} message - 消息内容
   * @param {Object} meta - 附加信息
   */
  success(message, meta) {
    log('SUCCESS', colors.success, message, meta);
  },

  /**
   * 分隔线
   */
  divider(char = '=', length = 60) {
    console.log(char.repeat(length));
  },

  /**
   * 标题
   * @param {string} title - 标题内容
   */
  title(title) {
    this.divider();
    console.log(`  ${title}`);
    this.divider();
  },
};

logger.redactMeta = redactMeta;
logger.formatLog = formatLog;

module.exports = logger;
