#!/usr/bin/env node

/**
 * 重新生成 HTML 和发送推送脚本
 *
 * 支持日报、周报、月报、论文报告从既有数据重新生成 HTML
 * 可选重新发送推送通知
 *
 * 用法:
 *   node scripts/regenerate.js daily 2026-04-15 [--push]
 *   node scripts/regenerate.js weekly 2026-W16 [--push]
 *   node scripts/regenerate.js monthly 2026-03 [--push]
 *   node scripts/regenerate.js papers 2026-04-01 [--push]
 *   node scripts/regenerate.js daily 2026-04-15 --skip-ai  # 跳过 AI 分析（无 JSON 时）
 */

const path = require('path');
const fs = require('fs');

// 命令行参数
const args = process.argv.slice(2);
const reportType = args[0];
const reportId = args[1];
const shouldPush = args.includes('--push') || args.includes('-p');
const shouldHelp = args.includes('--help') || args.includes('-h');

if (shouldHelp || !reportType || !reportId) {
  console.log(`
重新生成 HTML 和发送推送脚本

用法:
  node scripts/regenerate.js <type> <id> [options]

参数:
  type      报告类型：daily, weekly, monthly, papers
  id        报告标识：
            - daily:   日期格式 YYYY-MM-DD (如 2026-04-15)
            - weekly:  周数格式 YYYY-Www (如 2026-W16)
            - monthly: 月份格式 YYYY-MM (如 2026-03)
            - papers:  日期格式 YYYY-MM-DD (如 2026-04-01)

选项:
  --push, -p     生成 HTML 后重新发送推送通知
  --skip-ai      跳过 AI 分析（适用于无 JSON 数据时）

示例:
  node scripts/regenerate.js daily 2026-04-15
  node scripts/regenerate.js weekly 2026-W16 --push
  node scripts/regenerate.js monthly 2026-03
  node scripts/regenerate.js papers 2026-04-01 --push
  node scripts/regenerate.js daily 2026-04-15 --skip-ai
`);
  process.exit(0);
}

// 导入依赖
const HTMLGenerator = require('../src/generator/html-generator');
const PapersHtmlGenerator = require('../src/generator/paper-html-generator');
const { getDailyReportPath, getWeeklyReportPath, getMonthlyReportPath } = require('../src/utils/path');
const logger = require('../src/utils/logger');

/**
 * 从 HTML 文件路径推断 JSON 路径
 */
function getJsonPath(reportType, reportId) {
  switch (reportType) {
    case 'daily':
      return path.join(__dirname, `../reports/daily/github-daily-${reportId}.json`);
    case 'weekly':
      return path.join(__dirname, `../reports/weekly/github-weekly-${reportId}.json`);
    case 'monthly':
      return path.join(__dirname, `../reports/monthly/github-monthly-${reportId}.json`);
    case 'papers':
      return path.join(__dirname, `../reports/papers/daily/papers-${reportId}.json`);
    default:
      return null;
  }
}

/**
 * 从 HTML 文件路径
 */
function getHtmlPath(reportType, reportId) {
  switch (reportType) {
    case 'daily':
      return getDailyReportPath(reportId);
    case 'weekly':
      return getWeeklyReportPath(reportId);
    case 'monthly':
      return getMonthlyReportPath(reportId);
    case 'papers':
      return path.join(__dirname, `../reports/papers/daily/papers-${reportId}.html`);
    default:
      return null;
  }
}

/**
 * 尝试加载 JSON 数据
 */
function tryLoadJSON(reportType, reportId) {
  const jsonPath = getJsonPath(reportType, reportId);
  if (jsonPath && fs.existsSync(jsonPath)) {
    logger.info(`读取 JSON 数据：${jsonPath}`);
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  }
  return null;
}

/**
 * 从 HTML 解析基本数据（简化版）
 */
function parseDataFromHTML(reportType, reportId) {
  const htmlPath = getHtmlPath(reportType, reportId);
  if (!htmlPath || !fs.existsSync(htmlPath)) {
    throw new Error(`HTML 文件不存在：${htmlPath}`);
  }

  logger.info(`HTML 文件存在：${htmlPath}`);
  logger.warn('⚠️  无 JSON 数据，使用 --skip-ai 模式重新生成（无 AI 分析）');

  // 返回空数据结构
  const baseData = {
    date: reportType === 'daily' ? reportId : null,
    week: reportType === 'weekly' ? reportId : null,
    month: reportType === 'monthly' ? reportId : null,
    projects: [],
    aiInsights: null
  };

  return baseData;
}

