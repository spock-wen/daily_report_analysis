#!/usr/bin/env node
/**
 * 生成所有 Wiki HTML 页面
 * 按顺序生成：项目 Wiki → 论文 Wiki → 领域 Wiki → Wiki 索引页
 */

const path = require('path');
const ProjectWikiHtmlGenerator = require('../src/generator/project-wiki-html-generator');
const PaperWikiHtmlGenerator = require('../src/generator/paper-wiki-html-generator');
const DomainWikiGenerator = require('../src/generator/domain-wiki-generator');
const WikiIndexGenerator = require('../src/generator/wiki-index-generator');

async function main() {
  console.log('🚀 开始生成所有 Wiki HTML 页面...\n');

  try {
    // 1. 生成项目 Wiki 详情页
    console.log('📁 生成项目 Wiki 详情页...');
    const projectGenerator = new ProjectWikiHtmlGenerator();
    const projectPaths = await projectGenerator.generateAll();
    console.log(`  ✅ 已生成 ${projectPaths.length} 个项目 Wiki 页面\n`);

    // 2. 生成论文 Wiki 详情页
    console.log('📄 生成论文 Wiki 详情页...');
    const paperGenerator = new PaperWikiHtmlGenerator({
      outputDir: path.join(process.cwd(), 'reports', 'papers')
    });
    const paperPaths = await paperGenerator.generateAll();
    console.log(`  ✅ 已生成 ${paperPaths.length} 个论文 Wiki 页面\n`);

    // 3. 生成领域 Wiki 页面
    console.log('🌐 生成领域 Wiki 页面...');
    const domainGenerator = new DomainWikiGenerator();
    const domainPaths = await domainGenerator.generateAll();
    console.log(`  ✅ 已生成 ${domainPaths.length} 个领域 Wiki 页面\n`);

    // 4. 生成 Wiki 索引页
    console.log('📊 生成 Wiki 索引页...');
    const indexGenerator = new WikiIndexGenerator();
    const indexPath = await indexGenerator.generate();
    console.log(`  ✅ Wiki 索引页已生成：${indexPath}\n`);

    // 汇总
    const total = projectPaths.length + paperPaths.length + domainPaths.length + 1;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 完成！共生成 ${total} 个 Wiki HTML 文件`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error(`❌ 生成失败：${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
