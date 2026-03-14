#!/usr/bin/env node

/**
 * 周报生成脚本
 * 用法：node scripts/generate-weekly.js <week> [--no-push]
 * 示例：node scripts/generate-weekly.js 2026-W10
 *        node scripts/generate-weekly.js 2026-03-02 (周起始日期)
 *        node scripts/generate-weekly.js 2026-W10 --no-push
 * 
 * 参数说明：
 *   --no-push  跳过推送通知（调试模式）
 */

// 加载环境变量
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const DataLoader = require('../src/loader/data-loader');
const InsightAnalyzer = require('../src/analyzer/insight-analyzer');
const HTMLGenerator = require('../src/generator/html-generator');
const MessageSender = require('../src/notifier/message-sender');
const logger = require('../src/utils/logger');

// 解析命令行参数
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');

// 过滤掉参数，只保留周标识
const weekArg = args.find(arg => !arg.startsWith('--'));
const week = weekArg;

if (!week) {
  console.error('❌ 错误：请提供周参数');
  console.error('用法：node scripts/generate-weekly.js <week> [--no-push]');
  console.error('示例：node scripts/generate-weekly.js 2026-W10');
  console.error('      node scripts/generate-weekly.js 2026-03-02 (周起始日期)');
  console.error('      node scripts/generate-weekly.js 2026-W10 --no-push');
  process.exit(1);
}

// 验证周格式 (YYYY-Www 或 YYYY-MM-DD)
const weekRegex = /^\d{4}-W\d{2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!weekRegex.test(week) && !dateRegex.test(week)) {
  console.error('❌ 错误：周格式必须是 YYYY-W10 或 YYYY-MM-DD (周起始日期)');
  process.exit(1);
}

if (noPush) {
  console.log('ℹ️  调试模式：已禁用推送通知');
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
    
    if (noPush) {
      console.log('   ⏭️  已跳过推送通知（--no-push）\n');
    } else {
      const sender = new MessageSender();
      let results = [];
      
      // 加载洞察数据
      const insightsPath = path.join(__dirname, '..', 'data', 'insights', 'weekly', `insights-${week}.json`);
      let insights = null;
      let notificationContent = null;
      
      if (fs.existsSync(insightsPath)) {
        try {
          insights = JSON.parse(fs.readFileSync(insightsPath, 'utf-8'));
          console.log(`   ✅ 洞察数据已加载：${insightsPath}`);
        } catch (error) {
          console.warn(`   ⚠️  洞察数据加载失败，使用降级模式：${error.message}`);
        }
      } else {
        console.warn(`   ⚠️  洞察数据不存在，使用降级模式：${insightsPath}`);
      }
      
      // 发送周报通知（使用专用方法）
      if (insights) {
        try {
          // 确保 weeklyData 有 week 字段
          const weeklyDataForNotification = {
            ...weeklyData,
            week: weeklyData.week || week
          };
          
          const results = await sender.sendWeeklyAll(weeklyDataForNotification, insights, {
            platforms: ['feishu', 'welink']
          });
          
          // 构建报告 URL
          notificationContent = sender.generateNotificationContent('weekly', weeklyDataForNotification, insights);
          
          console.log(`   ✅ 通知发送完成`);
          console.log(`      - 飞书：${results.feishu?.success ? '成功' : '失败'}`);
          console.log(`      - WeLink: ${results.welink ? (Array.isArray(results.welink) ? results.welink.filter(r => r.success).length + '成功' : results.welink.success ? '成功' : '失败') : '未发送'}\n`);
        } catch (error) {
          console.error(`   ❌ 通知发送失败：${error.message}`);
        }
      } else {
        // 降级模式：使用旧版通知方式
        console.log('   ℹ️  使用降级模式发送通知...');
        notificationContent = sender.generateNotificationContent('weekly', weeklyData);
        
        const notifyOptions = {
          type: 'weekly',
          title: notificationContent.title,
          content: notificationContent.content,
          reportUrl: notificationContent.reportUrl
        };

        const results = await sender.sendAll(notifyOptions);
        const successCount = results.filter(r => r.success).length;
        console.log(`   ✅ 通知发送（降级）：${successCount}/${results.length} 成功\n`);
      }
    }

    // 完成
    console.log('='.repeat(60));
    console.log('🎉 周报生成完成！');
    console.log('='.repeat(60));
    console.log(`📄 报告文件：${reportPath}`);
    const reportUrl = notificationContent?.reportUrl || `https://report.wenspock.site/weekly/weekly-${week}.html`;
    console.log(`🔗 访问链接：${reportUrl}\n`);

    return {
      success: true,
      week,
      reportPath,
      reportUrl,
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
