/**
 * LLM API 调用工具模块
 * 封装与大语言模型的交互
 * 支持 Ollama 云端 API 和 OpenAI 兼容 API
 */

require('dotenv').config();
const https = require('https');
const logger = require('./logger');

// LLM 配置
const config = {
  apiKey: process.env.LLM_API_KEY || '',
  baseUrl: process.env.LLM_BASE_URL || 'https://ollama.com',
  model: process.env.LLM_MODEL || 'qwen3.5',
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
    
    // Ollama API 使用 /api/chat 端点，OpenAI 兼容 API 使用 /chat/completions
    const isOllama = url.hostname === 'ollama.com' || url.hostname === 'ollama.ac.cn';
    if (isOllama) {
      url.pathname = '/api/chat';
    } else if (!url.pathname.endsWith('/chat/completions')) {
      url.pathname = url.pathname.replace(/\/$/, '') + '/chat/completions';
    }

    // Ollama API 请求格式
    const requestBody = JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      stream: false,  // Ollama 需要显式设置 stream: false
    });

    const requestOptions = {
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

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          // Ollama API 响应格式：{ message: { content: '...' }, total_duration: ... }
          // OpenAI API 响应格式：{ choices: [{ message: { content: '...' } }] }
          let content = '';
          if (response.message && response.message.content) {
            // Ollama 格式
            content = response.message.content;
          } else if (response.choices && response.choices.length > 0) {
            // OpenAI 格式
            content = response.choices[0].message?.content || '';
          } else {
            const error = new Error('LLM 响应格式异常');
            logger.error('LLM 响应异常', { response: data });
            reject(error);
            return;
          }
          
          logger.success('LLM API 调用成功');
          resolve(content.trim());
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
