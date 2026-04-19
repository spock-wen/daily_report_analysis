#!/usr/bin/env node
/**
 * 清理 Wiki 文件中的重复版本记录
 * 使用简单直接的字符串匹配方法
 */

const fs = require('fs');
const path = require('path');

const WIKI_DIR = path.join(__dirname, '../wiki/projects');

/**
 * 清理单个 Wiki 文件的重复记录
 */
function cleanWikiFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // 找出所有版本历史条目的起始位置
  const headerRegex = /^### (\d{4}-\d{2}-\d{2})（([^)]+)）\s*$/gm;
  const matches = [];
  let match;

  while ((match = headerRegex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      date: match[1],
      eventType: match[2],
      fullHeader: match[0]
    });
  }

  if (matches.length <= 1) {
    return { cleaned: false, reason: '无重复' };
  }

  // 找出重复的条目（保留每个 date-eventType 的第一个）
  const seen = new Map();
  const toRemove = [];

  for (const m of matches) {
    const key = `${m.date}-${m.eventType}`;
    if (seen.has(key)) {
      toRemove.push({
        ...m,
        firstIndex: seen.get(key)
      });
    } else {
      seen.set(key, m.index);
    }
  }

  if (toRemove.length === 0) {
    return { cleaned: false, reason: '无重复' };
  }

  // 从后往前删除重复条目（避免索引偏移问题）
  // 每个条目的范围：从 ### header 到下一个 ### 或 ## 或文件结尾
  toRemove.reverse();

  for (const dup of toRemove) {
    // 找到这个条目的结束位置
    const nextHeaderRegex = /^### \d{4}-\d{2}-\d{2}|^## /gm;
    nextHeaderRegex.lastIndex = dup.index + dup.fullHeader.length;
    const nextMatch = nextHeaderRegex.exec(content);
    const endIdx = nextMatch ? nextMatch.index : content.length;

    // 删除这个条目（包括前面的空行）
    let startIdx = dup.index;
    while (startIdx > 0 && content[startIdx - 1] === '\n') {
      startIdx--;
    }

    content = content.slice(0, startIdx) + content.slice(endIdx);
  }

  fs.writeFileSync(filePath, content, 'utf-8');

  return {
    cleaned: true,
    removedCount: toRemove.length
  };
}

function main() {
  console.log('============================================================');
  console.log('  Wiki 重复记录清理工具');
  console.log('============================================================\n');

  if (!fs.existsSync(WIKI_DIR)) {
    console.error(`Wiki 目录不存在：${WIKI_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md'));
  let totalCleaned = 0;
  let totalRemoved = 0;

  for (const file of files) {
    const filePath = path.join(WIKI_DIR, file);
    const result = cleanWikiFile(filePath);

    if (result.cleaned) {
      console.log(`✅ ${file}: 移除 ${result.removedCount} 条重复记录`);
      totalCleaned++;
      totalRemoved += result.removedCount;
    }
  }

  console.log('\n============================================================');
  console.log(`  清理完成：${totalCleaned}/${files.length} 个文件，共移除 ${totalRemoved} 条重复记录`);
  console.log('============================================================\n');
}

main();
