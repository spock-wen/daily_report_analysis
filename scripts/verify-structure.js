#!/usr/bin/env node
/**
 * 项目结构验证脚本
 * 验证所有修复是否完成
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('  项目结构验证');
console.log('='.repeat(60) + '\n');

const checks = [
  {
    name: '主入口文件',
    path: 'src/index.js',
    type: 'file'
  },
  {
    name: '测试目录 - loader',
    path: 'tests/loader',
    type: 'directory'
  },
  {
    name: '测试目录 - analyzer',
    path: 'tests/analyzer',
    type: 'directory'
  },
  {
    name: '测试目录 - generator',
    path: 'tests/generator',
    type: 'directory'
  },
  {
    name: '测试目录 - notifier',
    path: 'tests/notifier',
    type: 'directory'
  },
  {
    name: '数据目录 - insights/monthly',
    path: 'data/insights/monthly',
    type: 'directory'
  },
  {
    name: 'API 文档',
    path: 'docs/API.md',
    type: 'file'
  },
  {
    name: '部署与开发指南',
    path: 'docs/GUIDE.md',
    type: 'file'
  }
];

const removedFiles = [
  {
    name: '临时测试 - phase1-test.js',
    path: 'tests/phase1-test.js'
  },
  {
    name: '临时测试 - phase2-test.js',
    path: 'tests/phase2-test.js'
  },
  {
    name: '临时脚本 - test-weekly.js',
    path: 'scripts/test-weekly.js'
  }
];

let passed = 0;
let failed = 0;

// 检查应该存在的文件
checks.forEach(check => {
  const fullPath = path.join(__dirname, '..', check.path);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    console.log(`✅ ${check.name}: ${check.path}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}: ${check.path}`);
    failed++;
  }
});

console.log('\n' + '-'.repeat(60) + '\n');

// 检查应该删除的文件
removedFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file.path);
  const exists = fs.existsSync(fullPath);
  
  if (!exists) {
    console.log(`✅ ${file.name} 已删除`);
    passed++;
  } else {
    console.log(`❌ ${file.name} 仍存在`);
    failed++;
  }
});

console.log('\n' + '='.repeat(60));
console.log(`  验证结果：${passed}/${passed + failed} 通过`);
console.log('='.repeat(60) + '\n');

if (failed === 0) {
  console.log('🎉 所有检查通过！项目结构已优化完成！\n');
  process.exit(0);
} else {
  console.log(`⚠️  有 ${failed} 项检查未通过，请检查\n`);
  process.exit(1);
}