/**
 * 加载日报数据
 */
function loadDailyData(date) {
  // 优先尝试 JSON
  let data = tryLoadJSON('daily', date);
  if (data) return data;

  // 降级到 HTML 解析
  return parseDataFromHTML('daily', date);
}

/**
 * 加载周报数据 - 从该周的日报聚合 + insights 数据
 */
function loadWeeklyData(weekId) {
  const weekMatch = weekId.match(/(\d{4})-W(\d{2})/);
  if (!weekMatch) {
    throw new Error(`无效的周数格式：${weekId}，应为 YYYY-Www (如 2026-W16)`);
  }

  const year = parseInt(weekMatch[1]);
  const week = parseInt(weekMatch[2]);

  // 计算该周的日期范围（ISO 周数计算）
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - jan4Day + 1);

  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(targetMonday);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    if (date <= new Date()) {
      dates.push(dateStr);
    }
  }

  logger.info(`周报 ${weekId} 包含日期：${dates.join(', ')}`);

  // 1. 尝试从 data/insights/weekly 读取 AI 分析数据
  const insightsPath = path.join(__dirname, `../data/insights/weekly/insights-${weekId}.json`);
  let aiInsights = null;
  if (fs.existsSync(insightsPath)) {
    logger.info(`读取周报 AI 分析：${insightsPath}`);
    aiInsights = JSON.parse(fs.readFileSync(insightsPath, 'utf-8'));
  } else {
    logger.warn(`周报 AI 分析不存在：${insightsPath}`);
  }

  // 2. 从日报聚合项目数据
  const allProjects = [];
  const projectMap = new Map();
  let hasData = false;

  for (const date of dates) {
    const dailyJsonPath = path.join(__dirname, `../reports/daily/github-daily-${date}.json`);
    if (fs.existsSync(dailyJsonPath)) {
      hasData = true;
      const dailyData = JSON.parse(fs.readFileSync(dailyJsonPath, 'utf-8'));

      if (dailyData.projects) {
        for (const project of dailyData.projects) {
          const key = project.fullName || project.name;
          if (!projectMap.has(key)) {
            projectMap.set(key, { ...project });
            allProjects.push(projectMap.get(key));
          } else {
            const existing = projectMap.get(key);
            existing.totalStars = Math.max(existing.totalStars || 0, project.totalStars || 0);
            existing.todayStars = (existing.todayStars || 0) + (project.todayStars || 0);
            if (project.analysis) existing.analysis = project.analysis;
          }
        }
      }
    }
  }

  // 3. 如果没有日报数据但有 AI 分析，从 insights 中提取项目信息
  if (!hasData && aiInsights) {
    logger.info('从 AI 分析中提取项目信息...');

    // 先从 highlights 中提取所有提到的项目 stars
    const starsMap = new Map();
    const descMap = new Map();
    if (aiInsights.highlights) {
      for (const highlight of aiInsights.highlights) {
        // 匹配所有 owner/repo（XXX/XXX 格式）后跟括号和星星数
        // 包括在文本中间被提及的项目（如 GenericAgent（4,258⭐））
        const allMatches = highlight.matchAll(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)[^(（]*[(（](\d+[,.]?\d*)([Kk])?[⭐]/g);
        for (const match of allMatches) {
          const repo = match[1];
          const starsStr = match[2].replace(',', '').replace('.', '');
          let stars = parseInt(starsStr);
          // 只有数字后紧跟 K/k 才乘以 1000
          if (match[3] && (match[3] === 'K' || match[3] === 'k')) {
            stars *= 1000;
          }
          starsMap.set(repo, stars);
          logger.debug(`提取 ${repo} stars: ${stars}`);
        }

        // 保存第一个项目的描述（highlight 的主体）
        const firstMatch = highlight.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)[(（](\d+[,.]?\d*)([Kk])?[⭐]/);
        if (firstMatch) {
          const descFull = highlight.split(':')[1] || highlight.split('：')[1] || highlight;
          descMap.set(firstMatch[1], descFull.trim());
        }
      }
    }

    // 从 topProjects 中提取
    if (aiInsights.topProjects && Array.isArray(aiInsights.topProjects)) {
      for (const top of aiInsights.topProjects) {
        if (top.repo && !projectMap.has(top.repo)) {
          // 从 starsMap 中获取 stars
          let stars = starsMap.get(top.repo) || 0;
          // 如果没有，尝试从 reason 中提取
          if (stars === 0 && top.reason) {
            // 尝试匹配 K 格式（如 58K、62K）
            const kMatch = top.reason.match(/(\d+\.?\d*)[Kk][。星\s/]/);
            if (kMatch) {
              stars = Math.round(parseFloat(kMatch[1]) * 1000);
            } else {
              // 尝试匹配数字⭐格式（如（19,346⭐））
              const numMatch = top.reason.match(/[(（](\d+[,.]?\d*)⭐/);
              if (numMatch) {
                stars = parseInt(numMatch[1].replace(',', '').replace('.', ''));
              }
            }
          }

          projectMap.set(top.repo, {
            fullName: top.repo,
            name: top.repo.split('/')[1],
            stars: stars,  // HTML generator 期望的字段名
            totalStars: stars,  // 兼容性保留
            todayStars: 0,
            forks: 0,
            language: null,
            category: top.category,
            descZh: top.reason || '',
            description: top.reason || '',
            analysis: {
              type: top.category,
              coreFunctions: [],
              useCases: top.useCases || [],
              trends: []
            }
          });
          allProjects.push(projectMap.get(top.repo));
        }
      }
    }

    // 从 emergingFields 中提取
    if (aiInsights.emergingFields && Array.isArray(aiInsights.emergingFields)) {
      for (const field of aiInsights.emergingFields) {
        if (field.projects && Array.isArray(field.projects)) {
          for (const repoName of field.projects) {
            if (!projectMap.has(repoName)) {
              projectMap.set(repoName, {
                fullName: repoName,
                name: repoName.split('/')[1],
                stars: 0,
                totalStars: 0,
                todayStars: 0,
                forks: 0,
                language: null,
                descZh: '',
                description: '',
                analysis: {
                  type: 'general',
                  coreFunctions: [],
                  useCases: [],
                  trends: []
                }
              });
              allProjects.push(projectMap.get(repoName));
            }
          }
        }
      }
    }

    logger.info(`从 insights 中提取到 ${allProjects.length} 个项目`);
  }

  if (hasData || aiInsights) {
    logger.info(`聚合 ${dates.length} 份日报，获得 ${allProjects.length} 个项目`);

    // 计算统计数据
    const totalStars = allProjects.reduce((sum, p) => sum + (p.stars || 0), 0);
    const avgStars = allProjects.length > 0 ? Math.round(totalStars / allProjects.length) : 0;
    const maxTodayStars = allProjects.length > 0 ? Math.max(...allProjects.map(p => p.todayStars || 0)) : 0;
    const hotProject = maxTodayStars > 0 ? (allProjects.find(p => p.todayStars === maxTodayStars)?.fullName || '') : '';

    // 计算 AI 项目数（category 为 agent 或 llm）
    const aiProjects = allProjects.filter(p => {
      const cat = (p.category || p.analysis?.type || '').toLowerCase();
      return cat === 'agent' || cat === 'llm';
    }).length;

    return {
      week: weekId,
      weekStart: weekId,  // html-generator.js 期望的字段
      projects: allProjects,
      totalProjects: allProjects.length,
      aiInsights: aiInsights,
      stats: {
        totalProjects: allProjects.length,
        avgStars: avgStars,
        aiProjects: allProjects.filter(p => p.category === 'agent' || p.category === 'llm').length
      },
      summary: {
        total: allProjects.length,
        avgStars: avgStars,
        maxTodayStars: maxTodayStars,
        topProject: hotProject
      }
    };
  }

  // 无数据时返回空结构
  logger.warn('⚠️  无可用数据，使用 --skip-ai 模式重新生成');
  return {
    week: weekId,
    projects: [],
    totalProjects: 0,
    aiInsights: null
  };
}

