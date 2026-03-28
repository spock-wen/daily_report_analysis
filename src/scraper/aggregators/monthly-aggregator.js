const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * 月度数据聚合器
 * 负责加载并聚合整月的日报、周报数据
 */
class MonthlyAggregator {
  constructor() {
    // 使用项目根目录的 data 文件夹
    this.dataDir = path.join(__dirname, '../../../data');
  }

  /**
   * 聚合指定月份的所有数据
   * @param {string} month - 月份标识，格式："YYYY-MM"
   * @returns {Promise<Object>} 聚合后的月度数据
   */
  async aggregate(month) {
    logger.info('开始聚合月度数据...', { month });

    // 加载日报数据
    const dailyDataList = await this.loadDailyData(month);
    logger.info(` loaded ${dailyDataList.length} days of daily data`);

    // 加载周报数据
    const weeklyDataList = await this.loadWeeklyData(month);
    logger.info(` loaded ${weeklyDataList.length} weeks of weekly data`);

    // 收集所有项目
    const allProjects = this.collectAllProjects(dailyDataList, weeklyDataList);

    // 计算聚合统计
    const aggregation = await this.computeAggregation(allProjects, dailyDataList);

    const result = {
      month,
      generatedAt: new Date().toISOString(),
      dailyDataList,
      weeklyDataList,
      aggregation
    };

    logger.success('月度数据聚合完成', {
      month,
      totalDays: dailyDataList.length,
      totalWeeks: weeklyDataList.length,
      totalProjects: aggregation.totalProjects
    });

    return result;
  }

