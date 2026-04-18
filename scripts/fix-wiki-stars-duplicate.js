#!/usr/bin/env node
/**
 * 修复 Wiki Stars 字段重复问题
 * 清理"（最后更新：...）"重复内容
 */

const fs = require('fs');
const path = require('path');
const WikiManager = require('../src/wiki/wiki-manager');

const wikiManager = new WikiManager();
const projectsDir = wikiManager.projectsDir;

console.log('🔧 开始修复 Wiki Stars 字段...\n');

const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
let fixed = 0;

for (const file of files) {
  const wikiPath = path.join(projectsDir, file);
  let content = fs.readFileSync(wikiPath, 'utf-8');

  // 查找重复的（最后更新：...）模式
  const duplicatePattern = /（最后更新：[\d-]+）(?:（最后更新：[\d-]+）)+/g;
  const match = content.match(duplicatePattern);

  if (match) {
    // 替换为单个（最后更新：...）
    const fixedContent = content.replace(
      /(GitHub Stars: [\d,]+)((?:（最后更新：[\d-]+）)+)/g,
      (full, starsPart, updatesPart) => {
        // 只保留最后一个更新日期
        const lastUpdate = updatesPart.match(/（最后更新：([\d-]+)）$/);
        if (lastUpdate) {
          return `${starsPart}（最后更新：${lastUpdate[1]}）`;
        }
        return starsPart;
      }
    );

    fs.writeFileSync(wikiPath, fixedContent, 'utf-8');
    fixed++;
    console.log(`  ✅ 已修复：${file}`);
  }
}

console.log(`\n✅ 修复完成！共修复 ${fixed} 个文件`);
