/**
 * 通知模板模块
 * 负责生成飞书和 WeLink 的成功/失败通知消息
 * 支持日报/周报/月报三种类型
 */

const logger = require('../utils/logger');

/**
 * 报告类型配置
 */
const REPORT_TYPES = {
  daily: { name: '日报', prefix: 'GitHub Trending' },
  weekly: { name: '周报', prefix: 'GitHub 趋势' },
  monthly: { name: '月报', prefix: 'GitHub 月度' }
};

/**
 * 生成成功通知的飞书消息模板
 * @param {string} reportType - 报告类型 (daily/weekly/monthly)
 * @param {Object} data - 报告数据
 * @param {string} reportUrl - 报告链接
 * @returns {Object} 飞书 Interactive 消息对象
 */
function generateSuccessFeishu(reportType, data, reportUrl) {
  const typeConfig = REPORT_TYPES[reportType] || REPORT_TYPES.daily;
  const date = data.date || data.weekStart || data.month || new Date().toISOString().split('T')[0];
  const trendingRepos = data.brief?.trending_repos || data.trending_repos || [];
  const aiInsights = data.aiInsights || {};
  
  // 计算语言分布
  const languageDist = calculateLanguageDistribution(trendingRepos);
  
  // 生成时间
  const generatedAt = new Date().toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 构建飞书 Interactive 卡片
  const message = {
    config: { 
      wide_screen_mode: true 
    },
    header: {
      title: { 
        tag: "plain_text", 
        content: `✅ ${typeConfig.prefix}${typeConfig.name}已生成` 
      },
      subtitle: { 
        tag: "plain_text", 
        content: `${date} · ${trendingRepos.length} 个热门项目` 
      },
      template: "green"
    },
    elements: [
      // 1. 报告时间
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `📊 **报告时间**\n${date}`
        }
      },
      { tag: "hr" },
      
      // 2. 热门项目数量
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `🔥 **热门项目**\n${trendingRepos.length} 个`
        }
      },
      { tag: "hr" },
      
      // 3. AI 洞察状态
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `💡 **AI 洞察**\n${aiInsights.oneLiner || aiInsights.oneLineSummary ? '已生成' : '暂未生成'}`
        }
      },
      { tag: "hr" },
      
      // 4. 语言分布
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `📝 **语言分布**\n${formatLanguageDistribution(languageDist)}`
        }
      },
      { tag: "hr" },
      
      // 5. TOP3 项目（如果有）
      ...(trendingRepos.length > 0 ? [{
        tag: "div",
        text: {
          tag: "lark_md",
          content: `🏆 **热门项目 TOP3**\n${formatTopProjects(trendingRepos.slice(0, 3))}`
        }
      }, { tag: "hr" }] : []),
      
      // 6. 查看报告按钮
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { 
              tag: "plain_text", 
              content: "🔗 查看报告" 
            },
            type: "primary",
            url: reportUrl
          }
        ]
      },
      
      // 7. 页脚
      {
        tag: "note",
        elements: [
          { 
            tag: "plain_text", 
            content: `⏰ 生成时间：${generatedAt}` 
          }
        ]
      }
    ]
  };
  
  logger.debug('飞书成功通知模板生成', { 
    reportType, 
    elementsCount: message.elements.length 
  });
  
  return message;
}

/**
 * 生成成功通知的 WeLink 消息模板
 * @param {string} reportType - 报告类型 (daily/weekly/monthly)
 * @param {Object} data - 报告数据
 * @param {string} reportUrl - 报告链接
 * @returns {string} WeLink 纯文本消息
 */
function generateSuccessWeLink(reportType, data, reportUrl) {
  const typeConfig = REPORT_TYPES[reportType] || REPORT_TYPES.daily;
  const date = data.date || data.weekStart || data.month || new Date().toISOString().split('T')[0];
  const trendingRepos = data.brief?.trending_repos || data.trending_repos || [];
  const aiInsights = data.aiInsights || {};
  
  // 计算语言分布
  const languageDist = calculateLanguageDistribution(trendingRepos);
  
  // 生成时间（短格式）
  const generatedAtShort = new Date().toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 构建 WeLink 纯文本消息
  let message = `✅ ${typeConfig.prefix}${typeConfig.name}已生成\n\n`;
  message += `📊 报告时间：${date}\n`;
  message += `🔥 热门项目：${trendingRepos.length} 个\n`;
  message += `💡 AI 洞察：${aiInsights.oneLiner || aiInsights.oneLineSummary ? '已生成' : '暂未生成'}\n`;
  message += `📝 语言分布：${formatLanguageDistributionSimple(languageDist)}\n\n`;
  
  // 添加 TOP3 项目（如果有）
  if (trendingRepos.length > 0) {
    message += `🏆 热门项目 TOP3：\n`;
    const medals = ['🥇', '🥈', '🥉'];
    trendingRepos.slice(0, 3).forEach((repo, i) => {
      const medal = medals[i];
      const name = repo.name || repo.repo || repo.fullName || 'Unknown';
      const stars = repo.todayStars || repo.stars || 0;
      message += `${medal} ${name} +${stars}⭐\n`;
    });
    message += '\n';
  }
  
  message += `🔗 查看报告：${reportUrl}\n\n`;
  message += `⏰ ${generatedAtShort}`;
  
  // 字数验证
  const validation = validateWeLinkMessage(message);
  if (!validation.valid) {
    logger.warn(validation.warning);
    message = truncateText(message, 500, false);
  }
  
  logger.debug('WeLink 成功通知模板生成', { 
    reportType, 
    charCount: validation.count 
  });
  
  return message;
}

