/**
 * 数据质量检查
 * 检查 Wiki 数据的完整性、格式和新鲜度
 */

const fs = require('fs');
const path = require('path');

// 有效的领域分类列表
const VALID_DOMAINS = [
  'agent', 'ai-agent', 'ai-infrastructure', 'ai-tools', 'ai',
  'android', 'browser', 'cloud', 'coding-agent',
  'containerization', 'dev-tool', 'devtool', 'developer-tools',
  'development-tools', 'finance', 'framework',
  'game-development', 'gamedev', 'general', 'generative-ai', 'generative ai',
  'llm', 'llm-applications', 'machine-learning', 'machine learning',
  'memory-management', 'multi-agent-collaboration',
  'other', 'performance-optimization', 'plugins',
  'rag', 'sandbox', 'scientific', 'security', 'cybersecurity', 'penetration-testing',
  'software-development', 'speech', 'vertex-ai', 'vertex ai',
  'vision', 'database', 'robotics', 'audio',
  'video', 'multimodal', 'chatbot', 'multi-platform',
  'self-improvement', 'evolution', 'investment', 'analytics',
  'research', 'bioinformatics', 'drug-discovery', 'education', 'tutorial',
  'memory', 'data', 'quantitative', 'ai agent', 'software development',
  'multi-agent collaboration', 'tts', 'ocr', 'computer-vision', 'computer vision',
  'text-recognition', 'text recognition', 'llm applications', 'automation',
  'reverse-engineering', 'api-extraction', 'trading', 'orchestration',
  'multi-agent', 'claude-code', 'development tools', 'performance optimization',
  'memory management', 'python', 'ai infrastructure', 'ai tools', 'developer tools',
  'coding agent', 'gaming', 'geographic data', 'asr', 'osint', 'reconnaissance',
  'information gathering', 'context-database'
];

/**
 * 解析 Stars 字符串为数字
 */
