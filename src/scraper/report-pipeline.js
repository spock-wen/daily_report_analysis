/**
 * ReportPipeline - 报告生成流水线
 * 负责执行从原始数据到完整报告的完整流程
 * 
 * 流程步骤：
 * 1. 保存原始数据 JSON
 * 2. 调用 AI 分析生成洞察
 * 3. 生成 HTML 报告
 * 4. 更新首页
 * 5. 发送推送通知
 */

const logger = require('../utils/logger');
const { writeJson } = require('../utils/fs');
const fs = require('fs');
const { 
  getDailyBriefPath, 
  getWeeklyBriefPath, 
  getMonthlyBriefPath 
} = require('../utils/path');

// 导入依赖模块
const InsightAnalyzer = require('../analyzer/insight-analyzer');
const HTMLGenerator = require('../generator/html-generator');
const MessageSender = require('../notifier/message-sender');
const ProjectAnalyzer = require('./project-analyzer');
const { enhanceRepositories } = require('./github-api');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 报告生成流水线类
 */
class ReportPipeline {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {boolean} options.enableAI - 是否启用 AI 分析（默认 true）
   * @param {boolean} options.enableHTML - 是否生成 HTML（默认 true）
   * @param {boolean} options.enableIndex - 是否更新首页（默认 true）
   * @param {boolean} options.enableNotification - 是否发送通知（默认 true）
   */
  constructor(options = {}) {
    this.enableAI = options.enableAI !== undefined ? options.enableAI : true;
    this.enableHTML = options.enableHTML !== undefined ? options.enableHTML : true;
    this.enableIndex = options.enableIndex !== undefined ? options.enableIndex : true;
    this.enableNotification = options.enableNotification !== undefined ? options.enableNotification : true;
    
    // 初始化子模块
    this.analyzer = new InsightAnalyzer();
    this.htmlGenerator = new HTMLGenerator();
    this.notifier = new MessageSender();
    this.projectAnalyzer = new ProjectAnalyzer();
    
    // 流水线执行记录
    this.executionLog = [];
    
    logger.info('[ReportPipeline] 报告生成流水线初始化完成', {
      enableAI: this.enableAI,
      enableHTML: this.enableHTML,
      enableIndex: this.enableIndex,
      enableNotification: this.enableNotification
    });
  }

  /**
   * 执行完整报告生成流程
   * @param {Object} data - 抓取到的原始数据
   * @param {string} type - 报告类型 (daily/weekly/monthly)
   * @returns {Promise<Object>} 执行结果
   */
  async execute(data, type) {
    const startTime = Date.now();
    logger.title(`[ReportPipeline] 开始执行报告生成流程：${type}`);
    
    this.executionLog = [];
    const result = {
      success: false,
      type,
      data: null,
      insights: null,
      htmlPath: null,
      notificationResults: null,
      errors: [],
      duration: 0
    };

    try {
      // 验证输入数据
      if (!data || !type) {
        throw new Error('缺少必要参数：data 和 type');
      }

      // 步骤 1: 增强仓库数据（调用 GitHub API）
      await this.executeStep('enhance-data', async () => {
        const enhancedData = await this.enhanceRepositoryData(data, type);
        Object.assign(data, enhancedData);
      }, result);

      // 步骤 2: 调用 AI 分析生成洞察
      if (this.enableAI) {
        await this.executeStep('ai-analysis', async () => {
          result.insights = await this.generateAIInsights(data, type);
        }, result);
      } else {
        logger.info('[ReportPipeline] AI 分析已禁用，跳过');
      }

      // 步骤 3: 保存数据 JSON（包含 AI 洞察）
      await this.executeStep('save-data', async () => {
        // 如果有 AI 洞察，合并到数据中保存
        if (result.insights) {
          data.aiInsights = result.insights;
        }
        await this.saveRawData(data, type);
      }, result);

      // 步骤 4: 生成 HTML 报告
      if (this.enableHTML) {
        await this.executeStep('generate-html', async () => {
          const reportData = this.prepareReportData(data, result.insights, type);
          result.htmlPath = await this.generateHTML(reportData, type);
        }, result);
      } else {
        logger.info('[ReportPipeline] HTML 生成已禁用，跳过');
      }

      // 步骤 5: 更新首页
      if (this.enableIndex) {
        await this.executeStep('update-index', async () => {
          await this.updateIndexPage();
        }, result);
      } else {
        logger.info('[ReportPipeline] 首页更新已禁用，跳过');
      }

      // 步骤 6: 发送推送通知
      if (this.enableNotification) {
        await this.executeStep('send-notification', async () => {
          result.notificationResults = await this.sendNotification(data, result.insights, type);
        }, result);
      } else {
        logger.info('[ReportPipeline] 推送通知已禁用，跳过');
      }

      // 执行成功
      result.success = true;
      result.data = data;
      result.duration = Date.now() - startTime;
      
      logger.success(`[ReportPipeline] 报告生成流程完成：${type}`, {
        duration: `${result.duration}ms`,
        htmlPath: result.htmlPath,
        insightsGenerated: !!result.insights,
        notificationSent: !!result.notificationResults
      });

      return result;
    } catch (error) {
      // 执行失败
      result.success = false;
      result.errors.push({
        step: 'pipeline',
        error: error.message,
        stack: error.stack
      });
      result.duration = Date.now() - startTime;
      
      logger.error(`[ReportPipeline] 报告生成流程失败：${type}`, {
        error: error.message,
        duration: `${result.duration}ms`,
        errors: result.errors
      });

      // 抛出异常，让上层处理
      throw error;
    }
  }