  /**
   * 加载指定月份的所有日报数据
   * @param {string} month - 月份标识："YYYY-MM"
   * @returns {Promise<Array>} 日报数据列表
   */
  async loadDailyData(month) {
    const dailyDir = path.join(this.dataDir, 'briefs', 'daily');
    const dailyDataList = [];

    if (!fs.existsSync(dailyDir)) {
      logger.warn('日报目录不存在', { dailyDir });
      return dailyDataList;
    }

    // 读取目录下所有 JSON 文件
    const files = fs.readdirSync(dailyDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    for (const file of files) {
      try {
        const filePath = path.join(dailyDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // 检查日期是否属于指定月份
        const date = data.date || file.replace('.json', '');
        // 从文件名或数据中提取日期（格式：YYYY-MM-DD），可能需要去掉前缀 "data-"
        const cleanDate = date.replace(/^data-/, '');
        if (cleanDate.startsWith(month)) {
          dailyDataList.push({
            date: cleanDate,
            projects: data.projects || data.trending_repos || [],
            stats: data.stats || {}
          });
        }
      } catch (error) {
        logger.warn(`读取日报文件失败：${file}`, { error: error.message });
      }
    }

    return dailyDataList;
  }

  /**
   * 加载指定月份的所有周报数据
   * @param {string} month - 月份标识："YYYY-MM"
   * @returns {Promise<Array>} 周报数据列表
   */
  async loadWeeklyData(month) {
    const weeklyDir = path.join(this.dataDir, 'briefs', 'weekly');
    const weeklyDataList = [];

    if (!fs.existsSync(weeklyDir)) {
      logger.warn('周报目录不存在', { weeklyDir });
      return weeklyDataList;
    }

    // 读取目录下所有 JSON 文件
    const files = fs.readdirSync(weeklyDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    // 解析月份，确定该月包含哪些周
    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);

    for (const file of files) {
      try {
        const filePath = path.join(weeklyDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // 检查周报是否属于指定月份（周报使用 date 字段）
        const date = data.date || '';
        // 从数据中提取日期，可能需要去掉前缀 "data-"
        const cleanDate = date.replace(/^data-/, '');

        let belongsToMonth = false;

        // 支持两种格式：
        // 1. "2026-03-15" 格式：直接用 startsWith 匹配月份
        if (cleanDate.startsWith(month)) {
          belongsToMonth = true;
        }
        // 2. "2026-W12" 格式：从文件名解析周数，计算该周是否在本月内
        else if (cleanDate.match(/^(\d{4})-W(\d{2})$/)) {
          const match = cleanDate.match(/^(\d{4})-W(\d{2})$/);
          const [_, weekYear, weekNum] = match;
          const weekStart = this.getWeekStartDate(weekYear, weekNum);
          // 检查周开始日期是否在本月内
          belongsToMonth = weekStart >= monthStart && weekStart <= monthEnd;
        }

        if (belongsToMonth) {
          weeklyDataList.push({
            date: cleanDate,
            projects: data.projects || data.trending_repos || [],
            stats: data.stats || {}
          });
        }
      } catch (error) {
        logger.warn(`读取周报文件失败：${file}`, { error: error.message });
      }
    }

    return weeklyDataList;
  }

  /**
   * 根据年份和周数计算周开始日期（周一）
   * @param {string} year - 年份
   * @param {string} weekNum - 周数
   * @returns {Date} 周开始日期
   */
  getWeekStartDate(year, weekNum) {
    const week = parseInt(weekNum);
    const jan1 = new Date(parseInt(year), 0, 1);
    // 计算第一周的周一（ISO 周定义）
    const dayOfWeek = jan1.getDay() || 7;
    const daysToFirstMonday = dayOfWeek <= 4 ? 1 - dayOfWeek : 7 - dayOfWeek + 1;
    const firstMonday = new Date(jan1);
    firstMonday.setDate(jan1.getDate() + daysToFirstMonday);
    // 计算目标周的周一
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
    return weekStart;
  }

  /**
   * 收集所有项目（去重前）
   */
  collectAllProjects(dailyDataList, weeklyDataList) {
    const projects = [];

    // 添加日报项目
    dailyDataList.forEach(day => {
      day.projects.forEach(project => {
        projects.push({
          ...project,
          source: 'daily',
          date: day.date
        });
      });
    });

    // 添加周报项目
    weeklyDataList.forEach(week => {
      week.projects.forEach(project => {
        projects.push({
          ...project,
          source: 'weekly',
          date: week.date
        });
      });
    });

    return projects;
  }

  /**
   * 计算聚合统计数据
   */
  async computeAggregation(allProjects, dailyDataList) {
    // 去重项目
    const uniqueProjects = this.deduplicateProjects(allProjects);

    // 查找重复上榜项目
    const recurringProjects = this.findRecurringProjects(allProjects);

    // 查找月度新星
    const newProjects = this.findNewProjects(uniqueProjects);

    // 计算领域分布
    const typeDistribution = this.computeTypeDistribution(uniqueProjects);

    // 计算语言分布
    const languageDistribution = this.computeLanguageDistribution(uniqueProjects);

    // 计算趋势演变
    const trendEvolution = this.computeTrendEvolution(dailyDataList);

    // 星数增长 TOP10
    const topGainers = this.findTopGainers(uniqueProjects, 10);

    // 持续霸榜 TOP10
    const topConsistent = recurringProjects.slice(0, 10);

    return {
      totalProjects: uniqueProjects.length,
      recurringProjects,
      newProjects,
      typeDistribution,
      languageDistribution,
      trendEvolution,
      topGainers,
      topConsistent
    };
  }

  /**
   * 项目去重（按 fullName/name）
   */
  deduplicateProjects(projects) {
    const seen = new Map();

    projects.forEach(project => {
      const key = project.fullName || project.name;
      if (!key) return;

      if (!seen.has(key)) {
        seen.set(key, {
          ...project,
          appearances: [],
          totalStars: project.stars || 0
        });
      } else {
        const existing = seen.get(key);
        // 更新为最大星数
        if ((project.stars || 0) > existing.totalStars) {
          existing.totalStars = project.stars || 0;
        }
        // 合并其他字段
        if (project.description && !existing.description) {
          existing.description = project.description;
        }
        if (project.language && !existing.language) {
          existing.language = project.language;
        }
      }

      // 记录出现
      const entry = seen.get(key);
      entry.appearances.push({
        date: project.date,
        source: project.source
      });
    });

    return Array.from(seen.values()).map(p => ({
      ...p,
      appearanceCount: p.appearances.length
    }));
  }

  /**
   * 查找重复上榜项目（出现 >= 2 次）
   */
  findRecurringProjects(allProjects) {
    const projectCount = new Map();

    allProjects.forEach(project => {
      const key = project.fullName || project.name;
      if (!key) return;

      if (!projectCount.has(key)) {
        projectCount.set(key, {
          repo: key,
          count: 0,
          dates: [],
          ...project
        });
      }

      const entry = projectCount.get(key);
      entry.count++;
      if (project.date) {
        entry.dates.push(project.date);
      }
    });

    return Array.from(projectCount.values())
      .filter(p => p.count >= 2)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 查找月度新星（首次出现且增长快的项目）
   */
  findNewProjects(uniqueProjects) {
    return uniqueProjects
      .filter(p => p.appearanceCount === 1)
      .sort((a, b) => (b.stars || b.totalStars || 0) - (a.stars || a.totalStars || 0))
      .slice(0, 10)
      .map(p => ({
        repo: p.fullName || p.name,
        firstSeen: p.appearances?.[0]?.date || 'unknown',
        starsGained: p.stars || p.totalStars || 0,
        description: p.description,
        language: p.language
      }));
  }

  /**
   * 计算领域分布
   */
  computeTypeDistribution(projects) {
    const distribution = {
      agent: 0,
      llm: 0,
      vision: 0,
      speech: 0,
      devtools: 0,
      other: 0
    };

    projects.forEach(project => {
      const type = project.type || this.detectProjectType(project);
      if (distribution[type] !== undefined) {
        distribution[type]++;
      } else {
        distribution.other++;
      }
    });

    return distribution;
  }

  /**
   * 检测项目类型（优化版：更准确的分类）
   */
  detectProjectType(project) {
    const desc = (project.description || '').toLowerCase();
    const name = (project.fullName || project.name || '').toLowerCase();
    const text = `${desc} ${name}`;

    // Agent 相关（优先级最高）
    if (text.includes('agent') || text.includes('autonomous') || text.includes('auto') ||
        text.includes('workflow') || text.includes('orchestrat') || text.includes('multi-agent') ||
        text.includes('copilot') || text.includes('assistant') || text.includes('bot')) {
      return 'agent';
    }

    // LLM/模型相关
    if (text.includes('llm') || text.includes('language model') || text.includes('gpt') ||
        text.includes('transformer') || text.includes('fine-tune') || text.includes('prompt') ||
        text.includes('claude') || text.includes('qwen') || text.includes('llama') ||
        text.includes('model') || text.includes('inference')) {
      return 'llm';
    }

    // 视觉相关
    if (text.includes('vision') || text.includes('image') || text.includes('computer vision') ||
        text.includes('ocr') || text.includes('detection') || text.includes('segmentation') ||
        text.includes('visual') || text.includes('video') || text.includes('render')) {
      return 'vision';
    }

    // 语音/音频相关
    if (text.includes('speech') || text.includes('audio') || text.includes('voice') ||
        text.includes('tts') || text.includes('asr') || text.includes('stt') ||
        text.includes('sound') || text.includes('music') || text.includes('synthes')) {
      return 'speech';
    }

    // 开发工具相关
    if (text.includes('dev') || text.includes('tool') || text.includes('cli') ||
        text.includes('build') || text.includes('debug') || text.includes('test') ||
        text.includes('ci/cd') || text.includes('linter') || text.includes('formatter') ||
        text.includes('webpack') || text.includes('vite') || text.includes('eslint')) {
      return 'devtools';
    }

    // 框架/库
    if (text.includes('framework') || text.includes('library') || text.includes('sdk') ||
        text.includes('api') || text.includes('wrapper') || text.includes('kit')) {
      return 'llm';
    }

    // 数据分析/科学
    if (text.includes('data') || text.includes('analytics') || text.includes('science') ||
        text.includes('ml') || text.includes('machine learning') || text.includes('statistics')) {
      return 'llm';
    }

    return 'other';
  }

  /**
   * 计算语言分布
   */
  computeLanguageDistribution(projects) {
    const distribution = {};

    projects.forEach(project => {
      const lang = project.language || 'Unknown';
      distribution[lang] = (distribution[lang] || 0) + 1;
    });

    // 排序并取 TOP 5
    const sorted = Object.entries(distribution)
      .sort((a, b) => b[1] - a[1]);

    const top5 = {};
    const other = {};

    sorted.slice(0, 5).forEach(([lang, count]) => {
      top5[lang] = count;
    });

    if (sorted.length > 5) {
      other.Other = sorted.slice(5).reduce((sum, [, count]) => sum + count, 0);
    }

    return { ...top5, ...other };
  }

  /**
   * 计算趋势演变（上/中/下旬三段式）
   */
  computeTrendEvolution(dailyDataList) {
    if (dailyDataList.length === 0) {
      return [];
    }

    // 按日期排序
    const sorted = [...dailyDataList].sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    const total = sorted.length;
    const third = Math.ceil(total / 3);

    const periods = [
      { name: '上旬', start: 0, end: third },
      { name: '中旬', start: third, end: third * 2 },
      { name: '下旬', start: third * 2, end: total }
    ];

    return periods.map(period => {
      const periodData = sorted.slice(period.start, period.end);
      const projects = periodData.flatMap(d => d.projects || []);
      const uniqueProjects = [...new Map(
        projects.map(p => [p.fullName || p.name, p])
      ).values()];

      // 提取主要项目类型
      const types = {};
      uniqueProjects.forEach(p => {
        const type = p.type || this.detectProjectType(p);
        types[type] = (types[type] || 0) + 1;
      });

      const topType = Object.entries(types)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';

      return {
        period: period.name,
        dates: `${sorted[period.start]?.date || ''} ~ ${sorted[period.end - 1]?.date || ''}`,
        projectCount: uniqueProjects.length,
        topType,
        keyProjects: uniqueProjects.slice(0, 5).map(p => p.fullName || p.name)
      };
    });
  }

  /**
   * 查找星数增长最快的 TOP N 项目
   */
  findTopGainers(projects, limit = 10) {
    return [...projects]
      .sort((a, b) => (b.totalStars || b.stars || 0) - (a.totalStars || a.stars || 0))
      .slice(0, limit)
      .map(p => ({
        repo: p.fullName || p.name,
        stars: p.totalStars || p.stars || 0,
        description: p.description,
        language: p.language,
        appearanceCount: p.appearanceCount
      }));
  }
}

module.exports = MonthlyAggregator;
