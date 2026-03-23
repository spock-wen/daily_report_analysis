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
      
      // 并行执行基础分析和深度趋势分析
      console.log('   - 正在执行周度基础分析...');
      const basicInsightsPromise = analyzer.analyzeWeekly(weeklyData);
      
      // 尝试加载过去一周的日报数据进行深度分析
      // 优先基于实际存在的日报数据计算周范围
      let deepTrends = null;
      try {
        console.log('   - 正在执行深度趋势分析 (Cross-day)...');
        
        // 计算周一起始日期
        let startDate;
        if (weeklyData.weekStart && weeklyData.weekStart.includes('-W')) {
          const parts = weeklyData.weekStart.split('-W');
          const year = parseInt(parts[0]);
          const week = parseInt(parts[1]);
          
          // 计算该周周一的日期 (ISO week date algorithm)
          const jan4 = new Date(year, 0, 4);
          const dayOfWeek = jan4.getDay() || 7; 
          const firstMonday = new Date(jan4);
          firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
          
          startDate = new Date(firstMonday);
          startDate.setDate(firstMonday.getDate() + (week - 1) * 7);
        } else if (weeklyData.weekStart) {
          startDate = new Date(weeklyData.weekStart);
        } else {
          // 如果没有 weekStart，使用周报数据的日期
          startDate = weeklyData.generatedAt ? new Date(weeklyData.generatedAt) : new Date();
          // 回退到最近的周一
          const day = startDate.getDay() || 7;
          startDate.setDate(startDate.getDate() - day + 1);
        }

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        
        // 格式化为 YYYY-MM-DD
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        
        console.log(`   - 周范围：${startStr} 到 ${endStr}`);
        
        // 加载过去 7 天的日报数据
        const pastDailyData = await loader.loadPastWeekDailyData(startStr);
        
        if (pastDailyData && pastDailyData.length > 0) {
          console.log(`   - 成功加载 ${pastDailyData.length} 天的日报数据`);
          
          deepTrends = await analyzer.analyzeDeepTrends(pastDailyData, {
            start: startStr,
            end: endStr
          });
        } else {
          console.warn(`   ⚠️ 未找到日报数据，跳过深度分析`);
        }
      } catch (err) {
        console.warn(`   ⚠️ 深度趋势分析失败（非致命）：${err.message}`);
        console.warn(err.stack);
      }

      // 合并分析结果
      const basicInsights = await basicInsightsPromise;
      weeklyData.aiInsights = {
        ...basicInsights,
        deepTrends: deepTrends // 将深度趋势注入到 insights 对象中
      };
      
      // 保存合并后的结果
      await analyzer.saveInsights('weekly', weeklyData.weekStart, weeklyData.aiInsights);
      
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
    
    // 加载洞察数据（推送和非推送模式都需要，用于生成报告 URL）
    const insightsPath = path.join(__dirname, '..', 'data', 'insights', 'weekly', `insights-${week}.json`);
    let insights = null;
    let notificationContent = null;
    
    if (fs.existsSync(insightsPath)) {
      try {
        insights = JSON.parse(fs.readFileSync(insightsPath, 'utf-8'));
        if (!noPush) {
          console.log(`   ✅ 洞察数据已加载：${insightsPath}`);
        }
      } catch (error) {
        if (!noPush) {
          console.warn(`   ⚠️  洞察数据加载失败，使用降级模式：${error.message}`);
        }
      }
    }
    
    // 构建通知内容（用于获取正确的报告 URL）
    const weeklyDataForNotification = {
      ...weeklyData,
      week: weeklyData.week || week
    };
    
    const sender = new MessageSender();
    notificationContent = sender.generateNotificationContent('weekly', weeklyDataForNotification, insights);
    
    let results = null;
    
    if (noPush) {
      console.log('   ⏭️  已跳过推送通知（--no-push）\n');
    } else {
      // 发送周报通知（使用专用方法）
      if (insights) {
        try {
          results = await sender.sendWeeklyAll(weeklyDataForNotification, insights, {
            platforms: ['feishu', 'welink']
          });
          
          console.log(`   ✅ 通知发送完成`);
          console.log(`      - 飞书：${results.feishu?.success ? '成功' : '失败'}`);
          console.log(`      - WeLink: ${results.welink ? (Array.isArray(results.welink) ? results.welink.filter(r => r.success).length + '成功' : results.welink.success ? '成功' : '失败') : '未发送'}\n`);
        } catch (error) {
          console.error(`   ❌ 通知发送失败：${error.message}`);
        }
      } else {
        // 降级模式：使用旧版通知方式
        console.log('   ℹ️  使用降级模式发送通知...');
        
        const notifyOptions = {
          type: 'weekly',
          title: notificationContent.title,
          content: notificationContent.content,
          reportUrl: notificationContent.reportUrl
        };

        const sendResults = await sender.sendAll(notifyOptions);
        const successCount = sendResults.filter(r => r.success).length;
        console.log(`   ✅ 通知发送（降级）：${successCount}/${sendResults.length} 成功\n`);
        results = { feishu: { success: successCount > 0 }, welink: null };
      }
    }

    // 完成
    console.log('='.repeat(60));
    console.log('🎉 周报生成完成！');
    console.log('='.repeat(60));
    console.log(`📄 报告文件：${reportPath}`);
    const reportUrl = notificationContent?.reportUrl || `https://report.wenspock.site/weekly/github-weekly-${week}.html`;
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
