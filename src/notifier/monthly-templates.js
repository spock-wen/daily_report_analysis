/**
 * 月报推送模板模块
 * 负责生成飞书和 WeLink 两个平台的月报消息
 */

const logger = require('../utils/logger');

/**
 * 获取月份范围
 * @param {string} month - 月份标识 (2026-03)
 * @returns {string} 月份范围描述
 */
function getMonthRange(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0);

  const options = { year: 'numeric', month: 'long' };
  return monthStart.toLocaleDateString('zh-CN', options);
}

/**
 * 缩短文本
 */
function truncateText(text, maxLength, addEllipsis = true) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + (addEllipsis ? '...' : '');
}

/**
 * 格式化飞书月报主题
 */
function formatFeishuMonthlyTheme(monthlyTheme) {
  if (!monthlyTheme) return '暂无数据';
  return `${monthlyTheme.oneLiner}\n\n${truncateText(monthlyTheme.detailed, 200)}`;
}

/**
 * 格式化飞书趋势演变
 */
function formatFeishuTrendEvolution(trendEvolution) {
  if (!trendEvolution || !Array.isArray(trendEvolution) || trendEvolution.length === 0) {
    return '暂无数据';
  }

  return trendEvolution.map(item => {
    const keyProjects = item.keyProjects && item.keyProjects.length > 0
      ? `\n   关键项目：${item.keyProjects.join('、')}`
      : '';
    return `• ${item.period}：${item.theme}${keyProjects}`;
  }).join('\n');
}

/**
 * 格式化飞书长期价值项目
 */
function formatFeishuLongTermValue(longTermValue) {
  if (!longTermValue || !Array.isArray(longTermValue) || longTermValue.length === 0) {
    return '暂无数据';
  }

  return longTermValue.slice(0, 3).map(project => {
    return `• [${project.repo}](https://github.com/${project.repo}) (${project.score}分)\n  ${truncateText(project.value, 50)}`;
  }).join('\n');
}

/**
 * 格式化飞书新兴领域
 */
function formatFeishuEmergingFields(emergingFields) {
  if (!emergingFields || !Array.isArray(emergingFields) || emergingFields.length === 0) {
    return '暂无数据';
  }

  return emergingFields.slice(0, 3).map(field => {
    const trend = field.trend ? ` [${field.trend}]` : '';
    return `• ${field.field}${trend}`;
  }).join('\n');
}

/**
 * 格式化行动建议
 */
function formatFeishuRecommendations(recommendations) {
  if (!recommendations || !Array.isArray(recommendations)) {
    return '暂无数据';
  }

  return recommendations.slice(0, 3).map(rec => `• ${truncateText(rec, 60)}`).join('\n');
}

/**
 * 生成飞书版月报消息
 * @param {Object} monthlyData - 月报原始数据
 * @param {Object} insights - AI 洞察数据
 * @returns {Object} 飞书 Interactive 消息 JSON
 */
