// 使用全局 fetch（Node 18+ 原生支持）
const fetch = globalThis.fetch;
const https = require('https');

const logger = require('../utils/logger');
const { getConfig, getEnvBool } = require('../utils/config');
const { generateFeishuWeekly, generateWeLinkWeekly } = require('./weekly-templates');

// 加载配置
const config = getConfig();

// 通知服务启用状态
const FEISHU_ENABLED = getEnvBool('FEISHU_ENABLED', true);
const WELINK_ENABLED = getEnvBool('WELINK_ENABLED', false);

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

// Token 缓存
let cachedToken = null;
let tokenExpireTime = 0;

/**
 * 推送通知发送器 - 负责发送飞书和 WeLink 通知
 */
class MessageSender {
  /**
   * 发送飞书通知（使用 API 认证方式）
   * @param {Object} options - 发送选项
   * @returns {Promise<Object>} 发送结果
   */
  async sendFeishu(options) {
    if (!FEISHU_ENABLED) {
      logger.warn('飞书通知已禁用，跳过发送');
      return { success: false, platform: 'feishu', error: '飞书通知已禁用' };
    }

    try {
      logger.info('发送飞书通知...', { type: options.type, title: options.title });

      // 如果已有 content，直接使用；否则构建飞书消息
      const message = options.content 
        ? this.buildFeishuMessageWithContent(options)
        : this.buildFeishuMessage(options);
      
      const accessToken = await this.getFeishuAccessToken();
      const receiveId = config.notifier.feishu.receiveId;
      const receiveIdType = config.notifier.feishu.receiveIdType || 'open_id';
      
      const result = await this.sendFeishuMessage(accessToken, receiveId, receiveIdType, message);

      logger.success('飞书通知发送成功', { type: options.type });
      return { success: true, platform: 'feishu', result };
    } catch (error) {
      logger.error(`飞书通知发送失败：${error.message}`, options);
      return { success: false, platform: 'feishu', error: error.message };
    }
  }

