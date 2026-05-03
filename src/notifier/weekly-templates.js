/**
 * 周报推送模板模块
 * 负责生成飞书和 WeLink 两个平台的周报消息
 */

const logger = require('../utils/logger');

/**
 * 获取周日期范围
 * @param {string} week - 周标识 (2026-W11 或 2026-03-10)
 * @param {boolean} short - 是否返回短格式
 * @returns {string} 日期范围
 */
function getWeekRange(week, short = false) {
  // 解析周标识
  const match = week.match(/(\d{4})-W(\d{2})/);
  if (!match) {
    throw new Error(`Invalid week format: ${week}`);
  }
  
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);
  
  // 计算周一日期（ISO 周日期系统）
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  // ISO 周从周一开始，调整偏移
  const mondayOffset = dayOfWeek === 0 ? 1 : dayOfWeek;
  const monday = new Date(year, 0, 1 + (weekNum - 1) * 7 + (1 - mondayOffset));
  
  // 计算周日日期
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  
  if (short) {
    return `${monday.getMonth() + 1}/${monday.getDate()}-${sunday.getMonth() + 1}/${sunday.getDate()}`;
  }
  
  return `${year}年${monday.getMonth() + 1}月${monday.getDate()}日 - ${year}年${sunday.getMonth() + 1}月${sunday.getDate()}日`;
}

/**
 * 获取周数
 * @param {string} week - 周标识
 * @returns {string} 周数
 */
function getWeekNumber(week) {
  const match = week.match(/W(\d{2})/);
  return match ? match[1] : '01';
}

/**
 * 缩短文本（超长时截断）
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

/**
 * 提取一句话摘要（用于 WeLink 版）
 * @param {string} text - 原文本
 * @returns {string} 摘要（约 30 字）
 */
function extractOneLiner(text) {
  if (!text) return '';
  // 提取第一句或前 30 个字
  const firstSentence = text.split(/[。！？.!?]/)[0];
  return truncateText(firstSentence, 30, true);
}

/**
 * 验证 WeLink 消息字数
 * @param {string} message - 消息文本
 * @returns {Object} { valid: boolean, count: number, warning?: string }
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
 * 从项目列表生成简化洞察（降级模式）
 * @param {Array} projects - 项目列表
 * @returns {Object} 简化的洞察数据
 */
function generateDegradedInsights(projects) {
  const projectList = projects || [];
  
  return {
    weeklyTheme: {
      oneLiner: `本周 ${projectList.length} 个项目 trending`,
      detailed: '详细洞察数据暂不可用'
    },
    highlights: projectList.slice(0, 3).map(p => p.name || p.repo || p.fullName || 'Unknown'),
    topProjects: projectList.slice(0, 1).map(p => ({
      repo: p.name || p.repo || p.fullName || 'unknown/repo',
      category: '技术热门',
      reason: '基于项目热度自动选择',
      value: '查看完整报告了解详情',
      useCases: []
    })),
    trends: {
      shortTerm: []
    },
    emergingFields: [],
    recommendations: {
      developers: ['查看完整报告了解更多'],
      enterprises: ['查看完整报告了解更多']
    }
  };
}

/**
 * 格式化飞书热点内容
 * @param {Array} highlights - 热点列表
 * @returns {string} 格式化后的内容
 */
function formatFeishuHighlights(highlights) {
  if (!highlights || highlights.length === 0) {
    return '暂无数据';
  }
  
  return highlights.slice(0, 3).map(h => `• ${h}`).join('\n');
}

/**
 * 格式化飞书趋势内容
 * @param {Array} trends - 趋势列表
 * @returns {string} 格式化后的内容
 */
function formatFeishuTrends(trends) {
  if (!trends || trends.length === 0) {
    return '暂无数据';
  }
  
  return trends.slice(0, 2).map(t => `• ${t}`).join('\n');
}

/**
 * 格式化飞书新兴领域内容
 * @param {Array} emergingFields - 新兴领域列表
 * @returns {string} 格式化后的内容
 */
