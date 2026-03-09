const path = require('path');
const { readJson, fileExists, ensureDir } = require('../utils/fs');
const { getDailyBriefPath, getWeeklyBriefPath, getMonthlyBriefPath, getAIInsightsPath } = require('../utils/path');
const logger = require('../utils/logger');

/**
 * 数据加载器 - 负责加载和验证报告数据
 */
class DataLoader {
  /**
   * 加载日报数据
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @returns {Promise<Object>} 日报数据
   */
  async loadDailyData(date) {
    try {
      const briefPath = getDailyBriefPath(date);
      const aiInsightsPath = getAIInsightsPath('daily', date);

      logger.debug(`加载日报数据：${date}`, { briefPath, aiInsightsPath });

      // 检查文件是否存在
      if (!await fileExists(briefPath)) {
        throw new Error(`日报数据文件不存在：${briefPath}`);
      }

      // 加载基础数据
      const rawData = await readJson(briefPath);
      
      // 支持两种数据格式：新格式 (trending_repos) 和旧格式 (projects)
      const briefData = this.normalizeDataFormat(rawData);
      
      // 尝试加载 AI 洞察数据（可选）
      let aiInsights = null;
      if (await fileExists(aiInsightsPath)) {
        aiInsights = await readJson(aiInsightsPath);
        logger.info(`已加载 AI 洞察数据：${date}`);
      } else {
        logger.warn(`AI 洞察数据不存在：${aiInsightsPath}`);
      }

      return {
        date,
        type: 'daily',
        brief: briefData,
        aiInsights,
        loadedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`加载日报数据失败：${error.message}`, { date });
      throw error;
    }
  }

  /**
   * 加载周报数据
   * @param {string} weekStart - 周起始日期 (YYYY-MM-DD)
   * @returns {Promise<Object>} 周报数据
   */
  async loadWeeklyData(weekStart) {
    try {
      const briefPath = getWeeklyBriefPath(weekStart);
      const aiInsightsPath = getAIInsightsPath('weekly', weekStart);

      logger.debug(`加载周报数据：${weekStart}`, { briefPath, aiInsightsPath });

      if (!await fileExists(briefPath)) {
        throw new Error(`周报数据文件不存在：${briefPath}`);
      }

      const rawData = await readJson(briefPath);
      const briefData = this.normalizeDataFormat(rawData);
      
      let aiInsights = null;
      if (await fileExists(aiInsightsPath)) {
        aiInsights = await readJson(aiInsightsPath);
        logger.info(`已加载 AI 洞察数据：${weekStart}`);
      } else {
        logger.warn(`AI 洞察数据不存在：${aiInsightsPath}`);
      }

      return {
        weekStart,
        type: 'weekly',
        brief: briefData,
        aiInsights,
        loadedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`加载周报数据失败：${error.message}`, { weekStart });
      throw error;
    }
  }

  /**
   * 加载月报数据
   * @param {string} month - 月份 (YYYY-MM)
   * @returns {Promise<Object>} 月报数据
   */
  async loadMonthlyData(month) {
    try {
      const briefPath = getMonthlyBriefPath(month);
      const aiInsightsPath = getAIInsightsPath('monthly', month);

      logger.debug(`加载月报数据：${month}`, { briefPath, aiInsightsPath });

      if (!await fileExists(briefPath)) {
        throw new Error(`月报数据文件不存在：${briefPath}`);
      }

      const briefData = await readJson(briefPath);
      
      let aiInsights = null;
      if (await fileExists(aiInsightsPath)) {
        aiInsights = await readJson(aiInsightsPath);
        logger.info(`已加载 AI 洞察数据：${month}`);
      } else {
        logger.warn(`AI 洞察数据不存在：${aiInsightsPath}`);
      }

      return {
        month,
        type: 'monthly',
        brief: briefData,
        aiInsights,
        loadedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`加载月报数据失败：${error.message}`, { month });
      throw error;
    }
  }

  /**
   * 标准化数据格式（支持新旧两种格式）
   * @param {Object} rawData - 原始数据
   * @returns {Object} 标准化后的数据
   */
  normalizeDataFormat(rawData) {
    // 检查是否已经是新格式
    if (rawData.trending_repos) {
      return rawData;
    }

    // 转换旧格式 (projects) 到新格式 (trending_repos)
    const projects = rawData.projects || rawData.trending_repos || [];
    
    // 处理原始 stats（可能来自 AI 分析）
    const originalStats = rawData.stats || {};
    
    return {
      ...rawData,
      trending_repos: projects.map(project => {
        // 提取 analysis 中的核心功能、使用场景和热度趋势数据
        const analysis = project.analysis || null;
        return {
          name: project.fullName || project.name,
          description: project.descZh || project.desc || '',
          url: project.url || `https://github.com/${project.fullName}`,
          stars: project.stars || 0,
          forks: project.forks || 0,
          language: project.language || '',
          topics: project.topics || [],
          isAI: project.isAI || false,
          // 将 analysis 数据映射到 HTML 生成器期望的字段名
          core_features: analysis?.coreFunctions || [],
          use_cases: analysis?.useCases || [],
          trend_data: analysis?.trends || [],
          analysis: analysis,
          todayStars: parseInt(project.todayStars) || 0
        };
      }),
      stats: {
        // 使用下划线命名（HTML 生成器期望的格式）
        total_projects: originalStats.total_projects || originalStats.totalProjects || projects.length,
        ai_projects: originalStats.ai_projects || originalStats.aiProjects || projects.filter(p => p.isAI).length,
        avg_stars: originalStats.avg_stars || originalStats.avgStars || Math.round(projects.reduce((sum, p) => sum + (p.stars || 0), 0) / projects.length),
        hot_projects: originalStats.hot_projects || originalStats.hotProjects || projects.filter(p => (parseInt(p.todayStars) || 0) > 1000).length
      }
    };
  }

  /**
   * 验证数据结构
   * @param {Object} data - 要验证的数据
   * @returns {Object} 验证结果
   */
  validateData(data) {
    const errors = [];
    const warnings = [];

    if (!data.brief) {
      errors.push('缺少基础数据 (brief)');
    } else {
      // 验证基础数据结构
      if (!data.brief.trending_repos) {
        warnings.push('缺少 trending_repos 数据');
      }
      if (!data.brief.stats) {
        warnings.push('缺少 stats 统计数据');
      }
    }

    if (data.aiInsights) {
      // 验证 AI 洞察数据结构
      if (!data.aiInsights.summary) {
        warnings.push('AI 洞察缺少 summary');
      }
      if (!data.aiInsights.project_insights) {
        warnings.push('AI 洞察缺少 project_insights');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = DataLoader;
