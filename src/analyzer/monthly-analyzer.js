const { callLLM } = require('../utils/llm');
const { writeJson } = require('../utils/fs');
const { getAIInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');
const prompts = require('../../config/prompts.json');

/**
 * 月度 AI 分析器
 * 负责对聚合后的月度数据进行深度 AI 分析
 */
class MonthlyAnalyzer {
  /**
   * 分析月度数据
   * @param {Object} monthlyData - 聚合后的月度数据
   * @returns {Promise<Object>} AI 分析结果
   */
  async analyze(monthlyData) {
    try {
      logger.info('开始分析月报数据...', { month: monthlyData.month });

      // 构建分析上下文
      const contextData = this.prepareContextData(monthlyData);

      // 构建 AI 提示词
      const prompt = this.buildPrompt(monthlyData.month, contextData);
      logger.info('Prompt 构建完成', { promptLength: prompt.length });

      // 调用 LLM
      let result;
      try {
        result = await callLLM(prompt, {
          temperature: 0.7,
          max_tokens: 4000
        });
        logger.info('LLM 调用完成');
      } catch (llmError) {
        logger.error(`LLM 调用失败：${llmError.message}`);
        return this.getFallbackInsights(llmError.message);
      }

      // 解析 AI 响应
      const insights = this.parseInsights(result, monthlyData);

      // 保存分析结果
      await this.saveInsights(monthlyData.month, insights);

      logger.success('月报 AI 分析完成', {
        month: monthlyData.month,
        hasMonthlyTheme: !!insights.monthlyTheme,
        hasTrendEvolution: !!insights.trendEvolution,
        topProjectsCount: insights.longTermValue?.length || 0
      });

      return insights;
    } catch (error) {
      logger.error(`月报 AI 分析失败：${error.message}`, {
        month: monthlyData.month,
        stack: error.stack
      });
      return this.getFallbackInsights(error.message);
    }
  }

  /**
   * 准备分析上下文数据
   */
  prepareContextData(monthlyData) {
    const aggregation = monthlyData.aggregation || {};

    // 提取上/中/下旬项目
    const trendEvolution = aggregation.trendEvolution || [];
    const periodProjects = trendEvolution.map(period => ({
      period: period.period,
      dates: period.dates,
      projectCount: period.projectCount,
      topType: period.topType,
      keyProjects: period.keyProjects?.slice(0, 3) || []
    }));

    // 准备 TOP 项目候选列表
    const topProjectCandidates = [
      ...aggregation.topGainers?.slice(0, 5).map(p => ({
        repo: p.repo,
        stars: p.stars,
        appearanceCount: p.appearanceCount,
        description: p.description
      })) || [],
      ...aggregation.recurringProjects?.slice(0, 5).map(p => ({
        repo: p.repo,
        appearanceCount: p.count,
        description: p.description
      })) || []
    ];

    return {
      dailyCount: monthlyData.dailyDataList?.length || 0,
      weeklyCount: monthlyData.weeklyDataList?.length || 0,
      totalProjects: aggregation.totalProjects || 0,
      recurringCount: aggregation.recurringProjects?.length || 0,
      newProjectsCount: aggregation.newProjects?.length || 0,
      typeDistribution: aggregation.typeDistribution || {},
      languageDistribution: aggregation.languageDistribution || {},
      periodProjects,
      topProjectCandidates
    };
  }

  /**
   * 构建 AI 提示词
   */
  buildPrompt(month, contextData) {
    const systemPrompt = prompts.monthly?.systemPrompt ||
      '你是一位经验丰富的技术趋势观察家，专注于从 GitHub Trending 数据中发现长期趋势和新兴领域。';

    const userPrompt = prompts.monthly?.userPrompt || '';

    // 使用更详细的自定义提示词
    const detailedPrompt = `你是一位经验丰富的技术趋势观察家，专注于从 GitHub Trending 数据中发现长期趋势和新兴领域。
请分析以下月度 GitHub Trending 数据，生成一份深度分析报告。

【基本信息】
月份：${month}
数据周期：${contextData.dailyCount}天日报 + ${contextData.weeklyCount}周周报
总项目数（去重）：${contextData.totalProjects}

【聚合统计数据】
- 重复上榜项目：${contextData.recurringCount}个
- 本月新星项目：${contextData.newProjectsCount}个
- 领域分布：${JSON.stringify(contextData.typeDistribution)}
- 语言分布：${JSON.stringify(contextData.languageDistribution)}

【趋势演变数据】
${contextData.periodProjects.map(p =>
`- ${p.period} (${p.dates}): ${p.projectCount}个项目，主导类型：${p.topType}`
).join('\n')}

【上/中/下旬关键项目】
${contextData.periodProjects.map(p =>
`${p.period}: ${p.keyProjects.join(', ')}`
).join('\n')}

【TOP 项目候选】
${contextData.topProjectCandidates.map(p =>
`- ${p.repo}: ${p.stars ? p.stars + '⭐' : ''}${p.appearanceCount ? ` (出现${p.appearanceCount}次)` : ''}`
).join('\n')}

请按以下 JSON 格式输出：
{
  "monthlyTheme": {
    "oneLiner": "一句话总结本月核心趋势（50 字以内）",
    "detailed": "详细解读（500-800 字，有数据支撑）"
  },
  "trendEvolution": [
    {
      "period": "上旬",
      "dates": "2026-03-01 ~ 2026-03-10",
      "theme": "阶段主题",
      "keyProjects": ["owner/repo1", "owner/repo2"],
      "analysis": "阶段分析（200-300 字）"
    },
    { "period": "中旬", "dates": "...", "theme": "...", "keyProjects": [...], "analysis": "..." },
    { "period": "下旬", "dates": "...", "theme": "...", "keyProjects": [...], "analysis": "..." }
  ],
  "longTermValue": [
    {
      "repo": "owner/repo",
      "category": "技术创新 | 持续热门 | 企业价值",
      "score": 95,
      "reasons": ["入选理由 1", "入选理由 2"],
      "value": "核心价值描述",
      "sustainability": "高 | 中 | 低"
    }
  ],
  "emergingFields": [
    {
      "field": "领域名称",
      "description": "领域描述（50 字以内）",
      "projects": ["owner/repo1", "owner/repo2"],
      "trend": "上升 | 稳定 | 下降"
    }
  ],
  "darkHorse": {
    "repo": "owner/repo",
    "reason": "入选理由"
  },
  "nextMonthForecast": "下月趋势预测（200-300 字）"
}

要求：
1. monthlyTheme 的 oneLiner 要精炼概括本月最核心特点，detailed 要深入分析趋势背后的原因和数据支撑
2. trendEvolution 要描述上/中/下旬的技术主题演变，每个阶段都要有关键项目和具体分析
3. longTermValue 选出 3-5 个 TOP 项目，按综合评分排序，包含技术创新、持续热门、企业价值三类
4. emergingFields 要描述 2-3 个新兴领域，包含领域特点和代表性项目
5. darkHorse 选出本月最大黑马项目
6. nextMonthForecast 要基于本月数据做出有理有据的预测
7. 所有项目名必须使用完整的 'owner/repo' 格式
8. 分析要有深度，避免泛泛而谈，要有具体数据支撑`;

    return detailedPrompt;
  }

  /**
   * 解析 AI 响应
   */
  parseInsights(llmResponse, monthlyData) {
    try {
      if (!llmResponse || llmResponse.trim().length === 0) {
        throw new Error('LLM 返回为空');
      }

      logger.debug('AI 原始响应', {
        length: llmResponse.length,
        preview: llmResponse.substring(0, 500)
      });

      // 清理 标签
      let cleanResponse = llmResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      // 从 Markdown 代码块中提取 JSON
      let jsonContent = cleanResponse;
      const markdownMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (markdownMatch) {
        jsonContent = markdownMatch[1];
      }

      // 提取 JSON 对象
      const firstBrace = jsonContent.indexOf('{');
      const lastBrace = jsonContent.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        logger.error('无法提取 JSON', { jsonContent: jsonContent.substring(0, 300) });
        throw new Error('无法从响应中提取 JSON');
      }

      jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
      const insights = JSON.parse(jsonContent);

      // 补充项目链接等元数据
      const trendingRepos = monthlyData.aggregation?.topGainers || [];

      if (insights.longTermValue) {
        insights.longTermValue = insights.longTermValue.map(item => {
          const repo = trendingRepos.find(r => r.repo === item.repo);
          return {
            ...item,
            stars: repo?.stars || 0,
            language: repo?.language || '',
            description: repo?.description || ''
          };
        });
      }

      if (insights.darkHorse) {
        const darkHorseRepo = trendingRepos.find(r => r.repo === insights.darkHorse.repo);
        insights.darkHorse = {
          ...insights.darkHorse,
          stars: darkHorseRepo?.stars || 0,
          language: darkHorseRepo?.language || ''
        };
      }

      return insights;
    } catch (error) {
      logger.error(`解析 AI 洞察失败：${error.message}`);
      throw new Error(`解析 AI 洞察失败：${error.message}`);
    }
  }

  /**
   * 获取降级洞察
   */
  getFallbackInsights(errorMsg) {
    return {
      monthlyTheme: {
        oneLiner: "AI 分析服务暂时不可用",
        detailed: "无法生成 AI 洞察，请稍后重试。"
      },
      trendEvolution: [],
      longTermValue: [],
      emergingFields: [],
      darkHorse: null,
      nextMonthForecast: "无法生成 AI 洞察，请稍后重试。"
    };
  }

  /**
   * 保存分析结果
   */
  async saveInsights(month, insights) {
    const filePath = getAIInsightsPath('monthly', month);
    await writeJson(filePath, insights);
    logger.debug(`月报 AI 洞察已保存：${filePath}`);
  }
}

module.exports = MonthlyAnalyzer;