function formatFeishuEmergingFields(emergingFields) {
  if (!emergingFields || emergingFields.length === 0) {
    return '暂无数据';
  }
  
  return emergingFields.slice(0, 2).map(field => 
    `**${field.field}**：${field.description}`
  ).join('\n\n');
}

/**
 * 格式化飞书建议内容
 * @param {Array} recommendations - 建议列表
 * @returns {string} 格式化后的内容
 */
function formatFeishuRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return '暂无数据';
  }
  
  return recommendations.slice(0, 2).map(r => `• ${r}`).join('\n');
}

/**
 * 生成飞书版周报消息
 * @param {Object} weeklyData - 周报原始数据
 * @param {Object} insights - 洞察数据（可选，缺失时降级）
 * @returns {Object} 飞书 Interactive 消息 JSON
 */
function generateFeishuWeekly(weeklyData, insights) {
  // 降级处理
  if (!insights) {
    logger.warn('洞察数据缺失，使用降级模式生成飞书周报');
    insights = generateDegradedInsights(weeklyData.projects);
  }
  
  const week = weeklyData.week || weeklyData.date;
  const weekRange = getWeekRange(week, false);
  const weekNumber = getWeekNumber(week);
  const reportUrl = `https://report.wenspock.site/weekly/weekly-${week}.html`;
  const generatedAt = new Date().toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // 提取所有项目名（owner/repo 格式），用于精确匹配链接
  const repoNames = new Set();
  
  // 从 topProjects 提取
  if (insights.topProjects && Array.isArray(insights.topProjects)) {
    insights.topProjects.forEach(p => {
      if (p.repo && p.repo.includes('/')) {
        repoNames.add(p.repo);
      }
    });
  }
  
  // 从 emergingFields 提取
  if (insights.emergingFields && Array.isArray(insights.emergingFields)) {
    insights.emergingFields.forEach(field => {
      if (field.projects && Array.isArray(field.projects)) {
        field.projects.forEach(proj => {
          if (proj && proj.includes('/')) {
            repoNames.add(proj);
          }
        });
      }
    });
  }
  
  // 从 highlights 提取（如果有 owner/repo 格式）
  if (insights.highlights && Array.isArray(insights.highlights)) {
    const repoPattern = /[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g;
    insights.highlights.forEach(h => {
      const matches = h.match(repoPattern);
      if (matches) {
        matches.forEach(m => repoNames.add(m));
      }
    });
  }
  
  // 将文本中的项目名转换为链接
  const linkifyRepos = (text) => {
    if (!text) return text;
    let result = text;
    repoNames.forEach(repoName => {
      // 使用词边界匹配，避免部分匹配
      const regex = new RegExp(`\\b${repoName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      result = result.replace(regex, `[${repoName}](https://github.com/${repoName})`);
    });
    return result;
  };
  
  // 构建飞书 Interactive 卡片
  const message = {
    config: { 
      wide_screen_mode: true 
    },
    header: {
      title: { 
        tag: "plain_text", 
        content: "📊 GitHub 周报洞察" 
      },
      subtitle: { 
        tag: "plain_text", 
        content: `${weekRange} · 第${weekNumber}周` 
      },
      template: "blue"
    },
    elements: [
      // 1. 本周核心主题
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**🎯 本周核心主题**\n${linkifyRepos(insights.weeklyTheme.oneLiner)}\n\n${linkifyRepos(insights.weeklyTheme.detailed)}`
        }
      },
      { tag: "hr" },
      
      // 2. 关键热点
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**🔥 关键热点**\n${linkifyRepos(formatFeishuHighlights(insights.highlights))}`
        }
      },
      { tag: "hr" },
      
      // 3. 重点技术突破（只显示 top 1）
      ...(insights.topProjects && insights.topProjects.length > 0 ? [{
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**⭐ 重点技术突破**\n[${insights.topProjects[0].repo}](https://github.com/${insights.topProjects[0].repo}) · ${insights.topProjects[0].category}\n\n**核心价值**：${linkifyRepos(insights.topProjects[0].value)}\n\n**技术亮点**：${linkifyRepos(insights.topProjects[0].reason)}`
        }
      }, { tag: "hr" }] : []),
      
      // 4. 短期趋势预判
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**🔮 短期趋势预判**\n${linkifyRepos(formatFeishuTrends(insights.trends.shortTerm))}`
        }
      },
      { tag: "hr" },
      
      // 5. 新兴领域
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**🆕 新兴领域**\n${linkifyRepos(formatFeishuEmergingFields(insights.emergingFields))}`
        }
      },
      { tag: "hr" },
      
      // 6. 行动建议
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**💡 行动建议**\n\n👨‍💻 **开发者**：\n${linkifyRepos(formatFeishuRecommendations(insights.recommendations.developers))}\n\n🏢 **企业**：\n${linkifyRepos(formatFeishuRecommendations(insights.recommendations.enterprises))}`
        }
      },
      { tag: "hr" },
      
      // 7. 查看完整报告按钮
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { 
              tag: "plain_text", 
              content: "📋 查看完整报告" 
            },
            type: "primary",
            url: reportUrl
          }
        ]
      },
      
      // 8. 页脚
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
  
  logger.info('飞书周报模板生成成功', { 
    week, 
    elementsCount: message.elements.length 
  });
  
  return message;
}

/**
 * 生成 WeLink 版周报消息
 * @param {Object} weeklyData - 周报原始数据
 * @param {Object} insights - 洞察数据（可选，缺失时降级）
 * @returns {string} WeLink 纯文本消息
 */
function generateWeLinkWeekly(weeklyData, insights) {
  // 降级处理
  if (!insights) {
    logger.warn('洞察数据缺失，使用降级模式生成 WeLink 周报');
    insights = generateDegradedInsights(weeklyData.projects);
  }
  
  const week = weeklyData.week || weeklyData.date;
  const weekRangeShort = getWeekRange(week, true);
  const weekNumber = getWeekNumber(week);
  const reportUrl = `https://report.wenspock.site/weekly/weekly-${week}.html`;
  const generatedAtShort = new Date().toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(/^\d{2}-/, ''); // 移除年份
  
  // 提取 3 个关键信号
  const signal1 = extractOneLiner(insights.highlights[0]);
  const signal2 = extractOneLiner(insights.highlights[1]);
  const signal3 = extractOneLiner(insights.trends.shortTerm[0]);
  
  // 提取新兴领域
  const emergingField = insights.emergingFields[0]?.field || '暂无';
  const description = insights.emergingFields[0]?.description || '';
  
  // 构建 WeLink 纯文本消息（移除建议部分）
  let message = `📊 GitHub 趋势周报 · 第${weekNumber}周\n`;
  message += `${weekRangeShort}\n\n`;
  message += `🎯 ${insights.weeklyTheme.oneLiner}\n\n`;
  message += `🔥 3 个关键信号：\n`;
  message += `1️⃣ ${signal1}\n`;
  message += `2️⃣ ${signal2}\n`;
  message += `3️⃣ ${signal3}\n\n`;
  message += `💡 ${emergingField}：${description}\n\n`;
  message += `📋 ${reportUrl}\n\n`;
  message += `⏰ ${generatedAtShort}`;
  
  // 字数验证（WeLink 接口限制：1-500 字）
  const validation = validateWeLinkMessage(message);
  if (!validation.valid) {
    logger.warn(validation.warning);
    // 自动截断
    message = truncateText(message, 500, false);
  }
  
  logger.info('WeLink 周报模板生成成功', { 
    week, 
    charCount: validation.count 
  });
  
  return message;
}

module.exports = {
  // 主要方法
  generateFeishuWeekly,
  generateWeLinkWeekly,
  
  // 辅助方法
  getWeekRange,
  getWeekNumber,
  truncateText,
  extractOneLiner,
  validateWeLinkMessage,
  
  // 降级方法
  generateDegradedInsights
};
