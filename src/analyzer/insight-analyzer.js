const fs = require('fs');
const { callLLM } = require('../utils/llm');
const { writeJson } = require('../utils/fs');
const { getAIInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');
const prompts = require('../../config/prompts.json');
const WikiManager = require('../wiki/wiki-manager');
const history = require('../metrics/history');
const { loadConfig } = require('../checker/config');
const { computeMonthlyMetrics } = require('../metrics');
const { buildFacts } = require('../facts/build-facts');
const { projectNameFromPlaceholder } = require('../render/placeholder-renderer');
const { translateDescription } = require('./project-analyzer');

const WRITING_RULES = {
  oneLiner: '前 2 天（日报）/前 2 期（周/月报）oneLiner 已注入，必须换一种说法，不得复用 4 字以上短语。',
  numbers: '一个分句只写一个项目的数字；每张卡片只写本卡项目的数字，不写其他项目的数字。',
  cumulative: '累计数必须写「累计」字样（累计 X 星）。',
  fullName: '仓库名必须逐字复制注入的 fullName 清单，不得手写、缩写或改写大小写。',
  bannedWords: '禁词表已注入；月报引用 weekThemes 旧周主题时必须改写去禁词。'
};

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function previousIdentifiers(level, identifier) {
  const result = [];
  if (level === 'daily') {
    let cursor = identifier;
    for (let i = 0; i < 2; i += 1) {
      cursor = history.getPreviousDailyDate(cursor);
      if (!cursor) break;
      result.push(cursor);
    }
    return result;
  }

  if (level === 'weekly') {
    let cursor = identifier;
    for (let i = 0; i < 2; i += 1) {
      cursor = history.shiftISOWeek(cursor, -1);
      if (!cursor) break;
      result.push(cursor);
    }
    return result;
  }

  if (level === 'monthly') {
    let cursor = identifier;
    for (let i = 0; i < 2; i += 1) {
      cursor = history.getPrevMonth(cursor);
      if (!cursor) break;
      result.push(cursor);
    }
  }
  return result;
}

function readInsights(level, identifier) {
  if (level === 'weekly') return history.readWeeklyInsights(identifier);
  if (level === 'monthly') return history.readMonthlyInsights(identifier);
  return readJsonFile(getAIInsightsPath('daily', identifier));
}

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
  constructor(options = {}) {
    this.wikiManager = new WikiManager(options);
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
    return `\n\n## 上一版输出未通过内容核查，请逐条修正后重新输出完整 JSON（不要解释）\n${items.join('\n')}`;
  }

  async analyzeDaily(dailyData, options = {}) {
    try {
      logger.info('开始分析日报数据...', { date: dailyData.date });

      const facts = dailyData.facts || options.facts
        || buildFacts({ level: 'daily', period: dailyData.date, brief: dailyData.brief });
      const contextData = await this.prepareContextData(dailyData.brief, {
        level: 'daily',
        identifier: dailyData.date,
        rawData: dailyData,
        facts
      });
      const promptTemplate = prompts.daily.userPrompt;
      let prompt = this.buildPrompt(promptTemplate, contextData);
      prompt += this.buildFeedbackPrompt(options.feedback);

      this.aiCallCount += 1;
      const result = await callLLMWithRetry(prompt, {
        temperature: 0.7,
        max_tokens: 8000
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

  async analyzeWeekly(weeklyData, options = {}) {
    try {
      logger.info('开始分析周报数据...', { weekStart: weeklyData.weekStart });

      const facts = weeklyData.facts || options.facts
        || buildFacts({
          level: 'weekly',
          period: weeklyData.weekStart || weeklyData.date,
          brief: weeklyData.brief,
          metrics: weeklyData.weekMetrics,
        });
      const contextData = await this.prepareContextData(weeklyData.brief, {
        level: 'weekly',
        identifier: weeklyData.weekStart || weeklyData.date,
        rawData: weeklyData,
        facts
      });
      const promptTemplate = prompts.weekly.userPrompt;
      let prompt = this.buildPrompt(promptTemplate, contextData);
      prompt += this.buildFeedbackPrompt(options.feedback);
      logger.info('Prompt 构建完成，准备调用 LLM...', { promptLength: prompt.length });

      let result;
      try {
        this.aiCallCount += 1;
        result = await callLLMWithRetry(prompt, {
          temperature: 0.7,
          max_tokens: 8000
        });
        logger.info('LLM 调用完成，开始解析结果...');
      } catch (llmError) {
        logger.error(`LLM 调用失败: ${llmError.message}`, { stack: llmError.stack });
        return this.getWeeklyFallbackInsights(llmError.message);
      }

      const insights = this.parseInsights(result, weeklyData.brief);
      this.applyWeeklyFactFallbacks(insights, contextData.metrics, contextData.facts);
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

  async analyzeMonthly(monthlyData, options = {}) {
    try {
      logger.info('开始分析月报数据...', { month: monthlyData.month });

      const month = monthlyData.month || monthlyData.date;
      let computed = monthlyData.metrics || null;
      if (!computed && month) {
        try {
          computed = computeMonthlyMetrics(month);
        } catch (error) {
          logger.warn(`读取月度指标失败：${error.message}`);
        }
      }
      const facts = monthlyData.facts || options.facts
        || buildFacts({
          level: 'monthly',
          period: month,
          brief: monthlyData.brief || monthlyData,
          metrics: computed || monthlyData
        });
      const contextData = await this.prepareContextData(monthlyData.brief, {
        level: 'monthly',
        identifier: monthlyData.month || monthlyData.date,
        rawData: monthlyData,
        facts
      });
      const promptTemplate = prompts.monthly.userPrompt;
      let prompt = this.buildPrompt(promptTemplate, contextData);
      prompt += this.buildFeedbackPrompt(options.feedback);

      this.aiCallCount += 1;
      const result = await callLLMWithRetry(prompt, {
        temperature: 0.7,
        max_tokens: 8000
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
        max_tokens: 8000
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

  async prepareContextData(briefData, options = {}) {
    const brief = briefData || {};
    const trendingRepos = brief.projects || brief.trending_repos || [];

    logger.debug('准备上下文数据', {
      trendingReposCount: trendingRepos.length,
      sampleRepo: trendingRepos[0]
    });

    // 并发读取所有项目的 Wiki 历史
    const hasChinese = text => /[\u4e00-\u9fa5]/.test(String(text || ''));
    const projectsWithHistory = await Promise.all(
      trendingRepos.map(async (repo) => {
        const fullName = repo.fullName || repo.name;
        const [owner, repoName] = fullName.split('/');

        let wikiHistory = [];
        try {
          wikiHistory = await this.wikiManager.getRecentHistory(owner, repoName, 3);
        } catch (error) {
          logger.warn(`读取 Wiki 历史失败：${fullName} - ${error.message}`);
        }

        const description = repo.description || repo.desc || '';
        let descZh = repo.descZh || '';
        if (!hasChinese(descZh)) {
          const source = descZh || description;
          if (source) {
            descZh = await translateDescription(source);
            if (!hasChinese(descZh)) {
              logger.warn(`项目描述翻译失败，沿用原文：${fullName}`);
            }
          }
        }

        return {
          name: fullName,
          fullName,
          description,
          descZh,
          stars: repo.stars || 0,
          todayStars: Number(repo.todayStars) || 0,
          forks: repo.forks || 0,
          language: repo.language || '',
          topics: repo.topics || [],
          url: repo.url || '',
          isAI: repo.isAI || false,
          wikiHistory // 新增字段
        };
      })
    );

    const stats = brief.stats || {};
    const level = options.level || null;
    const identifier = options.identifier || brief.date || brief.weekStart || brief.month || '';
    const rawData = options.rawData || brief;

    const facts = options.facts || rawData.facts || null;
    const metrics = this.buildMetricsFacts(brief, rawData, level, identifier);
    if (level === 'monthly' && Array.isArray(facts?.projects) && facts.projects.length > 0) {
      metrics.allRepos = facts.projects;
    }

    const result = {
      level,
      identifier,
      projects: projectsWithHistory,
      stats,
      facts,
      metrics,
      recentOneLiners: this.buildRecentOneLiners(level, identifier),
      recentSuggestions: this.buildRecentSuggestions(level, identifier),
      baseline: level === 'daily' ? this.buildBaselineNote(brief) : null,
      generatedAt: brief.generatedAt || brief.generated_at || new Date().toISOString()
    };

    logger.debug('上下文数据准备完成', {
      projectsCount: result.projects.length,
      sampleProject: result.projects[0]
    });

    return result;
  }

  buildMetricsFacts(brief, rawData, level, identifier) {
    const source = rawData || {};
    const pick = (key) => (source[key] !== undefined ? source[key] : brief[key]);
    const projects = brief.projects || brief.trending_repos || [];
    const projectFacts = projects.map(project => ({
      fullName: project.fullName || project.repo || project.name || '',
      todayStars: Number(project.todayStars) || 0,
      stars: Number(project.stars) || 0
    }));

    if (level === 'daily') {
      return {
        level,
        date: identifier,
        caption: pick('caption'),
        dailyDiff: pick('dailyDiff'),
        streakDays: pick('streakDays'),
        projects: projectFacts,
        writingRules: WRITING_RULES
      };
    }

    if (level === 'weekly') {
      const metrics = source.weekMetrics || brief.weekMetrics || {};
      return {
        level,
        week: identifier,
        caption: pick('caption') || metrics.caption,
        weekNewStars: pick('weekNewStars') !== undefined ? pick('weekNewStars') : metrics.weekNewStars,
        prevWeekStats: pick('prevWeekStats') || metrics.prevWeekStats,
        wow: metrics.wow,
        churnRate: metrics.churnRate,
        churnCount: metrics.churnCount,
        dailyCounts: pick('dailyCounts') || metrics.dailyCounts,
        dailyTop3: metrics.dailyTop3,
        dailyTop3Stats: metrics.dailyTop3Stats,
        new: metrics.new,
        continuing: metrics.continuing,
        returning: metrics.returning,
        out: metrics.out,
        projects: projectFacts,
        aggregateRule: '汇总数字（如 weekNewStars、周榜新增星总数）写入文案时必须带「合计」字样，例：周榜合计新增 297628 星；不带「合计」会被核查按单项目归属判 FAIL。',
        writingRules: WRITING_RULES
      };
    }

    if (level === 'monthly') {
      const monthTop = pick('monthTop') || [];
      const aggregation = source.aggregation || {};
      const periodProjects = (aggregation.trendEvolution || []).map(period => ({
        period: period.period,
        dates: period.dates,
        projectCount: period.projectCount,
        topType: period.topType,
        keyProjects: (period.keyProjects || []).slice(0, 3)
      }));
      const topProjectCandidates = monthTop.map(item => ({
        repo: item.fullName,
        monthStars: item.monthStars,
        daysOnList: item.daysOnList,
        stars: item.lastStars
      }));
      const allRepos = [
        ...new Set([
          ...monthTop.map(item => item.fullName),
          ...(aggregation.topGainers?.map(item => item.repo) || []),
          ...(aggregation.recurringProjects?.map(item => item.repo) || [])
        ].filter(Boolean))
      ];
      const stats = pick('stats') || {};
      const priorProjects = stats.priorProjects ?? stats.prior_projects;
      const rookiesCount = pick('rookiesCount')
        ?? (stats.totalProjects !== undefined && priorProjects !== undefined
          ? stats.totalProjects - priorProjects
          : undefined);

      return {
        level,
        month: identifier,
        dailyCount: source.dailyDataList?.length || 0,
        weeklyCount: source.weeklyDataList?.length || 0,
        caption: pick('caption'),
        stats,
        rookiesCount,
        priorProjects,
        prevMonthStats: pick('prevMonthStats'),
        weekThemes: pick('weekThemes'),
        monthTop,
        dropList: pick('dropList'),
        dropListNote: pick('dropListNote'),
        top5Share: pick('top5Share'),
        newStarsTotal: pick('newStarsTotal'),
        periodProjects,
        topProjectCandidates,
        allRepos,
        projects: projectFacts,
        aggregateRule: '汇总数字（如 newStarsTotal、本月新增星合计）写入文案时必须带「合计」字样，例：本月合计新增 297628 星；不带「合计」会被核查按单项目归属判 FAIL。',
        writingRules: WRITING_RULES
      };
    }

    return { projects: projectFacts };
  }

  buildRecentOneLiners(level, identifier) {
    if (!level || !identifier) return '（无）';
    const lines = [];
    for (const previous of previousIdentifiers(level, identifier)) {
      const insights = readInsights(level, previous);
      const oneLiner = insights?.oneLiner
        || insights?.weeklyTheme?.oneLiner
        || insights?.monthlyTheme?.oneLiner;
      if (oneLiner) lines.push(`${previous}：${oneLiner}`);
    }
    return lines.length > 0 ? lines.join('\n') : '（无）';
  }

  // J1：基准按抓取日判定；没有更早抓取日快照时明确写「无基准」。
  buildBaselineNote(brief) {
    const baseline = history.getBaselineSnapshot(brief?.scrapedAt || brief?.generatedAt);
    if (!baseline) {
      return '无基准（没有早于本期抓取日的快照，不得写昨日/7 日均值/上月同期对比）';
    }
    return `基准快照 ${baseline.date}（抓取日 ${baseline.snapshotDate}）`;
  }

  buildRecentSuggestions(level, identifier) {
    if (!level || !identifier) return '（无）';

    // C5：日报按「期次 + 建议文本 + 建议对象」注入近 2 期 action，供模型判断是否连续第 3 次推荐同一对象。
    if (level === 'daily') {
      const blocks = [];
      for (const previous of previousIdentifiers(level, identifier)) {
        const insights = readInsights(level, previous);
        const actions = Array.isArray(insights?.action)
          ? insights.action.filter(item => typeof item === 'string' && item.trim())
          : [];
        if (actions.length === 0) continue;
        const names = history.getProjectNames(history.readDailyBrief(previous));
        blocks.push({
          period: previous,
          actions: actions.map(text => ({
            text,
            objects: names.filter(name => text.includes(name) || text.includes(name.split('/')[1] || '')),
          })),
        });
      }
      return blocks.length > 0 ? JSON.stringify(blocks, null, 2) : '（无）';
    }

    const suggestions = [];
    for (const previous of previousIdentifiers(level, identifier)) {
      const insights = readInsights(level, previous);
      for (const item of collectSuggestions(insights)) {
        suggestions.push(`${previous}：${item}`);
      }
    }
    const unique = Array.from(new Set(suggestions));
    return unique.length > 0 ? unique.slice(0, 12).join('\n') : '（无）';
  }

  applyWeeklyFactFallbacks(insights, metrics, facts) {
    if (!insights || !metrics) return;

    const currentWeekly = new Set([
      ...(metrics.new || []),
      ...(metrics.continuing || []),
      ...(metrics.returning || [])
    ]);
    const existingText = JSON.stringify(insights);
    const notes = Array.isArray(insights.dailyTop3Notes) ? insights.dailyTop3Notes.slice() : [];
    const factByLabel = new Map();
    for (const fact of facts?.facts || []) {
      if (fact.label) factByLabel.set(fact.label, fact);
    }
    const factPlaceholder = fact => (fact.role ? `{{${fact.id}:${fact.role}}}` : `{{${fact.id}}}`);

    for (const item of metrics.dailyTop3Stats || []) {
      if (existingText.includes(item.fullName)) continue;
      const daysFact = factByLabel.get(`${item.fullName} 本周日报上榜天数`);
      const starsFact = factByLabel.get(`${item.fullName} 本周日报新增星`);
      if (!daysFact || !starsFact) continue;
      const inWeekly = currentWeekly.has(item.fullName);
      notes.push({
        repo: `{{p:${item.fullName}}}`,
        note: inWeekly
          ? `本周日报上榜 ${factPlaceholder(daysFact)} 天，期内新增 ${factPlaceholder(starsFact)} 星，同时进入周榜。`
          : `本周日报上榜 ${factPlaceholder(daysFact)} 天，期内新增 ${factPlaceholder(starsFact)} 星，但未进入周榜，原因未知。`
      });
    }

    if (notes.length > 0) {
      insights.dailyTop3Notes = notes;
    }
  }

  buildPrompt(template, contextData) {
    let prompt = template;

    prompt = prompt.replace('{date}', contextData.identifier || contextData.generatedAt || new Date().toISOString());
    prompt = prompt.replace('{baseline}', contextData.baseline || '（无）');
    prompt = prompt.replace('{projectCount}', contextData.projects.length);

    const factList = Array.isArray(contextData.facts?.facts) ? contextData.facts.facts : [];
    const factsForPrompt = factList.map(item => ({
      id: item.id,
      role: item.role,
      label: item.label,
      value: item.value,
      project: item.project ?? null,
      kind: item.kind
    }));
    prompt = prompt.replace('{facts}', () => JSON.stringify(factsForPrompt, null, 2));

    const projectByName = new Map(contextData.projects.map(p => [p.fullName || p.name, p]));
    const candidateByName = new Map(
      (contextData.metrics?.topProjectCandidates || []).map(item => [item.repo, item])
    );
    const factProjectNames = Array.isArray(contextData.facts?.projects) ? contextData.facts.projects : [];
    const projectsForPrompt = (factProjectNames.length > 0 ? factProjectNames : contextData.projects.map(p => p.fullName || p.name))
      .filter(Boolean)
      .map(name => {
        const project = projectByName.get(name) || {};
        const candidate = candidateByName.get(name) || {};
        return {
          fullName: name,
          description: project.description || candidate.description || '',
          descZh: project.descZh || '',
          language: project.language || '',
          topics: project.topics || [],
          url: project.url || '',
          isAI: project.isAI || false
        };
      });

    prompt = prompt.replace('{projects}', () => JSON.stringify(projectsForPrompt, null, 2));

    // 新增：生成 Wiki 历史上下文
    const wikiHistoryContext = this.buildWikiHistoryContext(contextData.projects);
    prompt = prompt.replace('{wikiHistoryContext}', wikiHistoryContext);

    const stats = contextData.stats || {};
    const totalProjects = stats.totalProjects ?? stats.total_projects ?? stats.total ?? contextData.projects.length;
    const aiProjects = stats.aiProjects ?? stats.ai_projects ?? contextData.projects.filter(p => p.isAI).length;
    const aiPercentage = totalProjects > 0 ? Math.round((aiProjects / totalProjects) * 100) : 0;

    prompt = prompt.replace('{totalProjects}', totalProjects);
    prompt = prompt.replace('{aiProjects}', aiProjects);
    prompt = prompt.replace('{aiPercentage}', aiPercentage);
    prompt = prompt.replace('{topProjects}', JSON.stringify(projectsForPrompt.slice(0, 5), null, 2));
    prompt = prompt.replace('{week}', contextData.identifier || '');
    prompt = prompt.replace('{month}', contextData.identifier || '');

    const metrics = contextData.metrics || {};
    prompt = prompt.replace('{dailyCount}', metrics.dailyCount || 0);
    prompt = prompt.replace('{weeklyCount}', metrics.weeklyCount || 0);
    prompt = prompt.replace('{periodProjects}', (metrics.periodProjects || []).map(period =>
      `- ${period.period} (${period.dates}): 主导类型：${period.topType || '未知'}；关键项目：${(period.keyProjects || []).map(repo => `{{p:${repo}}}`).join('、')}`
    ).join('\n'));
    prompt = prompt.replace('{topProjectCandidates}', (metrics.topProjectCandidates || [])
      .map(item => `- {{p:${item.repo}}}`)
      .join('\n'));
    prompt = prompt.replace('{allRepos}', (metrics.allRepos || []).slice(0, 80).map(repo => `- {{p:${repo}}}`).join('\n'));

    const checkerConfig = loadConfig();
    prompt = prompt.replace('{metricsFacts}', JSON.stringify(contextData.metrics || {}, null, 2));
    prompt = prompt.replace('{recentOneLiners}', contextData.recentOneLiners || '（无）');
    prompt = prompt.replace('{recentSuggestions}', contextData.recentSuggestions || '（无）');
    prompt = prompt.replace('{bannedWords}', (checkerConfig.bannedWords || []).join('\n'));
    prompt = prompt.replace('{compareWords}', (checkerConfig.compareWords || []).join('、'));

    prompt = prompt.replace('{{projects_count}}', contextData.projects.length);
    prompt = prompt.replace('{{projects_json}}', JSON.stringify(contextData.projects, null, 2));

    if (prompt.includes('{{stats_json}}')) {
      prompt = prompt.replace('{{stats_json}}', JSON.stringify(stats, null, 2));
    }

    return prompt;
  }

  /**
   * 构建 Wiki 历史上下文字符串
   * @param {Array} projects - 包含 wikiHistory 的项目数组
   * @returns {string} 格式化的历史上下文
   */
  buildWikiHistoryContext(projects) {
    const hasHistory = projects.some(p => p.wikiHistory && p.wikiHistory.length > 0);
    if (!hasHistory) {
      return '（无历史记录）';
    }

    let context = '';
    for (const project of projects) {
      if (project.wikiHistory && project.wikiHistory.length > 0) {
        context += `\n- ${project.fullName}:\n`;
        for (const record of project.wikiHistory) {
          context += `  · ${record.date} (${record.eventType}): ${record.analysis}\n`;
        }
      }
    }
    return context || '（无历史记录）';
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

      // 清洗字符串字面量内的裸控制字符（LLM 输出可能包含未转义的换行/制表符，JSON.parse 会拒绝）
      jsonContent = jsonContent.replace(/[\u0000-\u001F\u007F]/g, ' ');
      // 去除尾随逗号（部分 LLM 输出 ", }" / ", ]"，JSON.parse 会拒绝）
      jsonContent = jsonContent.replace(/,\s*([}\]])/g, '$1');

      const insights = JSON.parse(jsonContent);

      if (insights.project_insights) {
        const trendingRepos = briefData.projects || briefData.trending_repos || [];
        insights.project_insights = insights.project_insights.map(insight => {
          const projectName = projectNameFromPlaceholder(insight.project_name);
          const repo = trendingRepos.find(r => {
            const name = r.name || r.fullName || r.repo;
            return name === projectName || r.fullName === projectName;
          });
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

      // 清洗字符串字面量内的裸控制字符（LLM 输出可能包含未转义的换行/制表符，JSON.parse 会拒绝）
      jsonContent = jsonContent.substring(firstBrace, lastBrace + 1).replace(/[\u0000-\u001F\u007F]/g, ' ');
      jsonContent = jsonContent.replace(/,\s*([}\]])/g, '$1');

      return JSON.parse(jsonContent);
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
