#!/usr/bin/env node

/**
 * 一键生成所有报告脚本
 * 用法：node scripts/generate-all.js [date]
 * 示例：node scripts/generate-all.js          (使用当前日期)
 *      node scripts/generate-all.js 2026-03-08 (使用指定日期)
 */

// 加载环境变量
require('dotenv').config();

const path = require('path');
const { execSync } = require('child_process');
const logger = require('../src/utils/logger');

// 获取日期参数（可选）
const dateArg = process.argv[2];

// 计算当前日期、周起始、月份
function getDateInfo() {
  const now = new Date();
  
  // 当前日期
  const date = dateArg || now.toISOString().split('T')[0];
  
  // 计算周起始（周一）
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  const weekStartStr = weekStart.toISOString().split('T')[0];
  
  // 当前月份
  const month = now.toISOString().slice(0, 7);
  
  return { date, weekStart: weekStartStr, month };
}

function runScript(scriptPath, args) {
  try {
    const command = `node ${scriptPath} ${args.join(' ')}`;
    execSync(command, { stdio: 'inherit' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateAllReports() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 开始生成所有报告');
  console.log('='.repeat(60) + '\n');

  const { date, weekStart, month } = getDateInfo();
  
  const results = {
    daily: null,
    weekly: null,
    monthly: null
  };

  // 生成日报
  console.log('\n📅 生成日报...');
  console.log('-'.repeat(60));
  results.daily = runScript(path.join(__dirname, 'generate-daily.js'), [date]);

  // 生成周报
  console.log('\n📅 生成周报...');
  console.log('-'.repeat(60));
  results.weekly = runScript(path.join(__dirname, 'generate-weekly.js'), [weekStart]);

  // 生成月报
  console.log('\n📅 生成月报...');
  console.log('-'.repeat(60));
  results.monthly = runScript(path.join(__dirname, 'generate-monthly.js'), [month]);

  // 汇总结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 生成结果汇总');
  console.log('='.repeat(60));
  
  const successCount = [
    results.daily?.success,
    results.weekly?.success,
    results.monthly?.success
  ].filter(Boolean).length;
  
  console.log(`\n日报：${results.daily?.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`周报：${results.weekly?.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`月报：${results.monthly?.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`\n总计：${successCount}/3 成功\n`);

  if (successCount === 3) {
    console.log('🎉 所有报告生成完成！\n');
    process.exit(0);
  } else {
    console.log('⚠️  部分报告生成失败，请检查错误信息\n');
    process.exit(1);
  }
}

// 执行生成
generateAllReports().catch(error => {
  console.error('\n💥 未处理的错误:', error);
  process.exit(1);
});
