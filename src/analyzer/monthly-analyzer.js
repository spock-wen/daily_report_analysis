const { callLLM } = require('../utils/llm');
const { writeJson } = require('../utils/fs');
const { getAIInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');
const prompts = require('../../config/prompts.json');
const history = require('../metrics/history');
const { computeMonthlyMetrics } = require('../metrics');
const { loadConfig } = require('../checker/config');

function collectSuggestions(insights) {
  const lines = [];
  const push = (value) => {
    if (typeof value === 'string' && value.trim()) {
      lines.push(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(push);
    }
  };

  push(insights?.action);
  push(insights?.recommendations?.developers);
  push(insights?.recommendations?.enterprises);
  push(insights?.nextWeekPoints);
  push(insights?.trends?.shortTerm);
  return Array.from(new Set(lines));
}

function previousMonths(month) {
  const months = [];
  let cursor = month;
  for (let i = 0; i < 2; i += 1) {
    cursor = history.getPrevMonth(cursor);
    if (!cursor) break;
    months.push(cursor);
  }
  return months;
}

function buildRecentSuggestions(month) {
  if (!month) return '（无）';
  const lines = [];
  for (const previous of previousMonths(month)) {
    const insights = history.readMonthlyInsights(previous);
    for (const item of collectSuggestions(insights)) {
      lines.push(`${previous}：${item}`);
    }
  }
  const unique = Array.from(new Set(lines));
  return unique.length > 0 ? unique.slice(0, 12).join('\n') : '（无）';
}

/**
 * 月度 AI 分析器
 * 负责对聚合后的月度数据进行深度 AI 分析
 */
class MonthlyAnalyzer {
  constructor(options = {}) {
    this.aiCallCount = 0;
  }

  getAiCallCount() {
    return this.aiCallCount;
  }

  buildFeedbackPrompt(feedback) {
    if (!Array.isArray(feedback) || feedback.length === 0) return '';
    const items = feedback.slice(0, 40).map(item => {
      const quote = item.quote ? `（原句：${item.quote}）` : '';
      return `- [${item.rule_id}] ${item.field || ''} ${item.message}${quote}`;
    });
    return `\n\n【上一版输出未通过内容核查，请逐条修正后重新输出完整 JSON（不要解释）】\n${items.join('\n')}`;
  }

  /**
   * 分析月度数据
   * @param {Object} monthlyData - 聚合后的月度数据
   * @returns {Promise<Object>} AI 分析结果
   */
  async analyze(monthlyData, options = {}) {
    try {
      logger.info('开始分析月报数据...', { month: monthlyData.month });

      // 构建分析上下文
      const contextData = this.prepareContextData(monthlyData);

      // 构建 AI 提示词
      let prompt = this.buildPrompt(monthlyData.month, contextData);
      prompt += this.buildFeedbackPrompt(options.feedback);
      logger.info('Prompt 构建完成', { promptLength: prompt.length });

      // 调用 LLM
      let result;
      try {
        this.aiCallCount += 1;
        result = await callLLM(prompt, {
          temperature: 0.7,
          max_tokens: 8000
        });
        logger.info('LLM 调用完成');
      } catch (llmError) {
        logger.error(`LLM 调用失败：${llmError.message}`);
        return this.getFallbackInsights(llmError.message);
      }

      // 解析 AI 响应
      const insights = this.parseInsights(result, monthlyData, contextData);

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
    const month = monthlyData.month || monthlyData.date || '';

    let computed = null;
    try {
      computed = month ? computeMonthlyMetrics(month) : null;
    } catch (error) {
      logger.warn(`读取月度指标失败：${error.message}`);
    }

    const stats = monthlyData.stats?.totalProjects
      ? monthlyData.stats
      : (computed?.stats || monthlyData.stats || {});
    const priorProjects = stats.priorProjects
      ?? (computed?.stats?.totalProjects !== undefined && computed?.rookiesCount !== undefined
        ? computed.stats.totalProjects - computed.rookiesCount
        : undefined);
    const rookiesCount = monthlyData.rookiesCount
      ?? computed?.rookiesCount
      ?? (stats.totalProjects !== undefined && priorProjects !== undefined
        ? stats.totalProjects - priorProjects
        : undefined);
    const monthTop = monthlyData.monthTop || computed?.monthTop || [];
    const facts = {
      month,
      caption: monthlyData.caption || computed?.caption,
      stats,
      rookiesCount,
      priorProjects,
      prevMonthStats: monthlyData.prevMonthStats || computed?.prevMonthStats,
      weekThemes: monthlyData.weekThemes || computed?.weekThemes,
      monthTop,
      dropList: monthlyData.dropList || computed?.dropList,
      dropListNote: monthlyData.dropListNote || computed?.dropListNote,
      top5Share: monthlyData.top5Share ?? computed?.top5Share,
      newStarsTotal: monthlyData.newStarsTotal ?? computed?.newStarsTotal,
      aggregateRule: '汇总数字（如 newStarsTotal、本月新增星合计）写入文案时必须带「合计」字样，例：本月合计新增 297628 星；不带「合计」会被核查按单项目归属判 FAIL。'
    };

    // 提取上/中/下旬项目
    const trendEvolution = aggregation.trendEvolution || [];
    const periodProjects = trendEvolution.map(period => ({
      period: period.period,
      dates: period.dates,
      projectCount: period.projectCount,
      topType: period.topType,
      keyProjects: period.keyProjects?.slice(0, 3) || []
    }));

    // TOP 候选优先使用 monthTop（按本月新增星排序）
    const candidateRepos = monthTop.length > 0
      ? monthTop.map(item => ({
          repo: item.fullName,
          stars: item.lastStars,
          monthStars: item.monthStars,
          daysOnList: item.daysOnList,
          description: item.project?.description || item.description
        }))
      : [
          ...(aggregation.topGainers?.slice(0, 5).map(p => ({
            repo: p.repo,
            stars: p.stars,
            appearanceCount: p.appearanceCount,
            description: p.description
          })) || []),
          ...(aggregation.recurringProjects?.slice(0, 5).map(p => ({
            repo: p.repo,
            appearanceCount: p.count,
            description: p.description
          })) || [])
        ];

    // 准备所有上榜项目列表（用于验证 AI 生成的项目）
    const allRepos = [
      ...new Set([
        ...(monthTop.map(item => item.fullName)),
        ...(aggregation.topGainers?.map(p => p.repo) || []),
        ...(aggregation.recurringProjects?.map(p => p.repo) || [])
      ].filter(Boolean))
    ];

    return {
      month,
      dailyCount: monthlyData.dailyDataList?.length || 0,
      weeklyCount: monthlyData.weeklyDataList?.length || 0,
      totalProjects: stats.totalProjects ?? 0,
      recurringCount: stats.recurringProjects ?? aggregation.recurringProjects?.length ?? 0,
      newProjectsCount: stats.newProjects ?? aggregation.newProjects?.length ?? 0,
      typeDistribution: aggregation.typeDistribution || {},
      languageDistribution: aggregation.languageDistribution || {},
      periodProjects,
      topProjectCandidates: candidateRepos,
      allRepos,
      metrics: facts,
      recentSuggestions: buildRecentSuggestions(month)
    };
  }

  /**
   * 构建 AI 提示词
   */
  buildPrompt(month, contextData) {
    const systemPrompt = prompts.monthly?.systemPrompt || '';
    const userPrompt = prompts.monthly?.userPrompt || '';
    const checkerConfig = loadConfig();

    const periodText = contextData.periodProjects.map(p =>
      `- ${p.period} (${p.dates}): ${p.projectCount} 个项目，主导类型：${p.topType}；关键项目：${p.keyProjects.join(', ')}`
    ).join('\n');

    const candidateText = contextData.topProjectCandidates.map(p => {
      const parts = [p.repo];
      if (p.monthStars !== undefined) parts.push(`本月新增 ${p.monthStars}`);
      if (p.daysOnList !== undefined) parts.push(`上榜 ${p.daysOnList} 天`);
      if (p.stars) parts.push(`累计 ${p.stars}`);
      if (p.appearanceCount) parts.push(`出现 ${p.appearanceCount} 次`);
      return `- ${parts.join('，')}`;
    }).join('\n');

    const repoText = contextData.allRepos.slice(0, 80).map(repo => `- ${repo}`).join('\n');

    let prompt = userPrompt;
    prompt = prompt.replace('{month}', month);
    prompt = prompt.replace('{dailyCount}', contextData.dailyCount);
    prompt = prompt.replace('{weeklyCount}', contextData.weeklyCount);
    prompt = prompt.replace('{totalProjects}', contextData.totalProjects);
    prompt = prompt.replace('{metricsFacts}', JSON.stringify(contextData.metrics || {}, null, 2));
    prompt = prompt.replace('{periodProjects}', periodText);
    prompt = prompt.replace('{topProjectCandidates}', candidateText);
    prompt = prompt.replace('{allRepos}', repoText);
    prompt = prompt.replace('{recentSuggestions}', contextData.recentSuggestions || '（无）');
    prompt = prompt.replace('{bannedWords}', (checkerConfig.bannedWords || []).join('\n'));

    return systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  }

  /**
   * 解析 AI 响应
   */
  parseInsights(llmResponse, monthlyData, contextData = {}) {
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

      // 尝试解析 JSON，处理常见格式问题
      let insights;
      try {
        insights = JSON.parse(jsonContent);
      } catch (parseError) {
        logger.warn('JSON 解析失败，尝试修复...', { error: parseError.message });

        // 尝试 1: 清理中文标点
        let cleaned = jsonContent
          .replace(/，/g, ',')  // 中文逗号
          .replace(/"/g, '"')   // 中文双引号
          .replace(/:/g, ':')   // 中文冒号
          .replace(/,\s*([}\]])/g, '$1');  // 尾随逗号
        try {
          insights = JSON.parse(cleaned);
        } catch (parseError2) {
          // 尝试 2: 使用更严格的括号匹配重新提取
          logger.warn('修复中文标点后仍失败，尝试重新提取 JSON...');
          let braceCount = 0;
          let endPos = 0;
          for (let i = firstBrace; i < jsonContent.length; i++) {
            if (jsonContent[i] === '{') braceCount++;
            else if (jsonContent[i] === '}') braceCount--;
            if (braceCount === 0) {
              endPos = i + 1;
              break;
            }
          }
          cleaned = jsonContent.substring(0, endPos);
          try {
            insights = JSON.parse(cleaned);
          } catch (parseError3) {
            // 尝试 3: 移除字符串中的换行和多余空格
            cleaned = cleaned.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
            insights = JSON.parse(cleaned);
          }
        }
      }

      // 补充项目链接等元数据，并验证项目是否存在于实际数据中
      const trendingRepos = monthlyData.aggregation?.topGainers || [];
      const recurringRepos = monthlyData.aggregation?.recurringProjects || [];
      const metricTop = contextData.metrics?.monthTop || monthlyData.monthTop || [];
      const allValidRepos = new Set([
        ...trendingRepos.map(p => p.repo),
        ...recurringRepos.map(p => p.repo),
        ...metricTop.map(item => item.fullName)
      ].filter(Boolean));

      logger.info('验证 AI 生成的项目是否存在于实际数据中...', {
        validReposCount: allValidRepos.size,
        longTermValueCount: insights.longTermValue?.length || 0
      });

      // 验证并过滤 longTermValue 中的项目
      if (insights.longTermValue) {
        insights.longTermValue = insights.longTermValue
          .filter(item => {
            if (!allValidRepos.has(item.repo)) {
              logger.warn(`过滤掉不存在的项目：${item.repo}`);
              return false;
            }
            return true;
          })
          .map(item => {
            const repo = trendingRepos.find(r => r.repo === item.repo) ||
                         recurringRepos.find(r => r.repo === item.repo);
            const metric = metricTop.find(entry => entry.fullName === item.repo);
            const rest = { ...item };
            delete rest.score;
            return {
              ...rest,
              stars: metric?.lastStars || repo?.stars || repo?.totalStars || 0,
              monthStars: metric?.monthStars,
              daysOnList: metric?.daysOnList,
              language: repo?.language || '',
              description: repo?.description || ''
            };
          });
      }

      // 验证并过滤 trendEvolution 中的项目
      if (insights.trendEvolution) {
        insights.trendEvolution = insights.trendEvolution.map(period => ({
          ...period,
          keyProjects: (period.keyProjects || []).filter(repo => {
            if (!allValidRepos.has(repo)) {
              logger.warn(`过滤掉 trendEvolution 中不存在的项目：${repo}`);
              return false;
            }
            return true;
          })
        }));
      }

      // 验证并过滤 emergingFields 中的项目
      if (insights.emergingFields) {
        insights.emergingFields = insights.emergingFields.map(field => ({
          ...field,
          projects: (field.projects || []).filter(repo => {
            if (!allValidRepos.has(repo)) {
              logger.warn(`过滤掉 emergingFields 中不存在的项目：${repo}`);
              return false;
            }
            return true;
          })
        }));
      }

      // 验证并过滤 darkHorse
      if (insights.darkHorse && !allValidRepos.has(insights.darkHorse.repo)) {
        logger.warn(`过滤掉 darkHorse 不存在的项目：${insights.darkHorse.repo}`);
        // 选择星数最高的项目作为 darkHorse
        const topRepo = trendingRepos[0];
        if (topRepo) {
          insights.darkHorse = {
            repo: topRepo.repo,
            reason: '本月星数增长最快的项目'
          };
        } else {
          insights.darkHorse = null;
        }
      } else if (insights.darkHorse) {
        const darkHorseRepo = trendingRepos.find(r => r.repo === insights.darkHorse.repo) ||
                              recurringRepos.find(r => r.repo === insights.darkHorse.repo);
        insights.darkHorse = {
          ...insights.darkHorse,
          stars: darkHorseRepo?.stars || darkHorseRepo?.totalStars || 0,
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