/**
 * 生成失败通知的飞书消息模板
 * @param {string} reportType - 报告类型 (daily/weekly/monthly)
 * @param {Error} error - 错误对象
 * @param {number} retryCount - 重试次数
 * @param {number} maxRetries - 最大重试次数
 * @returns {Object} 飞书 Interactive 消息对象
 */
function generateFailureFeishu(reportType, error, retryCount, maxRetries) {
  const typeConfig = REPORT_TYPES[reportType] || REPORT_TYPES.daily;
  const failedAt = new Date().toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 错误信息截断
  const errorMessage = truncateText(error?.message || '未知错误', 200, true);
  
  // 建议操作
  const suggestions = generateFailureSuggestions(error, reportType);

  // 构建飞书 Interactive 卡片
  const message = {
    config: { 
      wide_screen_mode: true 
    },
    header: {
      title: { 
        tag: "plain_text", 
        content: `❌ ${typeConfig.prefix}${typeConfig.name}生成失败` 
      },
      subtitle: { 
        tag: "plain_text", 
        content: `${failedAt} · 重试 ${retryCount}/${maxRetries}` 
      },
      template: "red"
    },
    elements: [
      // 1. 失败时间
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `⏰ **失败时间**\n${failedAt}`
        }
      },
      { tag: "hr" },
      
      // 2. 重试次数
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `🔄 **重试次数**\n${retryCount}/${maxRetries}`
        }
      },
      { tag: "hr" },
      
      // 3. 错误信息
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `⚠️ **错误信息**\n${errorMessage}`
        }
      },
      { tag: "hr" },
      
      // 4. 建议操作
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `💡 **建议操作**\n${formatSuggestions(suggestions)}`
        }
      },
      { tag: "hr" },
      
      // 5. 手动触发按钮
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { 
              tag: "plain_text", 
              content: "🔗 手动触发" 
            },
            type: "primary",
            url: "https://github.com/your-repo/actions"
          }
        ]
      },
      
      // 6. 页脚
      {
        tag: "note",
        elements: [
          { 
            tag: "plain_text", 
            content: `💬 错误类型：${error?.name || 'Error'}` 
          }
        ]
      }
    ]
  };
  
  logger.debug('飞书失败通知模板生成', { 
    reportType, 
    errorType: error?.name 
  });
  
  return message;
}

/**
 * 生成失败通知的 WeLink 消息模板
 * @param {string} reportType - 报告类型 (daily/weekly/monthly)
 * @param {Error} error - 错误对象
 * @param {number} retryCount - 重试次数
 * @param {number} maxRetries - 最大重试次数
 * @returns {string} WeLink 纯文本消息
 */
function generateFailureWeLink(reportType, error, retryCount, maxRetries) {
  const typeConfig = REPORT_TYPES[reportType] || REPORT_TYPES.daily;
  const failedAt = new Date().toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 错误信息截断
  const errorMessage = truncateText(error?.message || '未知错误', 150, true);
  
  // 建议操作
  const suggestions = generateFailureSuggestions(error, reportType);

  // 构建 WeLink 纯文本消息
  let message = `❌ ${typeConfig.prefix}${typeConfig.name}生成失败\n\n`;
  message += `⏰ 失败时间：${failedAt}\n`;
  message += `🔄 重试次数：${retryCount}/${maxRetries}\n`;
  message += `⚠️ 错误信息：${errorMessage}\n\n`;
  message += `💡 建议操作：\n`;
  suggestions.forEach((suggestion, i) => {
    message += `${i + 1}. ${suggestion}\n`;
  });
  message += `\n🔗 手动触发：node scripts/run-once.js ${reportType}\n\n`;
  message += `⏰ ${failedAt}`;
  
  // 字数验证
  const validation = validateWeLinkMessage(message);
  if (!validation.valid) {
    logger.warn(validation.warning);
    message = truncateText(message, 500, false);
  }
  
  logger.debug('WeLink 失败通知模板生成', { 
    reportType, 
    errorType: error?.name 
  });
  
  return message;
}

