#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const WIKI_DIR = path.join(__dirname, 'wiki');
const PROJECTS_DIR = path.join(WIKI_DIR, 'projects');
const DOMAINS_DIR = path.join(WIKI_DIR, 'domains');

function extractDomains(content) {
  const isNewFormat = content.includes('## 📊 基本信息');
  
  if (isNewFormat) {
    const tableMatch = content.match(/\|\s*领域分类\s*\|\s*([^\|]+)\s*\|/);
    if (tableMatch) {
      return tableMatch[1].trim().toLowerCase().split(/[,，]/).map(d => d.trim()).filter(d => d);
    }
    return [];
  } else {
    const listMatch = content.match(/- 领域分类：([^\n]+)/);
    if (listMatch) {
      return listMatch[1].trim().toLowerCase().split(/[,，]/).map(d => d.trim()).filter(d => d);
    }
    return [];
  }
}

function main() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  创建领域 Wiki 文件');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  
  // 收集所有领域及其项目
  const domainMap = new Map();
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(PROJECTS_DIR, file), 'utf-8');
    const domains = extractDomains(content);
    for (const domain of domains) {
      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain).push(file);
    }
  }
  
  // 确保目录存在
  if (!fs.existsSync(DOMAINS_DIR)) {
    fs.mkdirSync(DOMAINS_DIR, { recursive: true });
  }
  
  // 生成领域 Wiki 文件
  let createdCount = 0;
  for (const [domain, projectFiles] of domainMap.entries()) {
    const domainWikiPath = path.join(DOMAINS_DIR, `${domain}.md`);
    if (!fs.existsSync(domainWikiPath)) {
      const domainDisplayName = domain.charAt(0).toUpperCase() + domain.slice(1);
      const projectCount = projectFiles.length;
      
      const content = `# ${domainDisplayName} 领域

## 领域概览

${domainDisplayName} 领域包含 ${projectCount} 个项目。

## 代表项目

| 项目 | Stars | 描述 |
|------|-------|------|
| - | - | - |

## 趋势演变

待补充

## 相关项目

待补充
`;
      
      fs.writeFileSync(domainWikiPath, content, 'utf-8');
      console.log(`  ✅ 创建 wiki/domains/${domain}.md (${projectCount} 个项目)`);
      createdCount++;
    } else {
      console.log(`  ℹ️  跳过 wiki/domains/${domain}.md (已存在)`);
    }
  }
  
  console.log(`\n  共创建 ${createdCount} 个领域 Wiki 文件`);
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  完成！');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
}

main();
