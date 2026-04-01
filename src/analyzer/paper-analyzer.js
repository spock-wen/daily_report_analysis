const { callLLM } = require('../utils/llm');
const { writeJson } = require('../utils/fs');
const { getPaperInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');

const AI_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 60000
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callLLMWithRetry(prompt, options = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= AI_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      console.log(`🤖 AI 分析中 (${attempt}/${AI_RETRY_CONFIG.maxRetries})...`);
      const result = await callLLM(prompt, options);
      if (result && result.trim().length > 0) {
        return result;
      }
      throw new Error('LLM 返回空响应');
    } catch (error) {
      lastError = error;
      console.error(`❌ AI 分析尝试 ${attempt}/${AI_RETRY_CONFIG.maxRetries} 失败：${error.message}`);

      if (attempt < AI_RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          AI_RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
          AI_RETRY_CONFIG.maxDelay
        );
        const jitter = Math.random() * 1000;
        const totalDelay = delay + jitter;
        console.log(`⏳ 等待 ${(totalDelay / 1000).toFixed(1)}s 后重试...`);
        await sleep(totalDelay);
      }
    }
  }

  throw lastError || new Error('AI 分析失败');
}

class PaperAnalyzer {
  constructor() {
    this.name = 'PaperAnalyzer';
  }

  /**
   * 分析论文数据
   * @param {Object} paperData - 论文数据
   * @returns {Promise<Object>} AI 洞察
   */
  async analyze(paperData) {
    const { date, papers } = paperData;

    logger.info('[PaperAnalyzer] 开始分析论文数据...', { date, count: papers.length });

    try {
      const contextData = this.prepareContextData(papers);
      const prompt = this.buildPrompt(contextData);

      const result = await callLLMWithRetry(prompt, {
        temperature: 0.7,
        max_tokens: 2000
      });

      const insights = this.parseInsights(result);
      await this.saveInsights(date, insights);

      logger.success('[PaperAnalyzer] 分析完成', { date });
      return insights;

    } catch (error) {
      logger.error('[PaperAnalyzer] 分析失败', { error: error.message });
      return this.getFallbackInsights();
    }
  }

  /**
   * 准备上下文数据
   * @param {Array} papers - 论文列表
   * @returns {Object} 格式化的上下文
   */
  prepareContextData(papers) {
    // 选择前 50 篇论文（避免 prompt 过长）
    const samplePapers = papers.slice(0, 50).map(p => ({
      title: p.title,
      stars: p.stars,
      arxiv_url: p.details?.arxiv_page_url || p.paper_url,
      github_links: p.details?.github_links || []
    }));

    return {
      papers: samplePapers,
      totalCount: papers.length,
      sampleCount: samplePapers.length
    };
  }

  /**
   * 构建 Prompt
   * @param {Object} context - 上下文数据
   * @returns {string} Prompt 字符串
   */
  buildPrompt(context) {
    const papersJson = JSON.stringify(context.papers, null, 2);

    const template = `你是一位专业的 AI 研究员，分析今日的 HuggingFace 热门论文。

今日论文（共 {totalCount} 篇，分析 {sampleCount} 篇）：
{papersJson}

请按以下格式输出 JSON：
{{
  "oneLiner": "一句话总结今日论文观察（30字以内）",
  "languageDistribution": {{
    "编程语言/框架名": 论文数量
  }},
  "technicalInsights": [
    {{
      "paper": "github.com/owner/repo",
      "innovation": "技术创新点（1-2 句）",
      "method": "核心方法（简要）",
      "results": "实验结果或效果"
    }}
  ],
  "communityValue": [
    "开源价值点1",
    "开源价值点2"
  ],
  "applicationOutlook": [
    "应用前景1",
    "应用前景2"
  ]
}}

要求：
1. oneLiner 精炼概括今日论文特点（30字以内）
2. languageDistribution 统计出现的编程语言或框架
3. technicalInsights 分析 3-5 篇技术亮点突出的论文
4. communityValue 强调开源价值
5. applicationOutlook 展望应用前景

注意：
- 所有论文链接使用 github.com/owner/repo 格式
- 输出纯 JSON，不要 markdown 包裹
- 使用中文输出`;

    return template
      .replace('{totalCount}', context.totalCount)
      .replace('{sampleCount}', context.sampleCount)
      .replace('{papersJson}', papersJson);
  }

  /**
   * 解析 AI 响应
   * @param {string} response - AI 响应文本
   * @returns {Object} 解析后的洞察
   */
  parseInsights(response) {
    try {
      // 移除可能的 markdown 代码块
      let clean = response.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();

      // 提取 JSON 对象
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('未找到 JSON 对象');
      }

      const jsonStr = clean.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('[PaperAnalyzer] 解析失败', { error: error.message });
      return this.getFallbackInsights();
    }
  }

  /**
   * 降级洞察
   * @returns {Object} 降级数据
   */
  getFallbackInsights() {
    return {
      oneLiner: 'AI 分析服务暂时不可用',
      languageDistribution: {},
      technicalInsights: [],
      communityValue: [],
      applicationOutlook: []
    };
  }

  /**
   * 保存洞察
   * @param {string} date - 日期
   * @param {Object} insights - 洞察数据
   */
  async saveInsights(date, insights) {
    const filePath = getPaperInsightsPath(date);
    await writeJson(filePath, insights);
    logger.debug('[PaperAnalyzer] 洞察已保存：' + filePath);
  }
}

module.exports = PaperAnalyzer;
