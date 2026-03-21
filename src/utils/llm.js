/**
 * LLM API 调用工具模块
 * 封装与大语言模型的交互
 * 支持 Ollama 云端 API 和 OpenAI 兼容 API
 */

require('dotenv').config();
const logger = require('./logger');

// LLM 配置
const config = {
  apiKey: process.env.LLM_API_KEY || '',
  baseUrl: process.env.LLM_BASE_URL || 'https://ollama.com',
  model: process.env.LLM_MODEL || 'qwen3.5',
  timeout: parseInt(process.env.LLM_TIMEOUT || '120000', 10),
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
    maxTokens = 3000,
    model = config.model,
  } = options;

  if (!config.apiKey) {
    throw new Error('LLM_API_KEY 环境变量未设置');
  }

  const url = new URL(config.baseUrl);
  logger.info(`调用 LLM API: ${model}, URL: ${url.toString()}`);
  
  // Ollama API 使用 /api/chat 端点，OpenAI 兼容 API 使用 /chat/completions
  const isOllama = url.hostname.includes('ollama');
  if (isOllama) {
    if (!url.pathname.endsWith('/api/chat')) {
       url.pathname = url.pathname.replace(/\/$/, '') + '/api/chat';
    }
  } else if (!url.pathname.endsWith('/chat/completions')) {
    url.pathname = url.pathname.replace(/\/$/, '') + '/chat/completions';
  }

  // 构建请求体
  const requestBody = {
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature,
    stream: true, // 开启流式传输，避免长连接超时
  };

  // 添加 max_tokens (OpenAI) 或 num_predict (Ollama)
  if (isOllama) {
    requestBody.options = {
      temperature: temperature
    };
  } else {
    requestBody.max_tokens = maxTokens;
    requestBody.stream = true;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    // 优先使用全局 fetch (Node 18+)
    let fetchFn = global.fetch;

    // 如果没有全局 fetch，尝试动态导入 node-fetch
    if (!fetchFn) {
      try {
        const module = await import('node-fetch');
        fetchFn = module.default;
      } catch (err) {
        throw new Error('未找到全局 fetch 且无法加载 node-fetch: ' + err.message);
      }
    }

    logger.info('开始流式请求 LLM...');
    const response = await fetchFn(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留最后一个可能不完整的行

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        if (trimmedLine === 'data: [DONE]') continue;

        try {
          // 处理 SSE 格式 (data: {...}) 或直接 JSON 对象
          let jsonStr = trimmedLine;
          if (trimmedLine.startsWith('data: ')) {
            jsonStr = trimmedLine.slice(6);
          }

          const data = JSON.parse(jsonStr);
          
          if (data.message) {
              // Ollama 格式：检查 content 是否存在（注意空字符串也是 falsy）
              if (data.message.content !== undefined && data.message.content !== null) {
                fullContent += data.message.content;
                process.stdout.write(data.message.content);
              } else if (data.message.thinking) {
                // 只有 thinking 没有 content，打印提示但不累加
                process.stdout.write('[thinking]');
              }
            } else if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              // OpenAI 格式
              fullContent += data.choices[0].delta.content;
              process.stdout.write(data.choices[0].delta.content);
            }

            // done=true 时退出循环（放在这里确保所有消息类型都能正确退出）
            if (data.done) {
              break;
            }
        } catch (e) {
          // 忽略解析错误，继续处理下一行
        }
      }
    }
    
    console.log('\n'); // 换行
    logger.info('收到完整 LLM 响应');
    return fullContent.trim();

  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error('LLM API 请求超时');
      throw new Error('LLM API 请求超时');
    }
    logger.error('LLM API 调用失败', { error: error.message });
    throw error;
  }
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
