#!/usr/bin/env node
/**
 * 生成所有领域 Wiki 页面
 */

const path = require('path');
const DomainWikiGenerator = require('../src/generator/domain-wiki-generator');

async function main() {
  console.log('生成领域 Wiki 页面...\n');

  const generator = new DomainWikiGenerator();

  try {
    const paths = await generator.generateAll();
    console.log(`\n✅ 已生成 ${paths.length} 个领域 Wiki 页面`);
  } catch (error) {
    console.error(`❌ 生成失败：${error.message}`);
    process.exit(1);
  }
}

main();