  /**
   * 执行单个步骤（带错误处理和日志）
   * @param {string} stepName - 步骤名称
   * @param {Function} stepFn - 步骤执行函数
   * @param {Object} result - 结果对象
   */
  async executeStep(stepName, stepFn, result) {
    const stepStart = Date.now();
    logger.info(`[ReportPipeline] 执行步骤：${stepName}`);
    
    try {
      await stepFn();
      const stepDuration = Date.now() - stepStart;
      
      this.executionLog.push({
        step: stepName,
        status: 'success',
        duration: stepDuration
      });
      
      logger.success(`[ReportPipeline] 步骤完成：${stepName}`, {
        duration: `${stepDuration}ms`
      });
    } catch (error) {
      const stepDuration = Date.now() - stepStart;
      
      this.executionLog.push({
        step: stepName,
        status: 'failed',
        error: error.message,
        duration: stepDuration
      });
      
      result.errors.push({
        step: stepName,
        error: error.message,
        stack: error.stack
      });
      
      logger.error(`[ReportPipeline] 步骤失败：${stepName}`, {
        error: error.message,
        duration: `${stepDuration}ms`
      });
      
      // 抛出异常，中断流程
      throw error;
    }
  }

  /**
   * 增强仓库数据（调用 GitHub API 获取详细信息）
   * @param {Object} data - 原始数据
   * @param {string} type - 报告类型
   * @returns {Promise<Object>} 增强后的数据
   */
  async enhanceRepositoryData(data, type) {
    logger.info('[ReportPipeline] 开始增强仓库数据...');
    
    const token = process.env.GITHUB_TOKEN || null;
    const repositories = data.repositories || [];
    
    if (repositories.length === 0) {
      logger.warn('[ReportPipeline] 没有仓库需要增强');
      return data;
    }
    
    // 步骤 1: 调用 GitHub API 获取详细信息
    const enhancedRepos = await enhanceRepositories(repositories, token);
    
    // 步骤 2: 分析项目（翻译描述 + 生成详细分析）
    logger.info('[ReportPipeline] 开始分析项目...');
    const analyzedRepos = await this.projectAnalyzer.analyzeProjects(enhancedRepos);
    
    logger.info(`[ReportPipeline] 仓库数据增强完成，共 ${analyzedRepos.length} 个仓库`);
    
    return {
      ...data,
      repositories: analyzedRepos,
      projects: analyzedRepos // 同时设置 projects 字段以兼容旧版
    };
  }

