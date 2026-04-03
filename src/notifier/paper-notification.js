const fetch = require('node-fetch');
const logger = require('../utils/logger');
const { getConfig, getEnvBool } = require('../utils/config');

// 加载配置
const config = getConfig();

// 推送启用状态
const FEISHU_ENABLED = getEnvBool('FEISHU_ENABLED', true);
const WELINK_ENABLED = getEnvBool('WELINK_ENABLED', false);

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

// Token 缓存
let cachedToken = null;
let tokenExpireTime = 0;

// 翻译缓存
const translationCache = new Map();

class PaperNotification {
  constructor() {
    this.name = 'PaperNotification';
  }

  /**
   * 发送飞书通知
   * @param {Object} options - 通知选项
   * @returns {Promise<Object>} 发送结果
   */
  async sendFeishu(options) {
    if (!FEISHU_ENABLED) {
      logger.warn('飞书通知已禁用，跳过发送');
      return { success: false, platform: 'feishu', error: '飞书通知已禁用' };
    }

    try {
      logger.info('[PaperNotification] 发送飞书通知...', { date: options.date });

      const message = await this.buildFeishuMessage(options);
      const accessToken = await this.getFeishuAccessToken();
      const receiveId = config.notifier.feishu.receiveId;
      const receiveIdType = config.notifier.feishu.receiveIdType || 'open_id';

      const result = await this.sendFeishuMessage(accessToken, receiveId, receiveIdType, message);

      logger.success('[PaperNotification] 飞书通知发送成功');
      return { success: true, platform: 'feishu', result };
    } catch (error) {
      logger.error('[PaperNotification] 飞书通知发送失败', { error: error.message });
      return { success: false, platform: 'feishu', error: error.message };
    }
  }

  /**
   * 获取飞书 access token
   * @returns {Promise<string>} access token
   */
  async getFeishuAccessToken() {
    if (cachedToken && Date.now() < tokenExpireTime) {
      return cachedToken;
    }

    const { appId, appSecret } = config.notifier.feishu;

    try {
      const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        timeout: 15000
      });

