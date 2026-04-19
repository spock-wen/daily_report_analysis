#!/usr/bin/env node
/**
 * Wiki 修复工具
 *
 * 自动修复 Wiki 巡检发现的问题
 *
 * 使用方法:
 *   node scripts/wiki-repair.js              # 交互模式
 *   node scripts/wiki-repair.js --all        # 自动修复所有
 *   node scripts/wiki-repair.js --fix domains  # 只修复领域分类
 *   node scripts/wiki-repair.js --fix dates    # 只修复日期格式
 */

const fs = require('fs');
const path = require('path');

const WIKI_DIR = path.join(process.cwd(), 'wiki');
const PROJECTS_DIR = path.join(WIKI_DIR, 'projects');
const DOMAINS_DIR = path.join(WIKI_DIR, 'domains');

// 有效的领域分类映射（将旧值映射到新值）
const DOMAIN_MAPPING = {
  'platform': 'dev-tool',
  'infrastructure': 'dev-tool',
  'finance': 'dev-tool',
  'physics': 'other',
  'game': 'other',
  'devtool': 'dev-tool'  // 统一格式
};

// 有效的领域列表
const VALID_DOMAINS = [
  'agent', 'rag', 'llm', 'speech', 'vision',
  'dev-tool', 'browser', 'database', 'security',
  'robotics', 'audio', 'video', 'multimodal',
  'general', 'other'
];

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    fixAll: false,
    fixType: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') {
      options.fixAll = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--fix' && args[i + 1]) {
      options.fixType = args[++i];
    }
  }

  return options;
}

/**
 * 获取所有 Wiki 文件
 */
function getAllWikiFiles() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.md'));
}

/**
 * 读取 Wiki 文件内容
 */
