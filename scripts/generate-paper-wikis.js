#!/usr/bin/env node
/**
 * 生成所有论文 Wiki 的 HTML 详情页
 */

const path = require('path');
const PaperWikiHtmlGenerator = require('../src/generator/paper-wiki-html-generator');

async function main() {
  console.log('生成论文 Wiki 详情页...\n');

  const generator = new PaperWikiHtmlGenerator({
    outputDir: path.join(process.cwd(), 'reports', 'papers')
  });

  try {
    const paths = await generator.generateAll();
    console.log(`\n✅ 已生成 ${paths.length} 个论文 Wiki 详情页`);
  } catch (error) {
    console.error(`❌ 生成失败：${error.message}`);
    process.exit(1);
  }
}

main();