/**
 * 加载月报数据 - 从该月的日报聚合
 */
function loadMonthlyData(monthId) {
  // 尝试直接读取月报 JSON
  let data = tryLoadJSON('monthly', monthId);
  if (data) return data;

  const monthMatch = monthId.match(/(\d{4})-(\d{2})/);
  if (!monthMatch) {
    throw new Error(`无效的月份格式：${monthId}，应为 YYYY-MM (如 2026-03)`);
  }

  const year = parseInt(monthMatch[1]);
  const month = parseInt(monthMatch[2]);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateStr = date.toISOString().split('T')[0];
    if (date <= new Date()) {
      dates.push(dateStr);
    }
  }

  logger.info(`月份 ${monthId} 包含 ${dates.length} 天`);

  const allProjects = [];
  const projectMap = new Map();

  for (const date of dates) {
    const dailyJsonPath = path.join(__dirname, `../reports/daily/github-daily-${date}.json`);
    if (fs.existsSync(dailyJsonPath)) {
      const dailyData = JSON.parse(fs.readFileSync(dailyJsonPath, 'utf-8'));
      if (dailyData.projects) {
        for (const project of dailyData.projects) {
          const key = project.fullName || project.name;
          if (!projectMap.has(key)) {
            projectMap.set(key, { ...project });
            allProjects.push(projectMap.get(key));
          } else {
            const existing = projectMap.get(key);
            existing.totalStars = Math.max(existing.totalStars || 0, project.totalStars || 0);
            existing.todayStars = (existing.todayStars || 0) + (project.todayStars || 0);
          }
        }
      }
    }
  }

  if (allProjects.length > 0) {
    return {
      month: monthId,
      projects: allProjects,
      totalProjects: allProjects.length
    };
  }

  logger.warn('⚠️  无可用数据，使用 --skip-ai 模式重新生成');
  return {
    month: monthId,
    projects: [],
    totalProjects: 0
  };
}