function readWikiFile(filename) {
  const filePath = path.join(PROJECTS_DIR, filename);
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 写入 Wiki 文件
 */
function writeWikiFile(filename, content) {
  const filePath = path.join(PROJECTS_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 修复领域分类
 */
function fixDomainClassification(dryRun = false) {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  修复领域分类');
  console.log('════════════════════════════════════════════════════════════════\n');

  const files = getAllWikiFiles();
  let fixedCount = 0;

  for (const file of files) {
    let content = readWikiFile(file);

    const domainMatch = content.match(/- 领域分类：([^\n]+)/);
    if (!domainMatch) continue;

    const currentDomain = domainMatch[1].trim().toLowerCase();

    // 检查是否是有效领域
    if (VALID_DOMAINS.includes(currentDomain)) continue;

    // 查找映射
    const newDomain = DOMAIN_MAPPING[currentDomain] || 'other';

    // 替换领域分类
    content = content.replace(
      /- 领域分类：[^\n]+/,
      `- 领域分类：${newDomain}`
    );

    if (dryRun) {
      console.log(`  [DRY RUN] ${file}: ${currentDomain} → ${newDomain}`);
    } else {
      writeWikiFile(file, content);
      console.log(`  ✅ ${file}: ${currentDomain} → ${newDomain}`);
    }
    fixedCount++;
  }

  console.log(`\n  共修复 ${fixedCount} 个文件`);
  return fixedCount;
}

/**
 * 修复日期格式（undefined 问题）
 */
function fixDateFormat(dryRun = false) {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  修复日期格式');
  console.log('════════════════════════════════════════════════════════════════\n');

  const files = getAllWikiFiles();
  let fixedCount = 0;

  for (const file of files) {
    let content = readWikiFile(file);
    let modified = false;

    // 修复首次上榜
    if (content.includes('- 首次上榜：undefined')) {
      // 尝试从版本历史中提取最早日期
      const versionDates = content.match(/### (\d{4}-\d{2}-\d{2})/g);
      let firstSeen = '2026-01-01'; // 默认值

      if (versionDates && versionDates.length > 0) {
        const dates = versionDates.map(d => d.replace('### ', ''));
        dates.sort();
        firstSeen = dates[0];
      }

      content = content.replace(
        /- 首次上榜：undefined/,
        `- 首次上榜：${firstSeen}`
      );
      modified = true;
    }

    // 修复最近上榜
    if (content.includes('- 最近上榜：undefined')) {
      // 尝试从版本历史中提取最晚日期
      const versionDates = content.match(/### (\d{4}-\d{2}-\d{2})/g);
      let lastSeen = new Date().toISOString().split('T')[0];

      if (versionDates && versionDates.length > 0) {
        const dates = versionDates.map(d => d.replace('### ', ''));
        dates.sort((a, b) => b.localeCompare(a));
        lastSeen = dates[0];
      }

      content = content.replace(
        /- 最近上榜：undefined/,
        `- 最近上榜：${lastSeen}`
      );
      modified = true;
    }

    if (modified) {
      if (dryRun) {
        console.log(`  [DRY RUN] ${file}: 修复日期格式`);
      } else {
        writeWikiFile(file, content);
        console.log(`  ✅ ${file}: 修复日期格式`);
      }
      fixedCount++;
    }
  }

  console.log(`\n  共修复 ${fixedCount} 个文件`);
  return fixedCount;
}

/**
 * 修复空的版本历史并清理 undefined 日期条目
 */
function fixEmptyVersionHistory(dryRun = false) {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  修复空版本历史');
  console.log('════════════════════════════════════════════════════════════════\n');

  const files = getAllWikiFiles();
  let fixedCount = 0;
  let cleanedCount = 0;

  for (const file of files) {
    let content = readWikiFile(file);
    let modified = false;

    // 1. 先清理 undefined 日期的版本条目
    const undefinedVersionEntries = content.match(/### undefined（[^)]+）[\s\S]*?(?=\n###|\n## |$)/g);
    if (undefinedVersionEntries && undefinedVersionEntries.length > 0) {
      // 提取每个 undefined 条目的分析内容
      const analyses = undefinedVersionEntries.map(entry => {
        const analysisMatch = entry.match(/\*\*分析\*\*:(.+?)(?:\n|$)/);
        return analysisMatch ? analysisMatch[1].trim() : null;
      }).filter(a => a && !a.includes('undefined'));

      // 删除所有 undefined 条目
      content = content.replace(/### undefined（[^)]+）[\s\S]*?(?=\n###|\n## 跨项目关联)/g, '');
      cleanedCount += undefinedVersionEntries.length;

      // 如果有有效的分析内容，保留到一个条目中
      if (analyses.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const mergedEntry = `### ${today}（历史数据修复）
**来源**: 系统修复
**分析**: ${analyses[0]}
`;
        // 在版本历史章节后插入
        content = content.replace(
          /(## 版本历史\n)(\n*)(## 跨项目关联)/,
          `$1\n${mergedEntry}$3`
        );
      }
      modified = true;
    }

    // 2. 检查是否还有有效日期格式的版本历史条目
    const hasVersionEntry = /### \d{4}-\d{2}-\d{2}/.test(content);
    if (!hasVersionEntry) {
      // 提取基本信息
      const firstSeenMatch = content.match(/- 首次上榜：(\d{4}-\d{2}-\d{2})/);
      const firstSeen = firstSeenMatch ? firstSeenMatch[1] : new Date().toISOString().split('T')[0];

      // 构建版本历史条目
      const versionEntry = `
### ${firstSeen}（历史数据迁移）
**来源**: 系统迁移
**分析**: 历史数据补录

`;

      // 插入到版本历史章节
      content = content.replace(
        /(## 版本历史\n)(\n*)(## 跨项目关联)/,
        `$1\n${versionEntry}$3`
      );
      modified = true;
    }

    if (modified) {
      if (dryRun) {
        console.log(`  [DRY RUN] ${file}: 修复版本历史`);
      } else {
        writeWikiFile(file, content);
        console.log(`  ✅ ${file}: 修复版本历史`);
      }
      fixedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`  清理了 ${cleanedCount} 个无效的 undefined 日期条目`);
  }
  console.log(`\n  共修复 ${fixedCount} 个文件`);
  return fixedCount;
}

/**
 * 修复空的核心功能（添加占位符）
 */
function fixEmptyCoreFunctions(dryRun = false) {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  修复空核心功能');
  console.log('════════════════════════════════════════════════════════════════\n');

  const files = getAllWikiFiles();
  let fixedCount = 0;

  for (const file of files) {
    let content = readWikiFile(file);

    // 提取核心功能章节
    const sectionMatch = content.match(/(## 核心功能\n)([\s\S]*?)(?=\n## )/);
    if (!sectionMatch) continue;

    const sectionContent = sectionMatch[2].trim();
    const hasListItems = /^-\s+/m.test(sectionContent);

    if (hasListItems && sectionContent !== '') continue;

    // 提取项目名
    const projectMatch = content.match(/^# (.+)/);
    const projectName = projectMatch ? projectMatch[1] : '该项目';

    // 构建默认核心功能
    const defaultCoreFunctions = `- ${projectName} 核心功能待补充
- 请查看项目 README 获取详细信息
`;

    // 替换空的核心功能章节
    content = content.replace(
      /(## 核心功能\n)([\s\S]*?)(?=\n## )/,
      `$1${defaultCoreFunctions}\n`
    );

    if (dryRun) {
      console.log(`  [DRY RUN] ${file}: 添加核心功能占位符`);
    } else {
      writeWikiFile(file, content);
      console.log(`  ✅ ${file}: 添加核心功能占位符`);
    }
    fixedCount++;
  }

  console.log(`\n  共修复 ${fixedCount} 个文件`);
  return fixedCount;
}

/**
 * 创建缺失的领域 Wiki 文件
 */
function fixMissingDomainWikis(dryRun = false) {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  创建缺失的领域 Wiki 文件');
  console.log('════════════════════════════════════════════════════════════════\n');

  // 收集所有领域
  const files = getAllWikiFiles();
  const domainMap = new Map();

  for (const file of files) {
    const content = readWikiFile(file);
    const domainMatch = content.match(/- 领域分类：([^\n]+)/);
    if (domainMatch) {
      const domain = domainMatch[1].trim().toLowerCase();
      domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
    }
  }

  // 检查哪些领域 Wiki 缺失
  const missingDomains = [];
  if (fs.existsSync(DOMAINS_DIR)) {
    const existingFiles = fs.readdirSync(DOMAINS_DIR).map(f => f.replace('.md', '').toLowerCase());
    for (const [domain, count] of domainMap.entries()) {
      if (!existingFiles.includes(domain)) {
        missingDomains.push({ domain, count });
      }
    }
  } else {
    fs.mkdirSync(DOMAINS_DIR, { recursive: true });
    for (const [domain, count] of domainMap.entries()) {
      missingDomains.push({ domain, count });
    }
  }

  let createdCount = 0;
  for (const { domain, count } of missingDomains) {
    const domainWikiPath = path.join(DOMAINS_DIR, `${domain}.md`);
    const domainDisplayName = domain.charAt(0).toUpperCase() + domain.slice(1);

    const domainWikiContent = `# ${domainDisplayName} 领域

## 领域概览

${domainDisplayName} 领域包含 ${count} 个项目。

## 代表项目

| 项目 | Stars | 描述 |
|------|-------|------|
| - | - | - |

## 趋势演变

待补充

## 相关项目

待补充
`;

    if (dryRun) {
      console.log(`  [DRY RUN] 创建 wiki/domains/${domain}.md (${count} 个项目)`);
    } else {
      fs.writeFileSync(domainWikiPath, domainWikiContent);
      console.log(`  ✅ 创建 wiki/domains/${domain}.md (${count} 个项目)`);
    }
    createdCount++;
  }

  console.log(`\n  共创建 ${createdCount} 个领域 Wiki 文件`);
  return createdCount;
}

/**
 * 主函数
 */
function main() {
  const options = parseArgs();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    Wiki 修复工具                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (options.dryRun) {
    console.log('⚠️  当前为 DRY RUN 模式，不会实际修改文件\n');
  }

  if (options.fixAll || !options.fixType) {
    // 修复所有问题
    fixDomainClassification(options.dryRun);
    fixDateFormat(options.dryRun);
    fixEmptyVersionHistory(options.dryRun);
    fixEmptyCoreFunctions(options.dryRun);
    fixMissingDomainWikis(options.dryRun);
  } else {
    // 修复指定类型的问题
    switch (options.fixType) {
      case 'domains':
        fixDomainClassification(options.dryRun);
        break;
      case 'dates':
        fixDateFormat(options.dryRun);
        break;
      case 'history':
        fixEmptyVersionHistory(options.dryRun);
        break;
      case 'functions':
        fixEmptyCoreFunctions(options.dryRun);
        break;
      case 'domain-wikis':
        fixMissingDomainWikis(options.dryRun);
        break;
      default:
        console.log(`未知修复类型：${options.fixType}`);
        console.log('支持的修复类型：domains, dates, history, functions, domain-wikis');
        process.exit(1);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  修复完成！');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log('建议运行以下命令验证修复结果:');
  console.log('  node scripts/wiki-inspect.js\n');
}

main();