      if (!response.ok) {
        throw new Error(`获取飞书 token 失败：HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.code !== 0) {
        throw new Error(`获取飞书 token 失败：${result.msg}`);
      }

      cachedToken = result.tenant_access_token;
      tokenExpireTime = result.expire - 300;

      return cachedToken;
    } catch (error) {
      throw new Error(`飞书 token 请求失败：${error.message}`);
    }
  }

  /**
   * 发送飞书消息
   */
  async sendFeishuMessage(accessToken, receiveId, receiveIdType, message) {
    const payload = {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(message)
    };

    const response = await fetch(`${FEISHU_API_BASE}/im/v1/messages?receive_id_type=${receiveIdType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload),
      timeout: 15000
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`飞书消息发送失败：HTTP ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`飞书推送失败：${result.msg}`);
    }

    return result;
  }

  /**
   * 发送 WeLink 通知
   * @param {Object} options - 通知选项
   * @returns {Promise<Array>} 发送结果数组
   */
  async sendWeLink(options) {
    if (!WELINK_ENABLED) {
      logger.warn('WeLink 通知已禁用，跳过发送');
      return { success: false, platform: 'welink', error: 'WeLink 通知已禁用' };
    }

    try {
      logger.info('[PaperNotification] 发送 WeLink 通知...', { date: options.date });

      const message = await this.buildWeLinkMessage(options);
      const webhookUrls = config.notifier.welink.webhookUrls.split(',').map(url => url.trim());

      const results = await Promise.all(
        webhookUrls.map(url => this.sendWebhookRequest(url, message))
      );

      const successCount = results.filter(r => r.success).length;

      if (successCount > 0) {
        logger.success('[PaperNotification] WeLink 通知发送成功');
      } else {
        logger.error('[PaperNotification] WeLink 通知全部失败');
      }

      return results.map((r, i) => ({
        success: r.success,
        platform: 'welink',
        webhookIndex: i,
        result: r
      }));
    } catch (error) {
      logger.error('[PaperNotification] WeLink 通知发送失败', { error: error.message });
      return [{ success: false, platform: 'welink', error: error.message }];
    }
  }

  /**
   * 构建飞书消息
   * @param {Object} options - 通知选项
   * @returns {Object} 飞书消息对象
   */
  async buildFeishuMessage(options) {
    const { date, papers, filteredPapers, aiInsights } = options;
    const totalCount = papers.length;
    const filteredCount = filteredPapers.length;

    // TOP5 论文（按 Stars 排序）
    const top5 = [...filteredPapers].sort((a, b) => b.stars - a.stars).slice(0, 5);

    // 翻译论文标题
    const titleTranslations = await this.translatePaperTitles(top5);

    // 格式化 TOP5
    const top5Text = top5.map((p, i) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
      const repo = p.details?.github_links?.[0]?.split('github.com/')?.[1] || 'N/A';
      const titleZh = titleTranslations[p.title] || p.title;
      return `${medal} ${titleZh} 🌟${p.stars}\n   GitHub: ${repo}`;
    }).join('\n\n');

    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: `✅ HuggingFace AI Papers 日报已生成` },
        subtitle: { tag: 'plain_text', content: `${date} · ${filteredCount} 篇热门论文` },
        template: 'green'
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content: `📊 今日概览\nHuggingFace 最新论文共 ${totalCount} 篇，热门论文 (Stars>10) ${filteredCount} 篇` }
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: { tag: 'lark_md', content: `🔥 热门论文 TOP 5\n\n${top5Text}` }
        },
        { tag: 'hr' },
        { tag: 'div', text: { tag: 'lark_md', content: `💡 AI 洞察\n${aiInsights?.oneLiner || '暂无'}` } },
        { tag: 'hr' },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🔗 查看报告' },
              type: 'primary',
              url: options.reportUrl
            }
          ]
        },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: `⏰ 生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` }]
        }
      ]
    };
  }

  /**
   * 构建 WeLink 消息（精简版）
   * @param {Object} options - 通知选项
   * @returns {Object} WeLink 消息对象
   */
  async buildWeLinkMessage(options) {
    const { date, filteredPapers, aiInsights } = options;
    const minStars = options.minStars || 10;

    // TOP5 论文
    const top5 = [...filteredPapers].sort((a, b) => b.stars - a.stars).slice(0, 5);

    // 翻译论文标题
    const titleTranslations = await this.translatePaperTitles(top5);

    // 语言分布
    const langDist = aiInsights?.languageDistribution || {};
    const langText = Object.entries(langDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k}(${v})`)
      .join(', ');

    // 构建消息
    let msg = `✅ HuggingFace AI Papers 日报 (${date})\n\n`;
    msg += `🔥 热门论文 TOP 5 (Stars>${minStars})：\n`;
    top5.forEach((p, i) => {
      const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
      const repo = p.details?.github_links?.[0]?.split('github.com/')?.[1] || 'N/A';
      const titleZh = titleTranslations[p.title] || p.title;
      msg += `\n${medal} ${titleZh} 🌟${p.stars}\n   GitHub: github.com/${repo}\n`;
    });

    if (langText) {
      msg += `\n💡 语言分布：${langText}`;
    }

    msg += `\n\n📋 完整报告：${options.reportUrl}`;

    // 截断到 500 字
    if (msg.length > 500) {
      msg = msg.substring(0, 500) + '...';
    }

    return {
      messageType: 'text',
      content: { text: msg },
      timeStamp: Date.now(),
      uuid: this.generateUUID()
    };
  }

  /**
   * 生成 UUID
   * @returns {string} UUID 字符串
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 发送 Webhook 请求
   */
  async sendWebhookRequest(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        timeout: 15000
      });

      const result = await response.json();
      return { success: result.code === '0' || result.code === 0, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送全部通知
   * @param {Object} options - 通知选项
   * @returns {Promise<Array>} 所有发送结果
   */
  async sendAll(options) {
    const [feishuResult, welinkResults] = await Promise.all([
      this.sendFeishu(options),
      this.sendWeLink(options)
    ]);

    return [feishuResult].concat(Array.isArray(welinkResults) ? welinkResults : [welinkResults]);
  }

  /**
   * 翻译文本
   * @param {string} text - 英文文本
   * @returns {Promise<string>} 中文文本
   */
  async translateText(text) {
    if (!text) return '';

    // 检查是否包含中文
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return text;
    }

    // 检查缓存
    if (translationCache.has(text)) {
      return translationCache.get(text);
    }

    try {
      const cleanText = text.trim();
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|zh-CN`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText;
        translationCache.set(text, translated);
        return translated;
      } else {
        throw new Error(data.responseDetails || 'Translation failed');
      }
    } catch (error) {
      logger.warn('[PaperNotification] 翻译失败，返回原文：' + error.message);
      return text;
    }
  }

  /**
   * 批量翻译论文标题
   * @param {Array} papers - 论文列表
   * @returns {Promise<Object>} 翻译后的标题映射
   */
  async translatePaperTitles(papers) {
    const translations = {};
    for (const paper of papers) {
      translations[paper.title] = await this.translateText(paper.title);
    }
    return translations;
  }
}

module.exports = PaperNotification;