/**
 * 加载论文报告数据
 */
function loadPapersData(date) {
  // 尝试读取 JSON
  let data = tryLoadJSON('papers', date);
  if (data) return data;

  // 降级提示
  logger.warn('⚠️  无 JSON 数据，论文报告需要完整数据才能生成');
  return null;
}

/**
 * 重新生成 HTML
 */
async function regenerateHTML(reportType, reportId) {
  logger.info(`\n=== 重新生成 ${reportType.toUpperCase()} 报告：${reportId} ===\n`);

  let data;
  let outputPath;

  try {
    // 加载数据
    switch (reportType) {
      case 'daily':
        data = loadDailyData(reportId);
        break;
      case 'weekly':
        data = loadWeeklyData(reportId);
        break;
      case 'monthly':
        data = loadMonthlyData(reportId);
        break;
      case 'papers':
        data = loadPapersData(reportId);
        break;
      default:
        throw new Error(`未知的报告类型：${reportType}`);
    }

    if (!data) {
      throw new Error(`无法加载 ${reportType} ${reportId} 的数据`);
    }

    // 生成 HTML
    const generator = new HTMLGenerator();

    switch (reportType) {
      case 'daily':
        outputPath = await generator.generateDaily(data);
        break;
      case 'weekly':
        outputPath = await generator.generateWeekly(data);
        break;
      case 'monthly':
        outputPath = await generator.generateMonthly(data);
        break;
      case 'papers':
        const papersGenerator = new PapersHtmlGenerator();
        outputPath = await papersGenerator.generate(data);
        break;
    }

    logger.success(`✅ HTML 重新生成成功：${outputPath}`);
    return outputPath;

  } catch (error) {
    logger.error(`❌ 重新生成失败：${error.message}`);
    throw error;
  }
}

/**
 * 重新发送推送通知
 */
async function resendPush(reportType, reportId) {
  logger.info(`\n=== 重新发送推送通知：${reportType} ${reportId} ===\n`);

  try {
    const MessageSender = require('../src/notifier/message-sender');
    const sender = new MessageSender();

    // 构建报告 URL
    let reportUrl;
    const baseUrl = 'https://report.wenspock.site';

    switch (reportType) {
      case 'daily':
        reportUrl = `${baseUrl}/daily/github-ai-trending-${reportId}.html`;
        break;
      case 'weekly':
        reportUrl = `${baseUrl}/weekly/github-weekly-${reportId}.html`;
        break;
      case 'monthly':
        reportUrl = `${baseUrl}/monthly/github-monthly-${reportId}.html`;
        break;
      case 'papers':
        reportUrl = `${baseUrl}/papers/papers-${reportId}.html`;
        break;
    }

    logger.info(`推送 URL: ${reportUrl}`);

    const result = await sender.sendFeishu({
      type: reportType,
      title: `GitHub ${reportType === 'daily' ? '日报' : reportType === 'weekly' ? '周报' : reportType === 'monthly' ? '月报' : '论文'}报告`,
      reportUrl: reportUrl
    });

    if (result.success) {
      logger.success('✅ 推送通知已发送');
    } else {
      logger.error(`❌ 推送发送失败：${result.error}`);
      throw new Error(result.error);
    }

  } catch (error) {
    logger.error(`❌ 推送发送失败：${error.message}`);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 重新生成 HTML
    const outputPath = await regenerateHTML(reportType, reportId);

    // 如果指定了 --push，发送推送通知
    if (shouldPush) {
      await resendPush(reportType, reportId);
    }

    console.log('\n✅ 完成!\n');

  } catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    process.exit(1);
  }
}

main();