function parseStars(starsStr) {
  if (!starsStr) return null;

  // 已经是数字
  if (typeof starsStr === 'number') return starsStr;

  const str = String(starsStr).trim();

  // 匹配 "1.5k"、"10k" 等格式
  const kMatch = str.match(/^([\d.]+)[kK]$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  // 匹配 "1,234" 格式
  const withCommas = str.replace(/,/g, '');
  const num = parseFloat(withCommas);
  return isNaN(num) ? null : num;
}

/**
 * 从内容中提取字段（支持表格和列表两种格式）
 */
function extractField(content, fieldName, isNewFormat) {
  if (isNewFormat) {
    // 新格式：从表格中提取 | 字段 | 值 |
    const tableRegex = new RegExp('\\|\\s*' + fieldName + '\\s*\\|\\s*([^|]+)\\s*\\|', 'i');
    const match = content.match(tableRegex);
    if (match) {
      return match[1].trim();
    }
    return null;
  } else {
    // 旧格式：从列表中提取 - 字段：值
    const listRegex = new RegExp('-\\s*' + fieldName + '[：:]\\s*([^\\n]+)');
    const match = content.match(listRegex);
    if (match) {
      return match[1].trim();
    }
    return null;
  }
}

/**
 * 检查 Stars 格式是否正确
 */
async function checkStarsFormat(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'stars-format',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const invalidStars = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const isNewFormat = content.includes('## 📊 基本信息');

    // 提取 Stars
    const starsStr = extractField(content, 'GitHub Stars', isNewFormat);
    if (starsStr) {
      const parsed = parseStars(starsStr);
      if (parsed === null && starsStr !== '0') {
        invalidStars.push({
          file: `wiki/projects/${file}`,
          value: starsStr,
          reason: '无法解析为数字'
        });
      }
    }
  }

  if (invalidStars.length > 0) {
    return {
      name: 'stars-format',
      status: 'warning',
      message: `${invalidStars.length} 个项目 Stars 格式无效`,
      details: invalidStars.slice(0, 10),
      fixCommand: '手动修复 Stars 格式为数字或 Xk 格式'
    };
  }

  return {
    name: 'stars-format',
    status: 'pass',
    message: `${files.length} 个项目 Stars 格式正确`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查领域分类是否有效
 */
async function checkDomainValid(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'domain-valid',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const invalidDomains = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const isNewFormat = content.includes('## 📊 基本信息');

    // 提取领域分类
    const domainStr = extractField(content, '领域分类', isNewFormat);
    if (domainStr) {
      const domains = domainStr.trim().toLowerCase().split(/[,，]/).map(d => d.trim()).filter(d => d);
      const invalidDomainList = domains.filter(d => !VALID_DOMAINS.includes(d));
      if (invalidDomainList.length > 0) {
        invalidDomains.push({
          file: `wiki/projects/${file}`,
          value: domainStr.trim(),
          reason: `无效领域：${invalidDomainList.join(', ')}，有效列表：${VALID_DOMAINS.join(', ')}`
        });
      }
    } else {
      invalidDomains.push({
        file: `wiki/projects/${file}`,
        value: '(缺失)',
        reason: '领域分类字段缺失'
      });
    }
  }

  if (invalidDomains.length > 0) {
    return {
      name: 'domain-valid',
      status: 'warning',
      message: `${invalidDomains.length} 个项目领域分类无效`,
      details: invalidDomains.slice(0, 10),
      fixCommand: '运行领域 Wiki 后处理或手动修复'
    };
  }

  return {
    name: 'domain-valid',
    status: 'pass',
    message: `${files.length} 个项目领域分类有效`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查日期格式是否为 YYYY-MM-DD
 */
async function checkDateFormat(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'date-format',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const invalidDates = [];
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const isNewFormat = content.includes('## 📊 基本信息');

    // 提取日期字段
    const dateFieldNames = ['首次上榜', '最近上榜'];

    for (const fieldName of dateFieldNames) {
      const dateStr = extractField(content, fieldName, isNewFormat);
      if (dateStr) {
        if (!dateRegex.test(dateStr)) {
          invalidDates.push({
            file: `wiki/projects/${file}`,
            field: fieldName,
            value: dateStr,
            reason: '日期格式不是 YYYY-MM-DD'
          });
        }
      }
    }

    // 检查版本历史中的日期
    const versionDates = content.match(/### (\d{4}-\d{2}-\d{2})/g) || [];
    for (const dateStr of versionDates) {
      const date = dateStr.replace('### ', '');
      if (!dateRegex.test(date)) {
        invalidDates.push({
          file: `wiki/projects/${file}`,
          field: '版本历史',
          value: date,
          reason: '版本历史日期格式错误'
        });
      }
    }
  }

  if (invalidDates.length > 0) {
    return {
      name: 'date-format',
      status: 'warning',
      message: `${invalidDates.length} 个日期格式无效`,
      details: invalidDates.slice(0, 10),
      fixCommand: '手动修复日期格式'
    };
  }

  return {
    name: 'date-format',
    status: 'pass',
    message: `${files.length} 个项目日期格式正确`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查是否有重复的版本记录
 */
async function checkNoDuplicateVersions(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'no-duplicate-versions',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const duplicates = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 提取所有版本条目
    const versionRegex = /### (\d{4}-\d{2}-\d{2})（([^)]+)）/g;
    const matches = [...content.matchAll(versionRegex)];
    const seen = new Map();
    const fileDuplicates = [];

    for (const match of matches) {
      const key = `${match[1]}-${match[2]}`; // date-eventType
      if (seen.has(key)) {
        fileDuplicates.push({
          date: match[1],
          eventType: match[2],
          duplicateIndex: seen.get(key)
        });
      } else {
        seen.set(key, matches.indexOf(match));
      }
    }

    if (fileDuplicates.length > 0) {
      duplicates.push({
        file: `wiki/projects/${file}`,
        duplicates: fileDuplicates
      });
    }
  }

  if (duplicates.length > 0) {
    return {
      name: 'no-duplicate-versions',
      status: 'warning',
      message: `${duplicates.length} 个项目有重复版本记录`,
      details: duplicates.slice(0, 10),
      fixCommand: 'node scripts/clean-wiki-duplicates.js'
    };
  }

  return {
    name: 'no-duplicate-versions',
    status: 'pass',
    message: `${files.length} 个项目无重复版本记录`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查核心功能是否为空
 */
async function checkCoreFunctionsNotEmpty(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'core-functions-not-empty',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const emptyCoreFunctions = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const isNewFormat = content.includes('## 📊 基本信息');

    // 提取核心功能章节内容
    const sectionTitle = isNewFormat ? '## ✨ 核心功能' : '## 核心功能';
    const sectionRegex = new RegExp(sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n([\\s\\S]*?)(?=\\n## )');
    const sectionMatch = content.match(sectionRegex);
    if (sectionMatch) {
      const sectionContent = sectionMatch[1].trim();
      // 检查是否有列表项
      const hasListItems = /^-\s+/m.test(sectionContent);
      if (!hasListItems || sectionContent === '') {
        emptyCoreFunctions.push({
          file: `wiki/projects/${file}`,
          reason: '核心功能章节为空或没有列表项'
        });
      }
    }
  }

  const passRate = ((files.length - emptyCoreFunctions.length) / files.length * 100).toFixed(0);

  if (emptyCoreFunctions.length > 0) {
    return {
      name: 'core-functions-not-empty',
      status: 'warning',
      message: `${emptyCoreFunctions.length} 个项目核心功能为空 (完整率 ${passRate}%)`,
      details: emptyCoreFunctions.slice(0, 10),
      fixCommand: '重新运行 AI 分析或手动补充'
    };
  }

  return {
    name: 'core-functions-not-empty',
    status: 'pass',
    message: `${files.length} 个项目核心功能完整`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查 Stars 数据新鲜度
 */
async function checkStarsUpToDate(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'stars-up-to-date',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const staleData = [];
  const today = new Date().toISOString().split('T')[0];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const isNewFormat = content.includes('## 📊 基本信息');

    // 提取最近上榜日期
    const lastSeen = extractField(content, '最近上榜', isNewFormat);
    // 提取 Stars 更新日期
    let starsDate = null;
    const starsDateMatch = content.match(/（最后更新：(\d{4}-\d{2}-\d{2})）/);
    if (starsDateMatch) {
      starsDate = starsDateMatch[1];
    }

    if (lastSeen && starsDate) {
      // 计算日期差异
      const lastSeenDate = new Date(lastSeen);
      const starsUpdateDate = new Date(starsDate);
      const diffDays = Math.floor((lastSeenDate - starsUpdateDate) / (1000 * 60 * 60 * 24));

      // 如果 Stars 更新日期早于最近上榜日期超过 7 天，认为数据过期
      if (diffDays > 7) {
        staleData.push({
          file: `wiki/projects/${file}`,
          lastSeen: lastSeen,
          starsDate: starsDate,
          daysDiff: diffDays
        });
      }
    }
  }

  const passRate = ((files.length - staleData.length) / files.length * 100).toFixed(0);

  if (staleData.length > 0) {
    return {
      name: 'stars-up-to-date',
      status: 'warning',
      message: `${staleData.length} 个项目 Stars 数据过期 (新鲜率 ${passRate}%)`,
      details: staleData.slice(0, 10),
      fixCommand: '重新运行报告生成工作流刷新数据'
    };
  }

  return {
    name: 'stars-up-to-date',
    status: 'pass',
    message: `${files.length} 个项目 Stars 数据新鲜`,
    details: [],
    fixCommand: null
  };
}

module.exports = {
  checkStarsFormat,
  checkDomainValid,
  checkDateFormat,
  checkNoDuplicateVersions,
  checkCoreFunctionsNotEmpty,
  checkStarsUpToDate
};
