const { callLLM } = require('../utils/llm');
const { writeJson } = require('../utils/fs');
const { getAIInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');
const prompts = require('../../config/prompts.json');

/**
 * AI 洞察分析器 - 负责生成 AI 分析报告
 */
class InsightAnalyzer {
  /**
   * 分析日报数据并生成 AI 洞察
   * @param {Object} dailyData - 日报数据
   * @returns {Promise<Object>} AI 洞察结果
   */
  async analyzeDaily(dailyData) {
    try {
      logger.info('开始分析日报数据...', { date: dailyData.date });

      // 准备分析数据
      const contextData = this.prepareContextData(dailyData.brief);

      // 构建提示词
      const promptTemplate = prompts.daily.userPrompt;
      const prompt = this.buildPrompt(promptTemplate, contextData);

      // 调用 LLM
      const result = await callLLM(prompt, {
        temperature: 0.7,
        max_tokens: 2000
      });

      // 解析结果
      const insights = this.parseInsights(result, dailyData.brief);

      // 保存结果
      await this.saveInsights('daily', dailyData.date, insights);

      logger.success('日报 AI 分析完成', {
        date: dailyData.date,
        projects_analyzed: insights.project_insights?.length || 0
      });

      return insights;
    } catch (error) {
      logger.error(`日报 AI 分析失败：${error.message}`, { date: dailyData.date });
      throw error;
    }
  }

  /**
   * 分析周报数据并生成 AI 洞察
   * @param {Object} weeklyData - 周报数据
   * @returns {Promise<Object>} AI 洞察结果
   */
  async analyzeWeekly(weeklyData) {
    try {
      logger.info('开始分析周报数据...', { weekStart: weeklyData.weekStart });

      const contextData = this.prepareContextData(weeklyData.brief);
      // 构建提示词
      const promptTemplate = prompts.weekly.userPrompt;
      const prompt = this.buildPrompt(promptTemplate, contextData);
      logger.info('Prompt 构建完成，准备调用 LLM...', { promptLength: prompt.length });

      let result;
      try {
        result = await callLLM(prompt, {
          temperature: 0.7,
          maxTokens: 3000
        });
        logger.info('LLM 调用完成，开始解析结果...');
      } catch (llmError) {
        logger.error(`LLM 调用失败: ${llmError.message}`, { stack: llmError.stack });
        // 返回降级数据
        return {
          oneLiner: "AI 分析服务暂时不可用，请稍后重试。",
          hypeIndex: { score: 0, reason: "无法连接 AI 服务" },
          hot: [],
          shortTerm: [],
          longTerm: [],
          action: [],
          topProjects: []
        };
      }

      const insights = this.parseInsights(result, weeklyData.brief);
      await this.saveInsights('weekly', weeklyData.weekStart, insights);

      logger.success('周报 AI 分析完成', {
        weekStart: weeklyData.weekStart,
        projects_analyzed: insights.project_insights?.length || 0
      });

      return insights;
    } catch (error) {
      logger.error(`周报 AI 分析失败：${error.message}`, { weekStart: weeklyData.weekStart });
      // 不要抛出异常，返回基础结构以允许流程继续
      return {
        weeklyTheme: {
          oneLiner: "生成报告时发生错误",
          detailed: "AI 分析服务暂时不可用，无法生成详细洞察。"
        },
        hypeIndex: { score: 0, reason: error.message },
        hot: [],
        highlights: [],
        trends: {
          shortTerm: []
        },
        emergingFields: [],
        recommendations: {
          developers: [],
          enterprises: []
        },
        topProjects: [],
        action: []
      };
    }
  }

  /**
   * 分析月报数据并生成 AI 洞察
   * @param {Object} monthlyData - 月报数据
   * @returns {Promise<Object>} AI 洞察结果
   */
  async analyzeMonthly(monthlyData) {
    try {
      logger.info('开始分析月报数据...', { month: monthlyData.month });

      const contextData = this.prepareContextData(monthlyData.brief);
      const promptTemplate = prompts.monthly.userPrompt;
      const prompt = this.buildPrompt(promptTemplate, contextData);

      const result = await callLLM(prompt, {
        temperature: 0.7,
        max_tokens: 3000
      });

      const insights = this.parseInsights(result, monthlyData.brief);
      await this.saveInsights('monthly', monthlyData.month, insights);

      logger.success('月报 AI 分析完成', {
        month: monthlyData.month,
        projects_analyzed: insights.project_insights?.length || 0
      });

      return insights;
    } catch (error) {
      logger.error(`月报 AI 分析失败：${error.message}`, { month: monthlyData.month });
      throw error;
    }
  }

  /**
   * 分析深度趋势（基于过去 7 天数据）
   * @param {Array} dailyDataList - 过去 7 天的日报数据列表
   * @param {Object} weekRange - 周起止日期 { start, end }
   * @returns {Promise<Object>} 深度趋势分析结果
   */
  async analyzeDeepTrends(dailyDataList, weekRange) {
    try {
      logger.info('开始分析深度趋势...', { weekStart: weekRange.start, days: dailyDataList.length });

      if (!dailyDataList || dailyDataList.length === 0) {
        logger.warn('没有足够的日报数据进行深度趋势分析');
        return null;
      }

      // 准备上下文数据：将每日项目列表格式化为文本
      const dailyDataText = dailyDataList.map(day => {
        const projects = day.projects.slice(0, 15).map(p =>
          `- ${p.fullName}: ${p.description} (AI: ${p.isAI}, Trends: ${p.trend_data ? p.trend_data.join(', ') : ''})`
        ).join('\n');
        return `### ${day.date} (Day ${day.dayIndex + 1})\n${projects}`;
      }).join('\n\n');

      // 构建提示词
      const promptTemplate = prompts.deepTrends.userPrompt;
      let prompt = promptTemplate;
      prompt = prompt.replace('{weekStart}', weekRange.start);
      prompt = prompt.replace('{weekEnd}', weekRange.end);
      prompt = prompt.replace('{dailyData}', dailyDataText);

      // 调用 LLM
      const result = await callLLM(prompt, {
        temperature: 0.8, // 稍微提高创造性以发现深层联系
        max_tokens: 4000
      });

      // 解析结果
      const deepTrends = this.parseDeepTrends(result);

      // 保存结果（作为周报 insights 的一部分或独立文件，这里暂存日志）
      logger.success('深度趋势分析完成', { title: deepTrends?.title });

      return deepTrends;
    } catch (error) {
      logger.error(`深度趋势分析失败：${error.message}`);
      return null; // 不阻断主流程
    }
  }

  /**
   * 解析深度趋势结果
   */
  parseDeepTrends(llmResponse) {
    try {
      let cleanResponse = llmResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      let jsonContent = cleanResponse;
      const markdownMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (markdownMatch) jsonContent = markdownMatch[1];

      const firstBrace = jsonContent.indexOf('{');
      const lastBrace = jsonContent.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error('无效的 JSON 结构');

      return JSON.parse(jsonContent.substring(firstBrace, lastBrace + 1));
    } catch (error) {
      logger.warn(`解析深度趋势 JSON 失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 准备上下文数据
   * @param {Object} briefData - 基础数据
   * @returns {Object} 格式化后的上下文数据
   */
  prepareContextData(briefData) {
    const trendingRepos = briefData.trending_repos || [];

    logger.debug('准备上下文数据', {
      trendingReposCount: trendingRepos.length,
      sampleRepo: trendingRepos[0]
    });

    // 提取项目关键信息
    const projects = trendingRepos.map(repo => ({
      name: repo.name || repo.fullName,
      fullName: repo.fullName || repo.name,
      description: repo.description || repo.desc || '',
      stars: repo.stars || 0,
      forks: repo.forks || 0,
      language: repo.language || '',
      topics: repo.topics || [],
      url: repo.url || '',
      isAI: repo.isAI || false
    }));

    // 统计信息
    const stats = briefData.stats || {};

    const result = {
      projects,
      stats,
      generatedAt: briefData.generated_at || new Date().toISOString()
    };

    logger.debug('上下文数据准备完成', {
      projectsCount: result.projects.length,
      sampleProject: result.projects[0]
    });

    return result;
  }

  /**
   * 构建提示词
   * @param {string} template - 提示词模板
   * @param {Object} contextData - 上下文数据
   * @returns {string} 完整的提示词
   */
  buildPrompt(template, contextData) {
    // 支持两种模板格式：{variable} 和 {{variable}}
    let prompt = template;

    // 替换基础变量
    prompt = prompt.replace('{date}', contextData.generatedAt || new Date().toISOString());
    prompt = prompt.replace('{projectCount}', contextData.projects.length);

    // 确保项目数据格式正确
    const projectsForPrompt = contextData.projects.map(p => ({
      name: p.name,
      fullName: p.fullName || p.name,
      description: p.description || '',
      stars: p.stars || 0,
      language: p.language || '',
      url: p.url || '',
      isAI: p.isAI || false
    }));

    prompt = prompt.replace('{projects}', JSON.stringify(projectsForPrompt, null, 2));

    // 替换统计变量
    if (contextData.stats) {
      prompt = prompt.replace('{totalProjects}', contextData.stats.total_projects || contextData.stats.total || 0);
      prompt = prompt.replace('{aiProjects}', contextData.stats.ai_projects || 0);
      prompt = prompt.replace('{aiPercentage}', Math.round((contextData.stats.ai_projects || 0) / (contextData.stats.total_projects || 1) * 100));
      prompt = prompt.replace('{topProjects}', JSON.stringify(contextData.projects.slice(0, 5), null, 2));
      prompt = prompt.replace('{week}', contextData.generatedAt || '');
      prompt = prompt.replace('{month}', contextData.generatedAt?.substring(0, 7) || '');
    }

    // 支持双大括号格式（向后兼容）
    prompt = prompt.replace('{{projects_count}}', contextData.projects.length);
    prompt = prompt.replace('{{projects_json}}', JSON.stringify(contextData.projects, null, 2));

    if (contextData.stats && prompt.includes('{{stats_json}}')) {
      prompt = prompt.replace('{{stats_json}}', JSON.stringify(contextData.stats, null, 2));
    }

    return prompt;
  }

  /**
   * 解析 AI 返回的洞察结果
   * @param {string} llmResponse - LLM 响应
   * @param {Object} briefData - 基础数据
   * @returns {Object} 解析后的洞察
   */
  parseInsights(llmResponse, briefData) {
    try {
      // 记录原始响应（调试用）
      logger.debug('AI 原始响应', {
        length: llmResponse.length,
        preview: llmResponse.substring(0, 500)
      });

      // 预处理：移除可能的 <think>...</think> 标签内容
      let cleanResponse = llmResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      // 记录清理后的响应
      logger.debug('清理后响应', {
        length: cleanResponse.length,
        preview: cleanResponse.substring(0, 500)
      });

      // 尝试提取 JSON 内容（处理 markdown 代码块包裹的情况）
      let jsonContent = cleanResponse;

      // 如果响应包含 markdown 代码块，提取 JSON 部分
      const markdownMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (markdownMatch) {
        jsonContent = markdownMatch[1];
        logger.debug('从 Markdown 代码块中提取 JSON');
      }

      // 尝试从内容中提取 JSON 对象
      // 使用更宽松的正则，找到第一个 { 和最后一个 }
      const firstBrace = jsonContent.indexOf('{');
      const lastBrace = jsonContent.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        logger.error('无法提取 JSON，响应内容:', { jsonContent });
        throw new Error('无法从响应中提取 JSON：未找到有效的 JSON 对象结构');
      }

      jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
      logger.debug('提取的 JSON 内容', { jsonContent: jsonContent.substring(0, 300) });

      const insights = JSON.parse(jsonContent);

      // 补充项目链接信息
      if (insights.project_insights) {
        const trendingRepos = briefData.trending_repos || [];
        insights.project_insights = insights.project_insights.map(insight => {
          const repo = trendingRepos.find(r => r.name === insight.project_name);
          return {
            ...insight,
            github_url: repo?.url || '',
            stars: repo?.stars || 0,
            language: repo?.language || ''
          };
        });
      }

      return insights;
    } catch (error) {
      logger.error(`解析 AI 洞察失败：${error.message}`);
      // 不返回假数据，而是抛出错误让上层处理
      throw new Error(`解析 AI 洞察失败：${error.message}`);
    }
  }

  /**
   * 保存洞察结果
   * @param {string} type - 报告类型 (daily/weekly/monthly)
   * @param {string} identifier - 标识符 (日期/周起始/月份)
   * @param {Object} insights - 洞察数据
   */
  async saveInsights(type, identifier, insights) {
    const filePath = getAIInsightsPath(type, identifier);
    await writeJson(filePath, insights);
    logger.debug(`AI 洞察已保存：${filePath}`);
  }
}

module.exports = InsightAnalyzer;