  /**
   * 获取飞书 access token（带缓存）
   * @returns {Promise<string>} access token
   */
  async getFeishuAccessToken() {
    if (cachedToken && Date.now() < tokenExpireTime) {
      return cachedToken;
    }

    const { appId, appSecret } = config.notifier.feishu;

    let response;
    try {
      response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret
        }),
        timeout: 15000
      });
    } catch (error) {
      throw new Error(`获取飞书 token 请求失败：${error.message}`);
    }

    if (!response.ok) {
      throw new Error(`获取飞书 token 失败：HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`获取飞书 token 失败：${result.msg}`);
    }

    cachedToken = result.tenant_access_token;
    tokenExpireTime = Date.now() + (result.expire - 300) * 1000;

    return cachedToken;
  }

  /**
   * 发送飞书消息
   * @param {string} accessToken - access token
   * @param {string} receiveId - 接收者 ID
   * @param {string} receiveIdType - ID 类型
   * @param {Object} message - 消息内容
   * @returns {Promise<Object>} 响应结果
   */
  async sendFeishuMessage(accessToken, receiveId, receiveIdType, message) {
    const payload = {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(message)
    };

    let response;
    try {
      response = await fetch(`${FEISHU_API_BASE}/im/v1/messages?receive_id_type=${receiveIdType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload),
        timeout: 15000
      });
    } catch (error) {
      throw new Error(`飞书消息请求失败：${error.message}`);
    }

    if (!response.ok) {
      throw new Error(`飞书消息发送失败：HTTP ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`飞书推送失败：${result.msg || JSON.stringify(result)}`);
    }

    return result;
  }

  /**
   * 发送 WeLink 通知（支持多个 webhook URL）
   * @param {Object} options - 发送选项
   * @returns {Promise<Array>} 发送结果数组
   */
  async sendWeLink(options) {
    if (!WELINK_ENABLED) {
      logger.warn('WeLink 通知已禁用，跳过发送');
      return { success: false, platform: 'welink', error: 'WeLink 通知已禁用' };
    }

    try {
      logger.info('发送 WeLink 通知...', { type: options.type, title: options.title });

      const message = this.buildWeLinkMessage(options);
      const webhookUrls = config.notifier.welink.webhookUrls.split(',').map(url => url.trim());
      
      logger.debug('WeLink 配置', { webhookUrls, messageText: message.content.text.substring(0, 50) });
      
      const results = await Promise.all(
        webhookUrls.map(url => this.sendWebhookRequest(url, message))
      );

      logger.debug('WeLink 请求结果', { results });
      
      // 检查每个结果的实际状态
      const processedResults = results.map((result, index) => {
        // sendWebhookRequest 返回的结果中，success 字段表示是否成功
        const isSuccess = result.success !== false && 
                         (result.code === '0' || result.code === 0 || result.errcode === 0 || result.result?.code === '0');
        
        if (isSuccess) {
          logger.info(`WeLink 群组 ${index + 1} 推送成功`, { webhookUrl: webhookUrls[index] });
        } else {
          logger.warn(`WeLink 群组 ${index + 1} 推送失败`, { 
            webhookUrl: webhookUrls[index],
            result 
          });
        }
        
        return {
          success: isSuccess,
          platform: 'welink',
          webhookIndex: index,
          webhookUrl: webhookUrls[index],
          result,
          error: isSuccess ? null : (result.error || 'WeLink server error')
        };
      });

      const successCount = processedResults.filter(r => r.success).length;
      if (successCount > 0) {
        logger.success(`WeLink 通知发送成功：${successCount}/${results.length}`, { type: options.type });
      } else {
        logger.error(`WeLink 通知全部失败`, { type: options.type });
      }
      
      return processedResults;
    } catch (error) {
      logger.error(`WeLink 通知发送异常：${error.message}`, { 
        type: options.type, 
        stack: error.stack 
      });
      return [{ success: false, platform: 'welink', error: error.message }];
    }
  }

  /**
   * 同时发送飞书和 WeLink 通知
   * @param {Object} options - 发送选项
   * @returns {Promise<Array>} 发送结果
   */
  async sendAll(options) {
    // 顺序执行，避免共享状态问题
    const [feishuResult, welinkResult] = await Promise.all([
      this.sendFeishu({ ...options }),
      this.sendWeLink({ ...options })
    ]);
    return [feishuResult, welinkResult].flat();
  }

  /**
   * 发送周报到所有平台
   * @param {Object} weeklyData - 周报数据
   * @param {Object} insights - 洞察数据
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} { feishu: Object, welink: Object, logs: string[] }
   */
  async sendWeeklyAll(weeklyData, insights, options = {}) {
    const results = {
      feishu: null,
      welink: null,
      logs: []
    };
    
    try {
      // 生成内容
      const content = this.generateNotificationContent('weekly', weeklyData, insights);
      
      // 发送飞书
      if (options.platforms?.includes('feishu') || !options.platforms) {
        const feishuOptions = {
          type: 'weekly',
          title: 'GitHub 周报洞察',
          content: content.feishu
        };
        
        results.feishu = await this.sendFeishu(feishuOptions);
        results.logs.push(`Feishu: ${results.feishu.success ? 'success' : 'failed'}`);
        
        if (results.feishu.success) {
          logger.info('✅ Feishu weekly notification sent successfully');
        } else {
          logger.error('❌ Feishu weekly notification failed', results.feishu.error);
        }
      }
      
      // 发送 WeLink
      if (options.platforms?.includes('welink') || !options.platforms) {
        const welinkOptions = {
          type: 'weekly',
          title: 'GitHub 趋势周报',
          content: content.welink
        };
        
        results.welink = await this.sendWeLink(welinkOptions);
        
        // WeLink 返回的是数组，检查是否有成功的
        const successCount = Array.isArray(results.welink) 
          ? results.welink.filter(r => r.success).length 
          : (results.welink.success ? 1 : 0);
        
        results.logs.push(`WeLink: ${successCount > 0 ? 'success' : 'failed'}`);
        
        if (successCount > 0) {
          logger.info('✅ WeLink weekly notification sent successfully');
        } else {
          logger.error('❌ WeLink weekly notification failed', results.welink);
        }
      }
      
    } catch (error) {
      logger.error('sendWeeklyAll error:', error);
      throw error;
    }
    
    return results;
  }

  /**
   * 构建飞书消息（使用已有 content）
   * @param {Object} options - 消息选项
   * @returns {Object} 飞书消息对象
   */
  buildFeishuMessageWithContent(options) {
    const { title, content } = options;

    // 如果 content 已经是 Interactive 卡片对象，直接返回
    if (content && typeof content === 'object' && content.config && content.elements) {
      return content;
    }

    // 否则使用文本消息格式
    const message = {
      elements: [
        {
          tag: 'markdown',
          content: `${title}\n\n${content}`
        }
      ]
    };

    return message;
  }

  /**
   * 构建飞书消息（旧版兼容）
   * @param {Object} options - 消息选项
   * @returns {Object} 飞书消息对象
   */
  buildFeishuMessage(options) {
    const { type, title, content, reportUrl } = options;

    // 使用飞书文本消息格式，直接展示完整内容
    const message = {
      elements: [
        {
          tag: 'markdown',
          content: `${title}\n\n${content}`
        }
      ]
    };

    return message;
  }

  /**
   * 构建 WeLink 消息（文本格式）
   * @param {Object} options - 消息选项
   * @returns {Object} WeLink 消息对象
   */
  buildWeLinkMessage(options) {
    const { type, title, content, reportUrl, top5, insight } = options;

    // 生成时间戳和 UUID
    const timeStamp = Date.now();
    const uuid = this.generateUUID();

    // WeLink 文本消息最大长度限制
    const WELINK_MAX_LENGTH = 500;

    // 构建精简的 WeLink 消息（不直接复用飞书内容）
    let messageText = `${title}\n\n`;
    
    // 今日概览
    if (options.summary) {
      messageText += `📊 ${options.summary}\n\n`;
    }
    
    // TOP5 项目
    if (top5 && top5.length > 0) {
      messageText += `🔥 TOP5：\n`;
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      top5.forEach((repo, i) => {
        const medal = medals[i] || `${i + 1}️⃣`;
        const stars = repo.todayStars || repo.stars || 0;
        messageText += `${medal} ${repo.name} +${stars}⭐\n`;
      });
      messageText += '\n';
    }
    
    // 核心洞察（截断到80字）
    if (insight) {
      const truncatedInsight = insight.length > 80 ? insight.substring(0, 80) + '...' : insight;
      messageText += `💡 ${truncatedInsight}\n\n`;
    }
    
    // 报告链接
    messageText += `📋 ${reportUrl}`;

    // 确保消息不超过 WeLink 限制
    if (messageText.length > WELINK_MAX_LENGTH) {
      messageText = messageText.substring(0, WELINK_MAX_LENGTH - 3) + '...';
    }

    // WeLink 消息格式（文本类型）
    const message = {
      messageType: 'text',
      content: {
        text: messageText
      },
      timeStamp,
      uuid
    };

    logger.debug('WeLink 消息构建完成', { textLength: messageText.length });
    return message;
  }

  /**
   * 生成 UUID
   * @returns {string} UUID 字符串
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 发送 Webhook 请求（使用 fetch API）
   * @param {string} webhookUrl - Webhook URL
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} 响应结果
   */
  async sendWebhookRequest(webhookUrl, data) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Charset': 'UTF-8'
        },
        body: JSON.stringify(data),
        timeout: 15000
      });

      const responseData = await response.text();
      
      try {
        const result = JSON.parse(responseData);
        
        // 检查 WeLink 返回码
        if (result.code === '0' || result.code === 0 || result.errcode === 0) {
          return result;
        } else {
          return { 
            success: false, 
            result, 
            error: `WeLink return code: ${result.code || result.errcode}` 
          };
        }
      } catch (error) {
        // 解析失败，可能是 HTML 错误页面
        return { 
          success: false, 
          error: 'Response parse error', 
          raw: responseData.substring(0, 200) 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Request failed: ${error.message}` 
      };
    }
  }

  /**
   * 生成报告通知内容
   * @param {string} type - 报告类型 (daily/weekly/monthly)
   * @param {Object} data - 报告数据
   * @param {Object} insights - 洞察数据（周报专用）
   * @returns {Object} 通知内容
   */
  generateNotificationContent(type, data, insights) {
    // 周报专用逻辑
    if (type === 'weekly' && insights) {
      return {
        type,
        feishu: generateFeishuWeekly(data, insights),
        welink: generateWeLinkWeekly(data, insights)
      };
    }
    
    const typeNames = {
      daily: '日报',
      weekly: '周报',
      monthly: '月报'
    };

    const date = data.date || data.weekStart || data.month;
    // 支持多种数据格式：projects（新格式）、trending_repos、brief.trending_repos
    const trendingRepos = data.projects || data.brief?.trending_repos || data.trending_repos || [];
    const aiInsights = data.aiInsights || {};
    
    // 构建标题
    const title = `🚀 GitHub 热门项目${typeNames[type]} (${date})`;
    
    // 按今日 stars 排序，获取 TOP5
    const sortedRepos = [...trendingRepos].sort((a, b) => {
      const aStars = parseInt(a.todayStars) || parseInt(a.stars) || 0;
      const bStars = parseInt(b.todayStars) || parseInt(b.stars) || 0;
      return bStars - aStars;
    });
    const top5 = sortedRepos.slice(0, 5).map(repo => ({
      name: repo.name || repo.repo || repo.fullName,
      todayStars: parseInt(repo.todayStars) || parseInt(repo.stars) || 0,
      url: repo.url || `https://github.com/${repo.name}`
    }));
    
    // 提取核心洞察（一句话总结）
    let insight = '';
    if (aiInsights.oneLiner) {
      insight = aiInsights.oneLiner.substring(0, 100);
    } else if (aiInsights.oneLineSummary) {
      insight = aiInsights.oneLineSummary.substring(0, 100);
    } else if (aiInsights.summary) {
      insight = aiInsights.summary.substring(0, 100);
    }
    
    // 构建今日概览
    const summary = `${trendingRepos.length} 个热门项目`;
    
    // 提取所有项目名（owner/repo 格式），用于精确匹配链接
    const repoNames = new Set();
    trendingRepos.forEach(r => {
      const fullName = r.fullName || r.repo || r.name;
      if (fullName && fullName.includes('/')) {
        repoNames.add(fullName);
      }
    });
    
    // 构建报告链接
    const reportUrl = this.buildReportUrl(type, date);
    
    return {
      type,
      title,
      summary,
      top5,
      insight,
      reportUrl,
      aiInsights,
      repoNames,
      // 保留完整 content 用于飞书
      content: this.buildFeishuContent(type, trendingRepos, aiInsights, reportUrl)
    };
  }

  /**
   * 构建飞书消息内容（详细版）
   */
  buildFeishuContent(type, trendingRepos, aiInsights, reportUrl) {
    // 计算 AI 项目占比
    const aiCount = trendingRepos.filter(r => 
      (r.aiRelated === true) || 
      (r.language && ['Python', 'TypeScript', 'Jupyter Notebook', 'Rust'].includes(r.language))
    ).length;
    const aiPercentage = trendingRepos.length > 0 ? Math.round(aiCount / trendingRepos.length * 100) : 0;
    
    // 提取所有项目名（owner/repo 格式），用于精确匹配链接
    const repoNames = new Set();
    trendingRepos.forEach(r => {
      // 优先使用 fullName 或 repo 字段（包含完整的 owner/repo 格式）
      const fullName = r.fullName || r.repo || r.name;
      if (fullName && fullName.includes('/')) {
        repoNames.add(fullName);
      }
    });
    
    // 将文本中的项目名转换为链接（只匹配实际存在的项目）
    const linkifyRepos = (text) => {
      let result = text;
      // 按 repoName 长度降序排序，避免短名称匹配到长名称的一部分
      const sortedRepoNames = Array.from(repoNames).sort((a, b) => b.length - a.length);
      sortedRepoNames.forEach(repoName => {
        // 使用前后瞻断言确保完整匹配，避免部分匹配
        // 对于 owner/repo 格式，使用更精确的匹配模式
        const escapedRepoName = repoName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 匹配项目名，前面是行首或空格/标点，后面是行尾或空格/标点
        const regex = new RegExp(`(^|[\\s\\(\\[\\{])${escapedRepoName}($|[\\s\\)\\]\\},.;:])`, 'g');
        result = result.replace(regex, (match, prefix, suffix) => {
          return `${prefix}[${repoName}](https://github.com/${repoName})${suffix}`;
        });
      });
      return result;
    };
    
    let content = `📊 今日概览\n`;
    content += `今日新增 ${trendingRepos.length} 个热门项目，${aiPercentage}% 为 AI 相关\n\n`;
    
    // 核心洞察
    if (aiInsights.oneLiner || aiInsights.oneLineSummary) {
      content += `💡 核心洞察\n`;
      content += `${aiInsights.oneLiner || aiInsights.oneLineSummary}\n\n`;
    }
    
    // 炒作指数
    if (aiInsights.hypeIndex) {
      const hypeScore = typeof aiInsights.hypeIndex === 'object' ? aiInsights.hypeIndex.score : aiInsights.hypeIndex;
      const hypeReason = typeof aiInsights.hypeIndex === 'object' ? aiInsights.hypeIndex.reason : '';
      const hypeEmoji = hypeScore >= 4 ? '🔥' : hypeScore <= 2 ? '❄️' : '📈';
      const hypeLabel = hypeScore >= 4 ? '偏热' : hypeScore <= 2 ? '偏冷' : '正常';
      content += `📈 炒作指数：${hypeEmoji} ${hypeLabel} (${hypeScore}/5)\n`;
      if (hypeReason) content += `${hypeReason}\n`;
      content += `\n`;
    }
    
    // 今日热点
    if (aiInsights.hot && aiInsights.hot.length > 0) {
      content += `🔥 今日热点\n\n`;
      aiInsights.hot.slice(0, 5).forEach((hot, index) => {
        content += `${index + 1}. ${linkifyRepos(hot)}\n\n`;
      });
    }
    
    // 行动建议
    if (aiInsights.action && aiInsights.action.length > 0) {
      content += `🎯 行动建议\n\n`;
      aiInsights.action.slice(0, 3).forEach((action, index) => {
        content += `${index + 1}. ${linkifyRepos(action)}\n\n`;
      });
    }
    
    content += `📋 完整报告：\n${reportUrl}\n\n`;
    content += `⏰ 更新时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    
    return content;
  }

  /**
   * 生成报告通知内容（旧版兼容）
   * @deprecated 使用 generateNotificationContent 替代
   */
  generateNotificationContentOld(type, data) {
    const typeNames = {
      daily: '日报',
      weekly: '周报',
      monthly: '月报'
    };

    const date = data.date || data.weekStart || data.month;
    const trendingRepos = data.brief?.trending_repos || data.trending_repos || [];
    const aiInsights = data.aiInsights || {};
    
    // 构建标题
    const title = `🚀 GitHub 热门项目${typeNames[type]} (${date})`;
    
    // 构建今日概览
    let content = `📊 今日概览\n`;
    content += `今日新增 ${trendingRepos.length} 个热门项目，涵盖多个技术领域\n\n`;
    
    // 构建 Top 5 项目（如果数据足够）
    const top5 = trendingRepos.slice(0, 5);
    if (top5.length > 0) {
      content += `🔥 热门项目 TOP 5\n\n`;
      top5.forEach((repo, index) => {
        const stars = repo.stars || repo.todayStars || repo.star_increase || 0;
        content += `${index + 1}️⃣ ${repo.name || repo.repo || repo.fullName} - ⭐ ${stars}\n`;
        content += `${repo.desc || repo.description || ''}\n`;
        content += `🏷️ ${repo.language || 'Unknown'}\n\n`;
      });
    }
    
    // 构建核心洞察
    if (aiInsights.oneLiner || aiInsights.oneLineSummary || aiInsights.hypeIndex || aiInsights.hot) {
      content += `💡 核心洞察\n`;
      if (aiInsights.oneLiner) {
        content += `${aiInsights.oneLiner}\n\n`;
      } else if (aiInsights.oneLineSummary) {
        content += `${aiInsights.oneLineSummary}\n\n`;
      }
      if (aiInsights.hypeIndex) {
        const hypeScore = typeof aiInsights.hypeIndex === 'object' ? aiInsights.hypeIndex.score : aiInsights.hypeIndex;
        const hypeReason = typeof aiInsights.hypeIndex === 'object' ? aiInsights.hypeIndex.reason : '';
        content += `📈 炒作指数：⚠️ ${hypeScore >= 4 ? '偏热' : hypeScore <= 2 ? '偏冷' : '正常'} (${hypeScore}/5)\n`;
        if (hypeReason) content += `${hypeReason}\n\n`;
      }
      if (aiInsights.hot && aiInsights.hot.length > 0) {
        content += `\n🔥 今日热点\n`;
        aiInsights.hot.forEach((hot, idx) => {
          content += `${idx + 1}. ${hot}\n\n`;
        });
      }
    }
    
    // 构建行动建议
    const actions = aiInsights.action || aiInsights.actions || aiInsights.recommendations || [];
    if (actions && (Array.isArray(actions) ? actions.length > 0 : false)) {
      content += `\n🎯 行动建议\n`;
      (Array.isArray(actions) ? actions : [actions]).forEach((action, idx) => {
        if (typeof action === 'string') {
          content += `${idx + 1}. ${action}\n\n`;
        } else if (action.developers || action.development) {
          content += `${idx + 1}. ${action.developers || action.development}\n\n`;
        }
      });
    }
    
    // 添加报告链接
    const reportUrl = this.buildReportUrl(type, date);
    content += `\n📋 查看详细报告：\n${reportUrl}\n\n`;
    content += `⏰ 更新时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    return {
      type,
      title,
      content,
      reportUrl
    };
  }

  /**
   * 构建报告 URL
   * @param {string} type - 报告类型
   * @param {string} identifier - 标识符
   * @returns {string} 报告 URL
   */
  buildReportUrl(type, identifier) {
    const baseUrl = config.report?.baseUrl || 'https://report.wenspock.site';
    const filename = this.getReportFilename(type, identifier);
    // 使用 nginx 配置的短路径：/weekly/, /daily/, /monthly/
    return `${baseUrl}/${type}/${filename}`;
  }

  /**
   * 获取报告文件名
   * @param {string} type - 报告类型
   * @param {string} identifier - 标识符
   * @returns {string} 文件名
   */
  getReportFilename(type, identifier) {
    if (type === 'daily') {
      return `github-ai-trending-${identifier}.html`;
    } else if (type === 'weekly') {
      return `github-weekly-${identifier}.html`;
    } else if (type === 'monthly') {
      return `github-monthly-${identifier}.html`;
    }
    return `${type}-${identifier}.html`;
  }
}

module.exports = MessageSender;
