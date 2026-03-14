#!/usr/bin/env node

/**
 * 月报生成脚本
 * 用法：node scripts/generate-monthly.js <month> [--no-push]
 * 示例：node scripts/generate-monthly.js 2026-03
 *        node scripts/generate-monthly.js 2026-03 --no-push
 * 
 * 参数说明：
 *   --no-push  跳过推送通知（调试模式）
 */

// 加载环境变量
require('dotenv').config();

const path = require('path');
const DataLoader = require('../src/loader/data-loader');
const InsightAnalyzer = require('../src/analyzer/insight-analyzer');
const HTMLGenerator = require('../src/generator/html-generator');
const MessageSender = require('../src/notifier/message-sender');
const logger = require('../src/utils/logger');

// 解析命令行参数
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');

// 过滤掉参数，只保留月份
const monthArg = args.find(arg => !arg.startsWith('--'));
const month = monthArg;

if (!month) {
  console.error('❌ 错误：请提供月份参数');
  console.error('用法：node scripts/generate-monthly.js <month> [--no-push]');
  console.error('示例：node scripts/generate-monthly.js 2026-03');
  console.error('      node scripts/generate-monthly.js 2026-03 --no-push');
  process.exit(1);
}

// 验证月份格式 (YYYY-MM)
const monthRegex = /^\d{4}-\d{2}$/;
if (!monthRegex.test(month)) {
  console.error('❌ 错误：月份格式必须是 YYYY-MM');
  process.exit(1);
}

if (noPush) {
  console.log('ℹ️  调试模式：已禁用推送通知');
}

async function generateMonthlyReport() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 开始生成月报');
  console.log('='.repeat(60));
  console.log(`📅 月份：${month}\n`);

  try {
    // 步骤 1: 加载数据
    console.log('📥 步骤 1/4: 加载数据...');
    const loader = new DataLoader();
    const monthlyData = await loader.loadMonthlyData(month);
    
    // 验证数据
    const validation = loader.validateData(monthlyData);
    if (!validation.valid) {
      throw new Error(`数据验证失败：${validation.errors.join(', ')}`);
    }
    
    const projectCount = monthlyData.brief?.trending_repos?.length || 0;
    console.log(`   ✅ 数据加载成功：${projectCount} 个项目\n`);

    // 步骤 2: AI 分析（如果还没有 AI 洞察）
    if (!monthlyData.aiInsights) {
      console.log('🤖 步骤 2/4: AI 分析...');
      const analyzer = new InsightAnalyzer();
      monthlyData.aiInsights = await analyzer.analyzeMonthly(monthlyData);
      console.log('   ✅ AI 分析完成\n');
    } else {
      console.log('ℹ️  AI 洞察已存在，跳过分析\n');
    }

    // 步骤 3: 生成 HTML
    console.log('🎨 步骤 3/4: 生成 HTML...');
    const generator = new HTMLGenerator();
    const reportPath = await generator.generateMonthly(monthlyData);
    console.log(`   ✅ HTML 已生成：${reportPath}\n`);

    // 步骤 4: 发送通知（可选）
    console.log('📤 步骤 4/4: 发送通知...');
    
    // 先生成通知内容（用于获取报告 URL）
    const sender = new MessageSender();
    const notificationContent = sender.generateNotificationContent('monthly', monthlyData);
    let results = [];
    
    if (noPush) {
      console.log('   ⏭️  已跳过推送通知（--no-push）\n');
    } else {
      // 构建通知消息
      const notifyOptions = {
        type: 'monthly',
        title: notificationContent.title,
        content: notificationContent.content,
        reportUrl: notificationContent.reportUrl
      };

      // 发送通知（如果配置了 webhook）
      results = await sender.sendAll(notifyOptions);
      const successCount = results.filter(r => r.success).length;
      console.log(`   ✅ 通知发送：${successCount}/${results.length} 成功\n`);
    }

    // 完成
    console.log('='.repeat(60));
    console.log('🎉 月报生成完成！');
    console.log('='.repeat(60));
    console.log(`📄 报告文件：${reportPath}`);
    console.log(`🔗 访问链接：${notificationContent.reportUrl}\n`);

    return {
      success: true,
      month,
      reportPath,
      reportUrl: notificationContent.reportUrl,
      projectCount,
      notificationResults: results
    };
  } catch (error) {
    console.error('\n❌ 月报生成失败:', error.message);
    console.error(error.stack);
    return {
      success: false,
      month,
      error: error.message
    };
  }
}

// 执行生成
generateMonthlyReport()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 未处理的错误:', error);
    process.exit(1);
  });
