const { callLLM } = require('../utils/llm');
const { writeJson } = require('../utils/fs');
const { getAIInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');
const prompts = require('../../config/prompts.json');

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

class InsightAnalyzer {
  async analyzeDaily(dailyData) {
    try {
      logger.info('开始分析日报数据...', { date: dailyData.date });

      const contextData = this.prepareContextData(dailyData.brief);
      const promptTemplate = prompts.daily.userPrompt;
      const prompt = this.buildPrompt(promptTemplate, contextData);

      const result = await callLLMWithRetry(prompt, {
        temperature: 0.7,
        max_tokens: 2000
      });

      const insights = this.parseInsights(result, dailyData.brief);
      await this.saveInsights('daily', dailyData.date, insights);

      logger.success('日报 AI 分析完成', {
        date: dailyData.date,
        projects_analyzed: insights.project_insights?.length || 0
      });

      return insights;
    } catch (error) {
      logger.error(`日报 AI 分析失败：${error.message}`, { date: dailyData.date });
      console.warn('⚠️ AI 分析失败，返回降级洞察');
      return this.getFallbackInsights();
    }
  }

  async analyzeWeekly(weeklyData) {
    try {
      logger.info('开始分析周报数据...', { weekStart: weeklyData.weekStart });

      const contextData = this.prepareContextData(weeklyData.brief);
      const promptTemplate = prompts.weekly.userPrompt;
      const prompt = this.buildPrompt(promptTemplate, contextData);
      logger.info('Prompt 构建完成，准备调用 LLM...', { promptLength: prompt.length });

      let result;
      try {
        result = await callLLMWithRetry(prompt, {
          temperature: 0.7,
          maxTokens: 3000
        });
        logger.info('LLM 调用完成，开始解析结果...');
      } catch (llmError) {
        logger.error(`LLM 调用失败: ${llmError.message}`, { stack: llmError.stack });
        return this.getWeeklyFallbackInsights(llmError.message);
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
      return this.getWeeklyFallbackInsights(error.message);
    }
  }

  async analyzeMonthly(monthlyData) {
    try {
      logger.info('开始分析月报数据...', { month: monthlyData.month });

      const contextData = this.prepareContextData(monthlyData.brief);
      const promptTemplate = prompts.monthly.userPrompt;
      const prompt = this.buildPrompt(promptTemplate, contextData);

      const result = await callLLMWithRetry(prompt, {
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
      return this.getMonthlyFallbackInsights(error.message);
    }
  }

  async analyzeDeepTrends(dailyDataList, weekRange) {
    try {
      logger.info('开始分析深度趋势...', { weekStart: weekRange.start, days: dailyDataList.length });

      if (!dailyDataList || dailyDataList.length === 0) {
        logger.warn('没有足够的日报数据进行深度趋势分析');
        return null;
      }

      const dailyDataText = dailyDataList.map(day => {
        const projects = day.projects.slice(0, 15).map(p =>
          `- ${p.fullName}: ${p.description} (AI: ${p.isAI}, Trends: ${p.trend_data ? p.trend_data.join(', ') : ''})`
        ).join('\n');
        return `### ${day.date} (Day ${day.dayIndex + 1})\n${projects}`;
      }).join('\n\n');

      const promptTemplate = prompts.deepTrends.userPrompt;
      let prompt = promptTemplate;
      prompt = prompt.replace('{weekStart}', weekRange.start);
      prompt = prompt.replace('{weekEnd}', weekRange.end);
      prompt = prompt.replace('{dailyData}', dailyDataText);

      const result = await callLLMWithRetry(prompt, {
        temperature: 0.8,
        max_tokens: 4000
      });

      const deepTrends = this.parseDeepTrends(result);
      logger.success('深度趋势分析完成', { title: deepTrends?.title });

      return deepTrends;
    } catch (error) {
      logger.error(`深度趋势分析失败：${error.message}`);
      return null;
    }
  }

  getFallbackInsights() {
    return {
      oneLiner: "AI 分析服务暂时不可用，请查看完整项目列表。",
      hypeIndex: { score: 0, reason: "无法连接 AI 服务" },
      hot: [],
      shortTerm: [],
      longTerm: [],
      action: []
    };
  }

  getWeeklyFallbackInsights(errorMsg) {
    return {
      weeklyTheme: {
        oneLiner: "AI 分析服务暂时不可用",
        detailed: "无法生成 AI 洞察，请稍后重试。"
      },
      hypeIndex: { score: 0, reason: errorMsg },
      hot: [],
      highlights: [],
      trends: { shortTerm: [] },
      emergingFields: [],
      recommendations: { developers: [], enterprises: [] },
      topProjects: [],
      action: []
    };
  }

  getMonthlyFallbackInsights(errorMsg) {
    return {
      monthReview: "AI 分析服务暂时不可用",
      topProjects: [],
      emergingFields: [],
      longTermTrends: [],
      nextMonthOutlook: "无法生成 AI 洞察，请稍后重试。"
    };
  }

  prepareContextData(briefData) {
    const trendingRepos = briefData.projects || briefData.trending_repos || [];

    logger.debug('准备上下文数据', {
      trendingReposCount: trendingRepos.length,
      sampleRepo: trendingRepos[0]
    });

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

    const stats = briefData.stats || {};

    const result = {
      projects,
      stats,
      generatedAt: briefData.generatedAt || briefData.generated_at || new Date().toISOString()
    };

    logger.debug('上下文数据准备完成', {
      projectsCount: result.projects.length,
      sampleProject: result.projects[0]
    });

    return result;
  }

  buildPrompt(template, contextData) {
    let prompt = template;

    prompt = prompt.replace('{date}', contextData.generatedAt || new Date().toISOString());
    prompt = prompt.replace('{projectCount}', contextData.projects.length);

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

    if (contextData.stats) {
      prompt = prompt.replace('{totalProjects}', contextData.stats.total_projects || contextData.stats.total || 0);
      prompt = prompt.replace('{aiProjects}', contextData.stats.ai_projects || 0);
      prompt = prompt.replace('{aiPercentage}', Math.round((contextData.stats.ai_projects || 0) / (contextData.stats.total_projects || 1) * 100));
      prompt = prompt.replace('{topProjects}', JSON.stringify(contextData.projects.slice(0, 5), null, 2));
      prompt = prompt.replace('{week}', contextData.generatedAt || '');
      prompt = prompt.replace('{month}', contextData.generatedAt?.substring(0, 7) || '');
    }

    prompt = prompt.replace('{{projects_count}}', contextData.projects.length);
    prompt = prompt.replace('{{projects_json}}', JSON.stringify(contextData.projects, null, 2));

    if (contextData.stats && prompt.includes('{{stats_json}}')) {
      prompt = prompt.replace('{{stats_json}}', JSON.stringify(contextData.stats, null, 2));
    }

    return prompt;
  }

  parseInsights(llmResponse, briefData) {
    try {
      if (!llmResponse || llmResponse.trim().length === 0) {
        throw new Error('LLM 返回为空');
      }

      logger.debug('AI 原始响应', {
        length: llmResponse.length,
        preview: llmResponse.substring(0, 500)
      });

      let cleanResponse = llmResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      logger.debug('清理后响应', {
        length: cleanResponse.length,
        preview: cleanResponse.substring(0, 500)
      });

      let jsonContent = cleanResponse;

      const markdownMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (markdownMatch) {
        jsonContent = markdownMatch[1];
        logger.debug('从 Markdown 代码块中提取 JSON');
      }

      const firstBrace = jsonContent.indexOf('{');
      const lastBrace = jsonContent.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        logger.error('无法提取 JSON，响应内容:', { jsonContent });
        throw new Error('无法从响应中提取 JSON：未找到有效的 JSON 对象结构');
      }

      jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
      logger.debug('提取的 JSON 内容', { jsonContent: jsonContent.substring(0, 300) });

      const insights = JSON.parse(jsonContent);

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
      throw new Error(`解析 AI 洞察失败：${error.message}`);
    }
  }

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

  async saveInsights(type, identifier, insights) {
    const filePath = getAIInsightsPath(type, identifier);
    await writeJson(filePath, insights);
    logger.debug(`AI 洞察已保存：${filePath}`);
  }
}

module.exports = InsightAnalyzer;
