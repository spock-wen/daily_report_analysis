#!/usr/bin/env node

/**
 * 日报生成脚本
 * 用法：node scripts/generate-daily.js <date> [--no-push]
 * 示例：node scripts/generate-daily.js 2026-03-08
 *       node scripts/generate-daily.js 2026-03-08 --no-push
 * 
 * 参数说明：
 *   --no-push  跳过推送通知（调试模式）
 * 
 * 时区处理说明：
 * - 前置项目使用 UTC 时间，生成的数据文件使用 UTC 日期戳
 * - 本脚本支持智能日期回退：优先使用指定日期，找不到则尝试前一天
 * - 适用于 GitHub Action 延迟执行场景
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
const { getDailyBriefPath } = require('../src/utils/path');

// 解析命令行参数
const args = process.argv.slice(2);
const noPush = args.includes('--no-push');

// 过滤掉参数，只保留日期
const dateArg = args.find(arg => !arg.startsWith('--'));
let date = dateArg;
let actualDate = date; // 实际使用的日期（可能回退）

if (!date) {
  console.error('❌ 错误：请提供日期参数');
  console.error('用法：node scripts/generate-daily.js <date> [--no-push]');
  console.error('示例：node scripts/generate-daily.js 2026-03-08');
  console.error('      node scripts/generate-daily.js 2026-03-08 --no-push');
  process.exit(1);
}

if (noPush) {
  console.log('ℹ️  调试模式：已禁用推送通知');
}

// 验证日期格式 (YYYY-MM-DD)
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(date)) {
  console.error('❌ 错误：日期格式必须是 YYYY-MM-DD');
  process.exit(1);
}

/**
 * 智能查找数据文件
 * 优先使用指定日期，找不到则尝试前一天（处理 UTC 时区问题）
 * 同时检查文件修改时间，确保是最近生成的
 */
async function findDataFile(targetDate) {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 北京时间
  
  // 计算今天的起始时间（北京时间 0:00）
  const todayStart = new Date(beijingTime);
  todayStart.setHours(0, 0, 0, 0);
  
  /**
   * 检查文件是否有效
   * @param {string} filePath - 文件路径
   * @param {string} dateStr - 日期字符串（用于日志）
   * @returns {Object|null} 文件有效时返回 {date, path}，无效返回 null
   */
  function checkFileValidity(filePath, dateStr) {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const stats = fs.statSync(filePath);
    const fileTime = new Date(stats.mtime);
    const fileBeijingTime = new Date(fileTime.getTime() + 8 * 60 * 60 * 1000);
    
    // 计算文件修改时间距离今天 0:00 的小时数
    const hoursSinceTodayStart = (fileBeijingTime - todayStart) / (1000 * 60 * 60);
    
    // 计算文件修改时间距离现在的小时数
    const hoursAgo = (beijingTime - fileBeijingTime) / (1000 * 60 * 60);
    
    // 有效性判断：
    // 1. 文件是今天生成的（从今天 0:00 到现在）
    // 2. 或者文件是在过去 30 小时内生成的（容错窗口）
    // 3. 或者文件是在过去 7 天内生成的（宽松模式，用于手动重新生成）
    const isValid = hoursSinceTodayStart > -2 && hoursAgo < 30 || hoursAgo < 168;
    
    if (isValid) {
      return {
        path: filePath,
        mtime: fileBeijingTime,
        hoursAgo: hoursAgo.toFixed(1)
      };
    }
    
    console.log(`   ⚠️  ${dateStr} 文件存在但修改时间异常 (${hoursAgo.toFixed(1)}小时前)`);
    return null;
  }
  
  // 尝试目标日期
  const targetPath = getDailyBriefPath(targetDate);
  const targetResult = checkFileValidity(targetPath, targetDate);
  if (targetResult) {
    return { 
      date: targetDate, 
      path: targetResult.path, 
      fallback: false,
      mtime: targetResult.mtime,
      hoursAgo: targetResult.hoursAgo
    };
  }
  
  // 计算前一天
  const prevDate = new Date(targetDate + 'T00:00:00Z');
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];
  
  // 尝试前一天
  const prevPath = getDailyBriefPath(prevDateStr);
  const prevResult = checkFileValidity(prevPath, prevDateStr);
  if (prevResult) {
    return { 
      date: prevDateStr, 
      path: prevResult.path, 
      fallback: true,
      mtime: prevResult.mtime,
      hoursAgo: prevResult.hoursAgo
    };
  }
  
  // 都找不到，抛出错误
  throw new Error(`未找到有效的数据文件（目标日期：${targetDate}，请检查前置项目是否正常执行）`);
}

async function generateDailyReport() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 开始生成日报');
  console.log('='.repeat(60));
  console.log(`📅 请求日期：${date}`);
  
  // 智能查找数据文件（处理 UTC 时区问题）
  console.log('🔍 查找数据文件...');
  const fileInfo = await findDataFile(date);
  actualDate = fileInfo.date;
  
  if (fileInfo.fallback) {
    console.log(`   ⚠️  未找到 ${date} 的数据，已回退到 ${actualDate}`);
  } else {
    console.log(`   ✅ 找到数据文件：${actualDate}`);
  }
  console.log(`   📁 文件路径：${fileInfo.path}`);
  console.log(`   🕐 修改时间：${fileInfo.mtime.toLocaleString('zh-CN')} (${fileInfo.hoursAgo}小时前)\n`);

  try {
    // 步骤 1: 加载数据
    console.log('📥 步骤 1/4: 加载数据...');
    const loader = new DataLoader();
    const dailyData = await loader.loadDailyData(actualDate);
    
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
    
    // 先生成通知内容（用于获取报告 URL）
    const sender = new MessageSender();
    const notificationContent = sender.generateNotificationContent('daily', dailyData);
    let results = [];
    
    if (noPush) {
      console.log('   ⏭️  已跳过推送通知（--no-push）\n');
    } else {
      // 构建通知消息（包含 TOP5 和核心洞察）
      const notifyOptions = {
        type: 'daily',
        title: notificationContent.title,
        content: notificationContent.content,
        reportUrl: notificationContent.reportUrl,
        summary: notificationContent.summary,
        top5: notificationContent.top5,
        insight: notificationContent.insight
      };

      // 发送通知（如果配置了 webhook）
      results = await sender.sendAll(notifyOptions);
      const successCount = results.filter(r => r.success).length;
      console.log(`   ✅ 通知发送：${successCount}/${results.length} 成功\n`);
    }

    // 完成
    console.log('='.repeat(60));
    console.log('🎉 日报生成完成！');
    console.log('='.repeat(60));
    console.log(`📄 报告文件：${reportPath}`);
    console.log(`🔗 访问链接：${notificationContent.reportUrl}\n`);

    return {
      success: true,
      date: actualDate,  // 使用实际日期
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
      date: actualDate,  // 使用实际日期
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
