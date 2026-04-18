#!/usr/bin/env node
/**
 * 生成所有项目 Wiki 的 HTML 详情页
 */

const path = require('path');
const ProjectWikiHtmlGenerator = require('../src/generator/project-wiki-html-generator');

async function main() {
  console.log('生成项目 Wiki 详情页...\n');

  const generator = new ProjectWikiHtmlGenerator({
    outputDir: path.join(process.cwd(), 'reports', 'projects')
  });

  try {
    const paths = await generator.generateAll();
    console.log(`\n✅ 已生成 ${paths.length} 个项目 Wiki 详情页`);
  } catch (error) {
    console.error(`❌ 生成失败：${error.message}`);
    process.exit(1);
  }
}

main();
