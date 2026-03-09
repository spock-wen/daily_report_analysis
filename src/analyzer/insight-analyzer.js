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
      const promptTemplate = prompts.weekly.userPrompt;
      const prompt = this.buildPrompt(promptTemplate, contextData);

      const result = await callLLM(prompt, {
        temperature: 0.7,
        max_tokens: 2500
      });

      const insights = this.parseInsights(result, weeklyData.brief);
      await this.saveInsights('weekly', weeklyData.weekStart, insights);

      logger.success('周报 AI 分析完成', {
        weekStart: weeklyData.weekStart,
        projects_analyzed: insights.project_insights?.length || 0
      });

      return insights;
    } catch (error) {
      logger.error(`周报 AI 分析失败：${error.message}`, { weekStart: weeklyData.weekStart });
      throw error;
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
   * 准备上下文数据
   * @param {Object} briefData - 基础数据
   * @returns {Object} 格式化后的上下文数据
   */
  prepareContextData(briefData) {
    const trendingRepos = briefData.trending_repos || [];
    
    // 提取项目关键信息
    const projects = trendingRepos.map(repo => ({
      name: repo.name,
      description: repo.description || '',
      stars: repo.stars || 0,
      forks: repo.forks || 0,
      language: repo.language || '',
      topics: repo.topics || []
    }));

    // 统计信息
    const stats = briefData.stats || {};

    return {
      projects,
      stats,
      generatedAt: briefData.generated_at || new Date().toISOString()
    };
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
    prompt = prompt.replace('{projects}', JSON.stringify(contextData.projects, null, 2));
    
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
      // 提取 JSON 内容（处理 markdown 代码块包裹的情况）
      let jsonContent = llmResponse;
      
      // 如果响应包含 markdown 代码块，提取 JSON 部分
      const markdownMatch = llmResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (markdownMatch) {
        jsonContent = markdownMatch[1];
      }
      
      // 尝试从内容中提取 JSON 对象
      let jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法从响应中提取 JSON');
      }

      const insights = JSON.parse(jsonMatch[0]);

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
      logger.warn(`解析 AI 洞察失败：${error.message}`);
      // 返回基础结构
      return {
        oneLiner: llmResponse.substring(0, 200),
        hypeIndex: { score: 3, reason: 'AI 解析失败' },
        hot: [],
        shortTerm: [],
        longTerm: [],
        action: []
      };
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
