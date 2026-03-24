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
        if (date.startsWith(month)) {
          dailyDataList.push({
            date,
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

        // 检查周报是否属于指定月份
        const weekStart = data.weekStart || data.week_start || '';
        if (weekStart.startsWith(month)) {
          weeklyDataList.push({
            weekStart,
            weekEnd: data.weekEnd || data.week_end || '',
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
          weekStart: week.weekStart
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
        date: project.date || project.weekStart,
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
      if (project.date || project.weekStart) {
        entry.dates.push(project.date || project.weekStart);
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
   * 检测项目类型
   */
  detectProjectType(project) {
    const desc = (project.description || '').toLowerCase();
    const name = (project.name || '').toLowerCase();
    const text = `${desc} ${name}`;

    if (text.includes('agent') || text.includes('autonomous')) return 'agent';
    if (text.includes('llm') || text.includes('language model') || text.includes('gpt')) return 'llm';
    if (text.includes('vision') || text.includes('image') || text.includes('computer vision')) return 'vision';
    if (text.includes('speech') || text.includes('audio') || text.includes('voice')) return 'speech';
    if (text.includes('dev') || text.includes('tool') || text.includes('cli')) return 'devtools';

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
