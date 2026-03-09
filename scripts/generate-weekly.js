#!/usr/bin/env node

/**
 * 周报生成脚本
 * 用法：node scripts/generate-weekly.js <week>
 * 示例：node scripts/generate-weekly.js 2026-W10
 *        node scripts/generate-weekly.js 2026-03-02 (周起始日期)
 */

// 加载环境变量
require('dotenv').config();

const path = require('path');
const DataLoader = require('../src/loader/data-loader');
const InsightAnalyzer = require('../src/analyzer/insight-analyzer');
const HTMLGenerator = require('../src/generator/html-generator');
const MessageSender = require('../src/notifier/message-sender');
const logger = require('../src/utils/logger');

// 获取周参数
const week = process.argv[2];

if (!week) {
  console.error('❌ 错误：请提供周参数');
  console.error('用法：node scripts/generate-weekly.js <week>');
  console.error('示例：node scripts/generate-weekly.js 2026-W10');
  console.error('      node scripts/generate-weekly.js 2026-03-02 (周起始日期)');
  process.exit(1);
}

// 验证周格式 (YYYY-Www 或 YYYY-MM-DD)
const weekRegex = /^\d{4}-W\d{2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!weekRegex.test(week) && !dateRegex.test(week)) {
  console.error('❌ 错误：周格式必须是 YYYY-W10 或 YYYY-MM-DD (周起始日期)');
  process.exit(1);
}

async function generateWeeklyReport() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 开始生成周报');
  console.log('='.repeat(60));
  console.log(`📅 周期：${week}\n`);

  try {
    // 步骤 1: 加载数据
    console.log('📥 步骤 1/4: 加载数据...');
    const loader = new DataLoader();
    const weeklyData = await loader.loadWeeklyData(week);
    
    // 验证数据
    const validation = loader.validateData(weeklyData);
    if (!validation.valid) {
      throw new Error(`数据验证失败：${validation.errors.join(', ')}`);
    }
    
    const projectCount = weeklyData.brief?.trending_repos?.length || 0;
    console.log(`   ✅ 数据加载成功：${projectCount} 个项目\n`);

    // 步骤 2: AI 分析（如果还没有 AI 洞察）
    if (!weeklyData.aiInsights) {
      console.log('🤖 步骤 2/4: AI 分析...');
      const analyzer = new InsightAnalyzer();
      weeklyData.aiInsights = await analyzer.analyzeWeekly(weeklyData);
      console.log('   ✅ AI 分析完成\n');
    } else {
      console.log('ℹ️  AI 洞察已存在，跳过分析\n');
    }

    // 步骤 3: 生成 HTML
    console.log('🎨 步骤 3/4: 生成 HTML...');
    const generator = new HTMLGenerator();
    const reportPath = await generator.generateWeekly(weeklyData);
    console.log(`   ✅ HTML 已生成：${reportPath}\n`);

    // 步骤 4: 发送通知（可选）
    console.log('📤 步骤 4/4: 发送通知...');
    const sender = new MessageSender();
    const notificationContent = sender.generateNotificationContent('weekly', weeklyData);
    
    // 构建通知消息
    const notifyOptions = {
      type: 'weekly',
      title: notificationContent.title,
      content: notificationContent.content,
      reportUrl: notificationContent.reportUrl
    };

    // 发送通知（如果配置了 webhook）
    const results = await sender.sendAll(notifyOptions);
    const successCount = results.filter(r => r.success).length;
    console.log(`   ✅ 通知发送：${successCount}/${results.length} 成功\n`);

    // 完成
    console.log('='.repeat(60));
    console.log('🎉 周报生成完成！');
    console.log('='.repeat(60));
    console.log(`📄 报告文件：${reportPath}`);
    console.log(`🔗 访问链接：${notificationContent.reportUrl}\n`);

    return {
      success: true,
      week,
      reportPath,
      reportUrl: notificationContent.reportUrl,
      projectCount,
      notificationResults: results
    };
  } catch (error) {
    console.error('\n❌ 周报生成失败:', error.message);
    console.error(error.stack);
    return {
      success: false,
      week,
      error: error.message
    };
  }
}

// 执行生成
generateWeeklyReport()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 未处理的错误:', error);
    process.exit(1);
  });
