#!/usr/bin/env node

/**
 * 日报生成脚本
 * 用法：node scripts/generate-daily.js <date>
 * 示例：node scripts/generate-daily.js 2026-03-08
 */

// 加载环境变量
require('dotenv').config();

const path = require('path');
const DataLoader = require('../src/loader/data-loader');
const InsightAnalyzer = require('../src/analyzer/insight-analyzer');
const HTMLGenerator = require('../src/generator/html-generator');
const MessageSender = require('../src/notifier/message-sender');
const logger = require('../src/utils/logger');

// 获取日期参数
const date = process.argv[2];

if (!date) {
  console.error('❌ 错误：请提供日期参数');
  console.error('用法：node scripts/generate-daily.js <date>');
  console.error('示例：node scripts/generate-daily.js 2026-03-08');
  process.exit(1);
}

// 验证日期格式 (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(date)) {
  console.error('❌ 错误：日期格式必须是 YYYY-MM-DD');
  process.exit(1);
}

async function generateDailyReport() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 开始生成日报');
  console.log('='.repeat(60));
  console.log(`📅 日期：${date}\n`);

  try {
    // 步骤 1: 加载数据
    console.log('📥 步骤 1/4: 加载数据...');
    const loader = new DataLoader();
    const dailyData = await loader.loadDailyData(date);
    
    // 验证数据
    const validation = loader.validateData(dailyData);
    if (!validation.valid) {
      throw new Error(`数据验证失败：${validation.errors.join(', ')}`);
    }
    
    const projectCount = dailyData.brief?.trending_repos?.length || 0;
    console.log(`   ✅ 数据加载成功：${projectCount} 个项目\n`);

    // 步骤 2: AI 分析（如果还没有 AI 洞察）
    if (!dailyData.aiInsights) {
      console.log('🤖 步骤 2/4: AI 分析...');
      const analyzer = new InsightAnalyzer();
      dailyData.aiInsights = await analyzer.analyzeDaily(dailyData);
      console.log('   ✅ AI 分析完成\n');
    } else {
      console.log('ℹ️  AI 洞察已存在，跳过分析\n');
    }

    // 步骤 3: 生成 HTML
    console.log('🎨 步骤 3/4: 生成 HTML...');
    const generator = new HTMLGenerator();
    const reportPath = await generator.generateDaily(dailyData);
    console.log(`   ✅ HTML 已生成：${reportPath}\n`);

    // 步骤 4: 发送通知（可选）
    console.log('📤 步骤 4/4: 发送通知...');
    const sender = new MessageSender();
    const notificationContent = sender.generateNotificationContent('daily', dailyData);
    
    // 构建通知消息
    const notifyOptions = {
      type: 'daily',
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
    console.log('🎉 日报生成完成！');
    console.log('='.repeat(60));
    console.log(`📄 报告文件：${reportPath}`);
    console.log(`🔗 访问链接：${notificationContent.reportUrl}\n`);

    return {
      success: true,
      date,
      reportPath,
      reportUrl: notificationContent.reportUrl,
      projectCount,
      notificationResults: results
    };
  } catch (error) {
    console.error('\n❌ 日报生成失败:', error.message);
    console.error(error.stack);
    return {
      success: false,
      date,
      error: error.message
    };
  }
}

// 执行生成
generateDailyReport()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 未处理的错误:', error);
    process.exit(1);
  });
