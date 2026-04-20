/**
 * LLM Client - 为 Wiki Inspector 提供的 LLM 客户端
 *
 * 使用方式:
 * const { createLlmClient } = require('./src/utils/llm-client');
 * const llmClient = createLlmClient();
 * const result = await llmClient.generate(prompt);
 */

const { callLLM } = require('./llm');

/**
 * 创建 LLM 客户端实例
 * @returns {Object} LLM 客户端
 */
function createLlmClient() {
  return {
    /**
     * 生成响应
     * @param {string} prompt - 提示词
     * @param {Object} options - 选项
     * @param {number} options.temperature - 温度 (默认 0.1)
     * @param {number} options.maxTokens - 最大 token 数 (默认 500)
     * @returns {Promise<string>} AI 响应
     */
    async generate(prompt, options = {}) {
      const {
        temperature = 0.1,  // 默认低温，追求确定性
        maxTokens = 500,
        model = undefined
      } = options;

      return await callLLM(prompt, {
        temperature,
        maxTokens,
        model
      });
    }
  };
}

module.exports = {
  createLlmClient
};
