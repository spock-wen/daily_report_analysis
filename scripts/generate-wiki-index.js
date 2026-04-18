#!/usr/bin/env node
/**
 * 生成 Wiki 索引页脚本
 */

const path = require('path');
const WikiIndexGenerator = require('../src/generator/wiki-index-generator');

async function main() {
  console.log('生成 Wiki 索引页...\n');

  const generator = new WikiIndexGenerator({
    outputDir: path.join(process.cwd(), 'reports')
  });

  try {
    const outputPath = await generator.generate();
    console.log(`\n✅ Wiki 索引页已生成：${outputPath}`);
  } catch (error) {
    console.error(`❌ 生成失败：${error.message}`);
    process.exit(1);
  }
}

main();
