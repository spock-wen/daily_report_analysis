/**
 * LLM API 调用工具模块
 * 封装与大语言模型的交互
 */

const https = require('https');
const logger = require('./logger');

// LLM 配置
const config = {
  apiKey: process.env.LLM_API_KEY || '',
  baseUrl: process.env.LLM_BASE_URL || 'https://api.example.com/v1',
  model: process.env.LLM_MODEL || 'qwen-plus',
  timeout: parseInt(process.env.LLM_TIMEOUT || '60000', 10),
};

/**
 * 调用 LLM API
 * @param {string} prompt - 提示词
 * @param {Object} options - 选项
 * @returns {Promise<string>} AI 响应
 */
async function callLLM(prompt, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 2000,
    model = config.model,
  } = options;

  if (!config.apiKey) {
    throw new Error('LLM_API_KEY 环境变量未设置');
  }

  logger.info(`调用 LLM API: ${model}`);

  return new Promise((resolve, reject) => {
    const url = new URL(config.baseUrl);
    // 确保路径正确
    if (!url.pathname.endsWith('/chat/completions')) {
      url.pathname = url.pathname.replace(/\/$/, '') + '/chat/completions';
    }

    const requestBody = JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody),
      },
      timeout: config.timeout,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.choices && response.choices.length > 0) {
            const content = response.choices[0].message?.content || '';
            logger.success('LLM API 调用成功');
            resolve(content.trim());
          } else {
            const error = new Error('LLM 响应格式异常');
            logger.error('LLM 响应异常', { response: data });
            reject(error);
          }
        } catch (error) {
          logger.error('解析 LLM 响应失败', { 
            error: error.message,
            rawData: data 
          });
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      logger.error('LLM API 请求失败', { error: error.message });
      reject(error);
    });

    req.on('timeout', () => {
      logger.error('LLM API 请求超时');
      req.destroy();
      reject(new Error('LLM API 请求超时'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * 解析 AI 响应为结构化数据
 * @param {string} response - AI 响应文本
 * @returns {Object} 结构化数据
 */
function parseAIResponse(response) {
  try {
    // 尝试提取 JSON 内容
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // 如果没有 JSON，返回原始响应
    return { raw: response };
  } catch (error) {
    logger.error('解析 AI 响应失败', { error: error.message });
    return { raw: response, error: error.message };
  }
}

module.exports = {
  callLLM,
  parseAIResponse,
  config,
};
