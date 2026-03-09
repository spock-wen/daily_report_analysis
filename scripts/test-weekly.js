#!/usr/bin/env node

/**
 * 周报生成测试脚本（不使用 AI）
 * 用法：node scripts/test-weekly.js
 */

require('dotenv').config();

const path = require('path');
const DataLoader = require('../src/loader/data-loader');
const HTMLGenerator = require('../src/generator/html-generator');

async function testWeeklyReport() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 测试周报生成（无 AI）');
  console.log('='.repeat(60));

  try {
    // 1. 加载数据
    console.log('\n📥 1. 加载数据...');
    const loader = new DataLoader();
    const weeklyData = await loader.loadWeeklyData('2026-W11');
    
    const projectCount = weeklyData.brief?.trending_repos?.length || 0;
    console.log(`   ✅ 数据加载成功：${projectCount} 个项目`);

    // 2. 生成 HTML（无 AI）
    console.log('\n🎨 2. 生成 HTML...');
    const generator = new HTMLGenerator();
    const reportPath = await generator.generateWeekly(weeklyData);
    console.log(`   ✅ HTML 已生成：${reportPath}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试完成！');
    console.log('='.repeat(60));
    console.log(`📄 报告文件：${reportPath}`);
    console.log(`\n请在浏览器中打开查看效果\n`);

    return { success: true, reportPath };
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

testWeeklyReport()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 未处理的错误:', error);
    process.exit(1);
  });
