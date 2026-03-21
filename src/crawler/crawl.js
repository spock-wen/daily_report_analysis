#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { fetchTrending } = require('./fetcher');
const { parseTrending } = require('./parser');
const { enhanceProjects } = require('./github_api');
const { generateJsonData } = require('./generator');
const InsightAnalyzer = require('../analyzer/insight-analyzer');
const HTMLGenerator = require('../generator/html-generator');
const MessageSender = require('../notifier/message-sender');
const logger = require('../utils/logger');

const args = process.argv.slice(2);
const noPush = args.includes('--no-push');
const triggerType = args.find(arg => !arg.startsWith('--')) || 'daily';

const VALID_TYPES = ['daily', 'weekly', 'monthly'];
if (!VALID_TYPES.includes(triggerType)) {
  console.error(`❌ 无效的类型：${triggerType}`);
  console.error(`用法：node src/crawler/crawl.js <daily|weekly|monthly> [--no-push]`);
  process.exit(1);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BRIEFS_DIR = path.join(DATA_DIR, 'briefs', triggerType);

function getDateIdentifier(triggerType) {
  const now = new Date();
  if (triggerType === 'daily') {
    return now.toISOString().split('T')[0];
  } else if (triggerType === 'weekly') {
    const year = now.getFullYear();
    const week = getISOWeek(now);
    return `${year}-W${String(week).padStart(2, '0')}`;
  } else if (triggerType === 'monthly') {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 GitHub Trending 报告生成器');
  console.log('='.repeat(60));
  console.log(`📅 类型：${triggerType}`);
  console.log(`⏰ 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  if (noPush) {
    console.log('🔇 调试模式：已禁用推送通知');
  }
  console.log('='.repeat(60) + '\n');

  const dateId = getDateIdentifier(triggerType);
  const sinceMap = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' };
  const since = sinceMap[triggerType];

  try {
    if (!fs.existsSync(BRIEFS_DIR)) {
      fs.mkdirSync(BRIEFS_DIR, { recursive: true });
    }

    console.log('📊 步骤 1/6: 获取 GitHub Trending 数据...');
    const html = await fetchTrending(5, since);
    console.log('✅ 数据获取成功\n');

    console.log('🔍 步骤 2/6: 解析项目信息...');
    let projects = parseTrending(html, since);
    if (projects.length === 0) {
      throw new Error('未解析到任何项目，请检查 GitHub Trending 页面结构是否变化');
    }
    console.log(`✅ 解析成功：${projects.length} 个项目\n`);

    if (GITHUB_TOKEN) {
      console.log('📡 步骤 3/6: 获取 GitHub API 详细数据...');
      projects = await enhanceProjects(projects, GITHUB_TOKEN);
      console.log('✅ 详细信息获取完成\n');
    } else {
      console.log('⚠️ 未设置 GITHUB_TOKEN，跳过详细信息获取\n');
    }

    console.log('📝 步骤 4/6: 生成 JSON 数据...');
    const jsonData = await generateJsonData(projects, triggerType);
    const jsonFile = path.join(BRIEFS_DIR, `data-${triggerType === 'daily' ? '' : triggerType + '-'}${dateId}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log(`✅ JSON 数据已生成：${jsonFile}\n`);

    console.log('🤖 步骤 5/6: AI 分析...');
    const analyzer = new InsightAnalyzer();
    const briefData = {
      date: dateId,
      brief: jsonData,
      trending_repos: jsonData.projects,
      stats: jsonData.stats
    };

    let aiInsights;
    if (triggerType === 'daily') {
      aiInsights = await analyzer.analyzeDaily(briefData);
    } else if (triggerType === 'weekly') {
      aiInsights = await analyzer.analyzeWeekly({ ...briefData, weekStart: dateId });
    } else {
      aiInsights = await analyzer.analyzeMonthly({ ...briefData, month: dateId });
    }
    jsonData.aiInsights = aiInsights;
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log('✅ AI 分析完成\n');

    console.log('🎨 步骤 6/6: 生成 HTML 报告...');
    const generator = new HTMLGenerator();
    let reportPath;
    if (triggerType === 'daily') {
      reportPath = await generator.generateDaily(jsonData);
    } else if (triggerType === 'weekly') {
      reportPath = await generator.generateWeekly(jsonData);
    } else {
      reportPath = await generator.generateMonthly(jsonData);
    }
    console.log(`✅ HTML 报告已生成：${reportPath}\n`);

    if (!noPush) {
      console.log('📤 发送推送通知...');
      const sender = new MessageSender();
      const reportUrl = sender.buildReportUrl(triggerType, dateId);

      const notificationContent = sender.generateNotificationContent(triggerType, jsonData, aiInsights);
      const notifyOptions = {
        type: triggerType,
        title: notificationContent.title,
        content: notificationContent.content,
        reportUrl: reportUrl,
        summary: notificationContent.summary,
        top5: notificationContent.top5,
        insight: notificationContent.insight
      };

      const results = await sender.sendAll(notifyOptions);
      const successCount = results.filter(r => r.success).length;
      console.log(`✅ 推送结果：${successCount}/${results.length} 成功\n`);
    } else {
      console.log('🔇 已跳过推送通知\n');
    }

    console.log('='.repeat(60));
    console.log('🎉 报告生成完成！');
    console.log('='.repeat(60));
    console.log(`📄 JSON 文件：${jsonFile}`);
    console.log(`📄 HTML 文件：${reportPath}`);
    console.log('');

    return { success: true, dateId, jsonFile, reportPath };

  } catch (error) {
    console.error('\n❌ 生成失败:', error.message);
    console.error('\n详细错误信息:');
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

main()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 未处理的错误:', error);
    process.exit(1);
  });