  /**
   * 步骤 1: 保存原始数据 JSON
   * @param {Object} data - 原始数据
   * @param {string} type - 报告类型
   */
  async saveRawData(data, type) {
    logger.info('[ReportPipeline] 保存原始数据...');
    
    let filePath;
    let identifier;
    
    // 根据类型计算标识符
    if (type === 'daily') {
      identifier = data.date || new Date().toISOString().split('T')[0];
      filePath = getDailyBriefPath(identifier);
    } else if (type === 'weekly') {
      // 周报使用 ISO 周数格式：2026-W11
      identifier = this.getWeeklyIdentifier(data);
      filePath = getWeeklyBriefPath(identifier);
    } else if (type === 'monthly') {
      identifier = data.month || new Date().toISOString().slice(0, 7);
      filePath = getMonthlyBriefPath(identifier);
    } else {
      throw new Error(`未知的报告类型：${type}`);
    }
    
    // 添加元数据和旧版兼容字段
    const dataWithMeta = this.formatDataForLegacy(data, type, identifier);
    
    await writeJson(filePath, dataWithMeta);
    logger.info(`[ReportPipeline] 原始数据已保存：${filePath}`);
    
    return filePath;
  }

  /**
   * 格式化数据为旧版兼容格式
   * @param {Object} data - 原始数据
   * @param {string} type - 报告类型
   * @param {string} identifier - 标识符
   * @returns {Object} 格式化后的数据
   */
  formatDataForLegacy(data, type, identifier) {
    const now = new Date();
    
    // 基础格式
    const formatted = {
      generatedAt: data.scrapedAt || now.toISOString(),
      date: identifier,
      triggerType: type,
      period: type === 'daily' ? '每日' : type === 'weekly' ? '每周' : '每月',
      projects: data.projects || data.repositories || [],
      stats: {
        totalProjects: data.count || (data.repositories?.length || 0),
        aiProjects: (data.repositories || data.projects || []).filter(r => r.isAI).length,
        avgStars: this.calculateAvgStars(data.repositories || data.projects || [])
      }
    };
    
    // 周报特定字段
    if (type === 'weekly') {
      formatted.weekStart = identifier;
      const weekEnd = this.calculateWeekEnd(identifier);
      formatted.weekEnd = weekEnd;
    }
    
    // 生成 summary
    formatted.summary = this.generateSummary(formatted);
    
    // 保留 AI 洞察（如果有）
    if (data.aiInsights) {
      formatted.aiInsights = data.aiInsights;
    }
    
    return formatted;
  }

  /**
   * 计算平均星星数
   */
  calculateAvgStars(repos) {
    if (!repos || repos.length === 0) return '0';
    const total = repos.reduce((sum, r) => sum + (r.stars || 0), 0);
    const avg = Math.round(total / repos.length);
    return avg >= 1000 ? `${(avg / 1000).toFixed(0)}k` : `${avg}`;
  }

  /**
   * 计算周结束日期
   */
  calculateWeekEnd(weekStart) {
    if (!weekStart) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = 6 - dayOfWeek;
      const end = new Date(now);
      end.setDate(end.getDate() + (diff < 0 ? 7 + diff : diff));
      return end.toISOString().split('T')[0];
    }
    
