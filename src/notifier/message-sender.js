const https = require('https');
const logger = require('../utils/logger');
const config = require('../../config/config.json');

/**
 * 推送通知发送器 - 负责发送飞书和 WeLink 通知
 */
class MessageSender {
  /**
   * 发送飞书通知
   * @param {Object} options - 发送选项
   * @returns {Promise<Object>} 发送结果
   */
  async sendFeishu(options) {
    try {
      logger.info('发送飞书通知...', { type: options.type, title: options.title });

      const message = this.buildFeishuMessage(options);
      const result = await this.sendWebhookRequest(
        config.notifications.feishu.webhook_url,
        message
      );

      logger.success('飞书通知发送成功', { type: options.type });
      return { success: true, platform: 'feishu', result };
    } catch (error) {
      logger.error(`飞书通知发送失败：${error.message}`, options);
      return { success: false, platform: 'feishu', error: error.message };
    }
  }

  /**
   * 发送 WeLink 通知
   * @param {Object} options - 发送选项
   * @returns {Promise<Object>} 发送结果
   */
  async sendWeLink(options) {
    try {
      logger.info('发送 WeLink 通知...', { type: options.type, title: options.title });

      const message = this.buildWeLinkMessage(options);
      const result = await this.sendWebhookRequest(
        config.notifications.welink.webhook_url,
        message
      );

      logger.success('WeLink 通知发送成功', { type: options.type });
      return { success: true, platform: 'welink', result };
    } catch (error) {
      logger.error(`WeLink 通知发送失败：${error.message}`, options);
      return { success: false, platform: 'welink', error: error.message };
    }
  }

  /**
   * 同时发送飞书和 WeLink 通知
   * @param {Object} options - 发送选项
   * @returns {Promise<Array>} 发送结果
   */
  async sendAll(options) {
    const results = await Promise.all([
      this.sendFeishu(options),
      this.sendWeLink(options)
    ]);
    return results;
  }

  /**
   * 构建飞书消息
   * @param {Object} options - 消息选项
   * @returns {Object} 飞书消息对象
   */
  buildFeishuMessage(options) {
    const { type, title, content, reportUrl } = options;

    const message = {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: title
          },
          template: 'blue'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: content
            }
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  tag: 'plain_text',
                  content: '查看报告'
                },
                url: reportUrl,
                type: 'primary'
              }
            ]
          }
        ]
      }
    };

    return message;
  }

  /**
   * 构建 WeLink 消息
   * @param {Object} options - 消息选项
   * @returns {Object} WeLink 消息对象
   */
  buildWeLinkMessage(options) {
    const { type, title, content, reportUrl } = options;

    const message = {
      msgtype: 'markdown',
      markdown: {
        content: `# ${title}\n\n${content}\n\n[查看报告](${reportUrl})`
      }
    };

    return message;
  }

  /**
   * 发送 Webhook 请求
   * @param {string} webhookUrl - Webhook URL
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} 响应结果
   */
  sendWebhookRequest(webhookUrl, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(webhookUrl);
      const payload = JSON.stringify(data);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            resolve(result);
          } catch (error) {
            resolve({ raw: responseData });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * 生成报告通知内容
   * @param {string} type - 报告类型 (daily/weekly/monthly)
   * @param {Object} data - 报告数据
   * @returns {Object} 通知内容
   */
  generateNotificationContent(type, data) {
    const typeNames = {
      daily: '日报',
      weekly: '周报',
      monthly: '月报'
    };

    const date = data.date || data.weekStart || data.month;
    const stats = data.brief?.stats || {};
    const projectName = config.project_name || 'GitHub AI Trending';

    const title = `${projectName} ${typeNames[type]} - ${date}`;
    
    const content = `
📊 **数据概览**
• 上榜项目：${stats.total_projects || 0}
• AI 项目：${stats.ai_projects || 0}
• 平均 Stars: ${stats.avg_stars || 0}
• 高热项目：${stats.hot_projects || 0}

${data.aiInsights?.summary ? `🤖 **AI 洞察**\n${data.aiInsights.summary.substring(0, 200)}...` : ''}
    `.trim();

    const reportUrl = this.buildReportUrl(type, date);

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
    const baseUrl = config.base_url || 'http://localhost:8080';
    const filename = this.getReportFilename(type, identifier);
    return `${baseUrl}/reports/${type}/${filename}`;
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
      return `weekly-${identifier}.html`;
    } else if (type === 'monthly') {
      return `monthly-${identifier}.html`;
    }
    return `${type}-${identifier}.html`;
  }
}

module.exports = MessageSender;