function generateFeishuMonthly(monthlyData, insights) {
  // 降级处理
  if (!insights) {
    logger.warn('月报洞察数据缺失，使用降级模式生成飞书月报');
    insights = {
      monthlyTheme: {
        oneLiner: `${monthlyData.aggregation?.totalProjects || 0}个项目上榜`,
        detailed: '详细洞察数据暂不可用'
      },
      trendEvolution: [],
      longTermValue: [],
      emergingFields: [],
      nextMonthForecast: '暂无预测'
    };
  }

  const month = monthlyData.month || monthlyData.date;
  const monthRange = getMonthRange(month);
  const reportUrl = `https://report.wenspock.site/monthly/github-monthly-${month.replace('-', '')}.html`;
  const generatedAt = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 从洞察数据中提取所有项目名
  const repoNames = new Set();

  if (insights.longTermValue && Array.isArray(insights.longTermValue)) {
    insights.longTermValue.forEach(p => {
      if (p.repo && p.repo.includes('/')) {
        repoNames.add(p.repo);
      }
    });
  }

  if (insights.emergingFields && Array.isArray(insights.emergingFields)) {
    insights.emergingFields.forEach(field => {
      if (field.projects && Array.isArray(field.projects)) {
        field.projects.forEach(proj => {
          if (proj && typeof proj === 'string' && proj.includes('/')) {
            repoNames.add(proj);
          }
        });
      }
    });
  }

  // 将文本中的项目名转换为链接
  const linkifyRepos = (text) => {
    if (!text) return text;
    let result = text;
    repoNames.forEach(repoName => {
      // 跳过已经包含 markdown 链接格式的 repo（如 [org/repo](url)）
      const alreadyLinked = new RegExp(`\\[${repoName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(https?://`).test(text);
      if (alreadyLinked) {
        return;
      }
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
        content: "📊 GitHub 月报洞察"
      },
      subtitle: {
        tag: "plain_text",
        content: monthRange
      },
      template: "purple"
    },
    elements: [
      // 1. 月度核心主题
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**🎯 月度核心主题**\n${linkifyRepos(insights.monthlyTheme?.oneLiner)}\n\n${linkifyRepos(truncateText(insights.monthlyTheme?.detailed, 150))}`
        }
      },
      { tag: "hr" },

      // 2. 趋势演变
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**📈 趋势演变**\n${linkifyRepos(formatFeishuTrendEvolution(insights.trendEvolution))}`
        }
      },
      { tag: "hr" },

      // 3. 长期价值 TOP 项目
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**⭐ 长期价值 TOP 项目**\n${linkifyRepos(formatFeishuLongTermValue(insights.longTermValue))}`
        }
      },
      { tag: "hr" },

      // 4. 新兴领域
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**🆕 新兴领域**\n${linkifyRepos(formatFeishuEmergingFields(insights.emergingFields))}`
        }
      },
      { tag: "hr" },

      // 5. 下月预测
      insights.nextMonthForecast ? {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**🔮 下月预测**\n${linkifyRepos(truncateText(insights.nextMonthForecast, 150))}`
        }
      } : null,
      { tag: "hr" },

      // 6. 查看完整报告按钮
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "📋 查看完整报告"
            },
            url: reportUrl,
            type: "primary",
            multi_url_support: true
          }
        ]
      },
      { tag: "note", elements: [{ tag: "plain_text", content: `⏰ 生成时间：${generatedAt}` }] }
    ].filter(Boolean)
  };

  // 验证消息大小（飞书限制：单个 text content 不超过 2000 字符）
  const totalLength = message.elements
    .filter(e => e.text?.content)
    .reduce((sum, e) => sum + e.text.content.length, 0);
  logger.info('飞书月报模板生成成功', { month, elementsCount: message.elements.length, totalContentLength: totalLength });
  return message;
}

/**
 * 生成 WeLink 版月报消息
 * @param {Object} monthlyData - 月报原始数据
 * @param {Object} insights - AI 洞察数据
 * @returns {string} WeLink 消息文本
 */
function generateWeLinkMonthly(monthlyData, insights) {
  // 降级处理
  if (!insights) {
    logger.warn('月报洞察数据缺失，使用降级模式生成 WeLink 月报');
    insights = {
      monthlyTheme: {
        oneLiner: `${monthlyData.aggregation?.totalProjects || 0}个项目上榜`,
        detailed: '详细洞察数据暂不可用'
      },
      longTermValue: [],
      emergingFields: []
    };
  }

  const month = monthlyData.month || monthlyData.date;
  const monthRange = getMonthRange(month);
  const reportUrl = `https://report.wenspock.site/monthly/github-monthly-${month.replace('-', '')}.html`;

  // 构建消息内容（WeLink 限制 500 字）
  let content = `📊 GitHub 月报洞察\n${monthRange}\n\n`;
  content += `🎯 ${insights.monthlyTheme?.oneLiner || '暂无主题'}\n\n`;

  if (insights.longTermValue && insights.longTermValue.length > 0) {
    content += `⭐ TOP 项目：${insights.longTermValue.slice(0, 2).map(p => p.repo).join('、')}\n\n`;
  }

  if (insights.emergingFields && insights.emergingFields.length > 0) {
    content += `🆕 新兴领域：${insights.emergingFields.slice(0, 2).map(f => f.field).join('、')}\n\n`;
  }

  content += `📋 完整报告：${reportUrl}`;

  const validation = { count: content.length, valid: content.length <= 500 };
  logger.info('WeLink 月报模板生成成功', { month, charCount: content.length });

  return content;
}

module.exports = {
  generateFeishuMonthly,
  generateWeLinkMonthly
};