    const start = new Date(weekStart);
    if (isNaN(start.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    start.setDate(start.getDate() + 6);
    return start.toISOString().split('T')[0];
  }

  /**
   * 生成周报摘要
   */
  generateSummary(data) {
    const projects = data.projects || [];
    const topType = this.getTopType(projects);
    const topLang = this.getTopLang(projects);
    const topProject = projects.length > 0 ? projects[0].repo || projects[0].fullName : '';
    const maxTodayStars = Math.max(...projects.map(p => parseInt(p.todayStars) || 0), 0);
    
    return {
      date: data.date || data.weekStart,
      period: data.period,
      triggerType: data.triggerType,
      total: projects.length,
      aiCount: projects.filter(r => r.isAI).length,
      avgStars: data.stats?.avgStars || '0',
      topType: {
        name: topType.name,
        count: topType.count
      },
      topLang: {
        name: topLang.name,
        count: topLang.count
      },
      topProject,
      maxTodayStars,
      hotProjectCount: projects.filter(p => (parseInt(p.todayStars) || 0) > 100).length,
      projects: projects.slice(0, 10).map(p => ({
        name: p.repo || p.fullName,
        type: p.analysis?.type || 'general',
        lang: p.language || 'Unknown',
        stars: p.stars || 0,
        todayStars: String(p.todayStars || 0),
        desc: (p.desc || p.descZh || '').substring(0, 100)
      }))
    };
  }

  /**
   * 获取最多的项目类型
   */
  getTopType(projects) {
    const typeCount = {};
    projects.forEach(p => {
      const type = p.analysis?.type || 'general';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    let topType = 'general';
    let maxCount = 0;
    Object.entries(typeCount).forEach(([type, count]) => {
      if (count > maxCount) {
        topType = type;
        maxCount = count;
      }
    });
    
    return { name: topType, count: maxCount };
  }

  /**
   * 获取最多的编程语言
   */
  getTopLang(projects) {
    const langCount = {};
    projects.forEach(p => {
      const lang = p.language || 'Unknown';
      langCount[lang] = (langCount[lang] || 0) + 1;
    });
    
    let topLang = 'Unknown';
    let maxCount = 0;
    Object.entries(langCount).forEach(([lang, count]) => {
      if (count > maxCount) {
        topLang = lang;
        maxCount = count;
      }
    });
    
    return { name: topLang, count: maxCount };
  }

  /**
   * 获取周报标识符（ISO 周数格式）
   * @param {Object} data - 数据对象
   * @returns {string} 周标识符（如：2026-W11）
   */
  getWeeklyIdentifier(data) {
    // 优先使用已有的 weekStart
    if (data.weekStart && data.weekStart.match(/^\d{4}-W\d{2}$/)) {
      return data.weekStart;
    }
    
    // 使用 scrapedAt 计算周标识符
    const scrapeDate = data.scrapedAt ? new Date(data.scrapedAt) : new Date();
    
    // 如果是周一，应该生成上周的周报（汇总上周一到周日的数据）
    const dayOfWeek = scrapeDate.getDay(); // 0=周日, 1=周一, ..., 6=周六
    let targetDate = new Date(scrapeDate);
    
    if (dayOfWeek === 1) {
      // 周一：生成上周的周报（减去7天）
      targetDate.setDate(targetDate.getDate() - 7);
    }
    // 其他时间：生成本周的周报
    
    const year = targetDate.getFullYear();
    const weekNumber = this.getISOWeek(targetDate);
    const weekStr = String(weekNumber).padStart(2, '0');
    
    return `${year}-W${weekStr}`;
  }

  /**
   * 计算 ISO 周数
   */
  getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * 步骤 2: 生成 AI 洞察
   * @param {Object} data - 原始数据
   * @param {string} type - 报告类型
   * @returns {Promise<Object>} AI 洞察结果
   */
  async generateAIInsights(data, type) {
    logger.info('[ReportPipeline] 开始 AI 分析...');
    
    try {
      let insights;
      
      // 构建兼容的数据结构，包含 brief 字段
      const analysisData = {
        ...data,
        brief: {
          projects: data.projects || data.repositories || [],
          stats: data.stats || {},
          generatedAt: data.generatedAt || new Date().toISOString()
        }
      };
      
      if (type === 'daily') {
        insights = await this.analyzer.analyzeDaily(analysisData);
      } else if (type === 'weekly') {
        // 周报分析：同时进行周度分析和深度趋势分析
        const weeklyInsights = await this.analyzer.analyzeWeekly(analysisData);
        
        // 加载上周的日报数据进行深度趋势分析
        const weekStart = data.weekStart || this.getWeeklyIdentifier(data);
        const dailyData = await this.loadWeeklyDailyData(weekStart);
        
        if (dailyData && dailyData.length > 0) {
          logger.info(`[ReportPipeline] 加载了 ${dailyData.length} 天的日报数据，进行深度趋势分析...`);
          
          // 构建周范围
          const weekRange = {
            start: dailyData[0].date,
            end: dailyData[dailyData.length - 1].date
          };
          
          const deepTrends = await this.analyzer.analyzeDeepTrends(dailyData, weekRange);
          
          if (deepTrends) {
            insights = {
              ...weeklyInsights,
              deepTrends
            };
          } else {
            insights = weeklyInsights;
          }
        } else {
          insights = weeklyInsights;
        }
      } else if (type === 'monthly') {
        insights = await this.analyzer.analyzeMonthly(analysisData);
      } else {
        throw new Error(`不支持的报告类型：${type}`);
      }
      
      logger.info('[ReportPipeline] AI 分析完成');
      return insights;
    } catch (error) {
      logger.error('[ReportPipeline] AI 分析失败', { error: error.message });
      
      // AI 分析失败时返回降级数据，不阻断流程
      return {
        oneLiner: 'AI 分析服务暂时不可用，请稍后重试。',
        hypeIndex: { score: 0, reason: error.message },
        hot: [],
        shortTerm: [],
        longTerm: [],
        action: [],
        topProjects: [],
        error: error.message
      };
    }
  }

  /**
   * 加载指定周的日报数据
   * @param {string} weekIdentifier - 周标识符（如：2026-W12）
   * @returns {Promise<Array>} 日报数据列表
   */
  async loadWeeklyDailyData(weekIdentifier) {
    try {
      logger.info(`[ReportPipeline] 加载周 ${weekIdentifier} 的日报数据...`);
      
      // 解析周标识符
      const match = weekIdentifier.match(/^(\d{4})-W(\d{2})$/);
      if (!match) {
        logger.warn(`[ReportPipeline] 无效的周标识符：${weekIdentifier}`);
        return [];
      }
      
      const year = parseInt(match[1]);
      const week = parseInt(match[2]);
      
      // 计算该周的起始日期（周一）
      const jan1 = new Date(year, 0, 1);
      const dayOfWeek = jan1.getDay() || 7; // 1=周一, ..., 7=周日
      const daysToFirstMonday = dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek;
      const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
      
      // 加载该周的7天数据
      const dailyData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        try {
          const filePath = getDailyBriefPath(dateStr);
          logger.debug(`[ReportPipeline] 检查日报文件：${filePath}`);
          if (fs.existsSync(filePath)) {
            logger.debug(`[ReportPipeline] 找到日报文件：${filePath}`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            dailyData.push({
              date: dateStr,
              dayIndex: i,
              projects: data.projects || data.trending_repos || []
            });
          } else {
            logger.debug(`[ReportPipeline] 日报文件不存在：${filePath}`);
          }
        } catch (err) {
          logger.warn(`[ReportPipeline] 加载 ${dateStr} 日报数据失败：${err.message}`);
        }
      }
      
      logger.info(`[ReportPipeline] 成功加载 ${dailyData.length} 天的日报数据`);
      return dailyData;
    } catch (error) {
      logger.error(`[ReportPipeline] 加载日报数据失败：${error.message}`);
      return [];
    }
  }

  /**
   * 准备报告数据（合并原始数据和 AI 洞察）
   * @param {Object} data - 原始数据
   * @param {Object} insights - AI 洞察
   * @param {string} type - 报告类型
   * @returns {Object} 合并后的报告数据
   */
  prepareReportData(data, insights, type) {
    logger.info('[ReportPipeline] 准备报告数据...');
    
    // 标准化数据结构 - 同时设置根级别和 brief 字段以兼容 HTML 生成器
    const projects = data.projects || data.repositories || [];
    
    // 根据类型确定日期字段
    let date;
    if (type === 'daily') {
      date = data.date || new Date().toISOString().split('T')[0];
    } else if (type === 'weekly') {
      date = data.weekStart || this.getWeeklyIdentifier(data);
    } else if (type === 'monthly') {
      date = data.month || new Date().toISOString().slice(0, 7);
    }
    
    // 计算统计数据
    const stats = data.stats || {
      totalProjects: projects.length,
      aiProjects: projects.filter(r => r.isAI).length,
      avgStars: this.calculateAvgStars(projects),
      hotProjects: projects.filter(r => {
        const todayStars = parseInt(r.todayStars || r.today_stars || 0);
        return todayStars > 100;
      }).length
    };
    
    const reportData = {
      ...data,
      date: date, // 确保设置 date 字段
      projects: projects, // 根级别，HTML 生成器需要
      trending_repos: projects, // 兼容性字段
      stats: stats, // 根级别 stats，HTML 生成器需要
      brief: {
        trending_repos: projects,
        stats: stats,
        period: type === 'daily' ? '每日' : type === 'weekly' ? '每周' : '每月',
        generated_at: data.generatedAt || new Date().toISOString()
      }
    };
    
    // 添加 AI 洞察
    if (insights) {
      reportData.aiInsights = insights;
    }
    
    // 根据类型添加特定字段
    if (type === 'weekly') {
      reportData.week = data.weekStart || this.getWeeklyIdentifier(data);
      reportData.weekStart = data.weekStart || reportData.week;
      reportData.weekEnd = data.weekEnd || this.calculateWeekEnd(reportData.weekStart);
    }
    
    logger.info('[ReportPipeline] 报告数据准备完成');
    return reportData;
  }

  /**
   * 步骤 3: 生成 HTML 报告
   * @param {Object} reportData - 报告数据
   * @param {string} type - 报告类型
   * @returns {Promise<string>} HTML 文件路径
   */
  async generateHTML(reportData, type) {
    logger.info('[ReportPipeline] 开始生成 HTML 报告...');
    
    let htmlPath;
    
    if (type === 'daily') {
      htmlPath = await this.htmlGenerator.generateDaily(reportData);
    } else if (type === 'weekly') {
      htmlPath = await this.htmlGenerator.generateWeekly(reportData);
    } else if (type === 'monthly') {
      htmlPath = await this.htmlGenerator.generateMonthly(reportData);
    } else {
      throw new Error(`不支持的报告类型：${type}`);
    }
    
    logger.info(`[ReportPipeline] HTML 报告已生成：${htmlPath}`);
    return htmlPath;
  }

  /**
   * 步骤 4: 更新首页
   */
  async updateIndexPage() {
    logger.info('[ReportPipeline] 开始更新首页...');
    
    try {
      // 执行首页生成脚本
      const scriptPath = require.resolve('../../scripts/generate-index');
      await execAsync(`node "${scriptPath}"`, {
        cwd: process.cwd(),
        encoding: 'utf8'
      });
      
      logger.info('[ReportPipeline] 首页更新完成');
    } catch (error) {
      logger.error('[ReportPipeline] 首页更新失败', { error: error.message });
      // 首页更新失败不影响主流程，记录日志即可
    }
  }

  /**
   * 步骤 5: 发送推送通知
   * @param {Object} data - 原始数据
   * @param {Object} insights - AI 洞察
   * @param {string} type - 报告类型
   * @returns {Promise<Object>} 通知发送结果
   */
  async sendNotification(data, insights, type) {
    logger.info('[ReportPipeline] 开始发送推送通知...');
    
    try {
      // 周报使用专用方法
      if (type === 'weekly') {
        const results = await this.notifier.sendWeeklyAll(data, insights, {
          platforms: ['feishu', 'welink']
        });
        
        logger.info('[ReportPipeline] 周报推送完成', { results });
        return results;
      }
      
      // 日报/月报使用通用方法
      const notificationContent = this.notifier.generateNotificationContent(type, data, insights);
      
      const results = await this.notifier.sendAll({
        type,
        title: notificationContent.title,
        content: notificationContent.content,
        reportUrl: notificationContent.reportUrl,
        top5: notificationContent.top5,
        insight: notificationContent.insight
      });
      
      logger.info('[ReportPipeline] 推送通知发送完成', { results });
      return results;
    } catch (error) {
      logger.error('[ReportPipeline] 推送通知发送失败', { error: error.message });
      // 通知发送失败不影响主流程
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取周号（辅助函数）
   * @param {string} dateStr - 日期字符串
   * @returns {string} 周号
   */
  getWeekNumber(dateStr) {
    const date = new Date(dateStr);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return weekNumber.toString().padStart(2, '0');
  }

  /**
   * 获取执行日志
   * @returns {Array} 执行日志数组
   */
  getExecutionLog() {
    return this.executionLog;
  }

  /**
   * 清理资源（回滚或清理临时文件）
   * @param {Object} result - 执行结果
   */
  async cleanup(result) {
    logger.info('[ReportPipeline] 执行清理操作...');
    
    // 如果 HTML 生成失败但已创建部分文件，清理临时文件
    if (!result.success && result.htmlPath) {
      try {
        const fs = require('fs').promises;
        await fs.unlink(result.htmlPath);
        logger.info(`[ReportPipeline] 已清理临时 HTML 文件：${result.htmlPath}`);
      } catch (error) {
        logger.warn('[ReportPipeline] 清理临时文件失败', { error: error.message });
      }
    }
    
    logger.info('[ReportPipeline] 清理操作完成');
  }
}

module.exports = ReportPipeline;