/**
 * 计算语言分布
 * @param {Array} repos - 项目列表
 * @returns {Object} 语言分布对象 { JavaScript: 5, Python: 3, ... }
 */
function calculateLanguageDistribution(repos) {
  const distribution = {};
  
  repos.forEach(repo => {
    const language = repo.language || 'Unknown';
    distribution[language] = (distribution[language] || 0) + 1;
  });
  
  // 按数量排序
  return Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
}

/**
 * 格式化语言分布（飞书版）
 * @param {Object} distribution - 语言分布对象
 * @returns {string} 格式化后的字符串
 */
function formatLanguageDistribution(distribution) {
  const entries = Object.entries(distribution);
  if (entries.length === 0) return '暂无数据';
  
  // 只显示前 5 个，其余合并为"其他"
  const top5 = entries.slice(0, 5);
  const others = entries.slice(5);
  
  let result = top5.map(([lang, count]) => `${lang}(${count})`).join(', ');
  
  if (others.length > 0) {
    const otherCount = others.reduce((sum, [, count]) => sum + count, 0);
    result += `, 其他 (${otherCount})`;
  }
  
  return result;
}

/**
 * 格式化语言分布（WeLink 简版）
 * @param {Object} distribution - 语言分布对象
 * @returns {string} 格式化后的字符串
 */
function formatLanguageDistributionSimple(distribution) {
  const entries = Object.entries(distribution);
  if (entries.length === 0) return '暂无数据';
  
  // 只显示前 5 个
  return entries.slice(0, 5).map(([lang, count]) => `${lang}(${count})`).join(', ');
}

/**
 * 格式化热门项目（飞书版）
 * @param {Array} repos - 项目列表（前 3 个）
 * @returns {string} 格式化后的字符串
 */
function formatTopProjects(repos) {
  const medals = ['🥇', '🥈', '🥉'];
  return repos.map((repo, i) => {
    const medal = medals[i] || `${i + 1}️⃣`;
    const name = repo.name || repo.repo || repo.fullName || 'Unknown';
    const stars = repo.todayStars || repo.stars || 0;
    const language = repo.language || '';
    return `${medal} ${name} +${stars}⭐ ${language ? `· ${language}` : ''}`;
  }).join('\n');
}

/**
 * 生成失败建议操作
 * @param {Error} error - 错误对象
 * @param {string} reportType - 报告类型
 * @returns {Array<string>} 建议操作列表
 */
function generateFailureSuggestions(error, reportType) {
  const suggestions = [];
  
  // 根据错误类型提供针对性建议
  const errorMsg = (error?.message || '').toLowerCase();
  
  if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
    suggestions.push('检查服务器网络连接');
    suggestions.push('检查 GitHub 访问状态');
  } else if (errorMsg.includes('api') || errorMsg.includes('token') || errorMsg.includes('auth')) {
    suggestions.push('检查 API Token 是否有效');
    suggestions.push('验证 API 密钥配置');
  } else if (errorMsg.includes('parse') || errorMsg.includes('json')) {
    suggestions.push('检查数据格式是否正确');
    suggestions.push('验证 API 响应内容');
  } else {
    suggestions.push('检查服务器网络连接');
    suggestions.push('查看完整日志定位问题');
  }
  
  suggestions.push('稍后手动触发重试');
  
  return suggestions;
}

/**
 * 格式化建议操作（飞书版）
 * @param {Array<string>} suggestions - 建议操作列表
 * @returns {string} 格式化后的字符串
 */
function formatSuggestions(suggestions) {
  return suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

/**
 * 验证 WeLink 消息字数
 * @param {string} message - 消息文本
 * @returns {Object} 验证结果
 */
function validateWeLinkMessage(message) {
  const count = message.length;
  const result = {
    valid: count <= 500 && count >= 1,
    count
  };
  
  if (count > 500) {
    result.warning = `WeLink 消息超长：${count}字（限制 500 字）`;
  } else if (count < 1) {
    result.warning = 'WeLink 消息内容为空';
  }
  
  return result;
}

/**
 * 截断文本
 * @param {string} text - 原文本
 * @param {number} maxLength - 最大长度
 * @param {boolean} addEllipsis - 是否添加省略号
 * @returns {string} 处理后的文本
 */
function truncateText(text, maxLength, addEllipsis = true) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + (addEllipsis ? '...' : '');
}

module.exports = {
  // 成功通知模板
  generateSuccessFeishu,
  generateSuccessWeLink,
  
  // 失败通知模板
  generateFailureFeishu,
  generateFailureWeLink,
  
  // 辅助方法
  calculateLanguageDistribution,
  formatLanguageDistribution,
  formatLanguageDistributionSimple,
  formatTopProjects,
  generateFailureSuggestions,
  formatSuggestions,
  validateWeLinkMessage,
  truncateText,
  
  // 报告类型配置
  REPORT_TYPES
};
