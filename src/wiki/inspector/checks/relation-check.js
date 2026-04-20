/**
 * 关联性检查
 * 检查 Wiki 之间的关联关系和领域分布
 */

const fs = require('fs');
const path = require('path');

// 有效的领域分类列表
const VALID_DOMAINS = [
  'agent', 'ai-agent', 'ai-infrastructure', 'ai-tools', 'ai',
  'android', 'browser', 'cloud', 'coding-agent',
  'containerization', 'dev-tool', 'developer-tools',
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
 * 检查每个领域是否有项目
 */
async function checkDomainProjectsCount(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  const domainsDir = path.join(wikiDir, 'domains');

  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'domain-projects-count',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const domainMap = new Map();

  // 统计各领域项目数
  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const domainMatch = content.match(/- 领域分类：([^\n]+)/);
    if (domainMatch) {
      const domains = domainMatch[1].trim().toLowerCase().split(/[,，]/).map(d => d.trim()).filter(d => d);
      for (const domain of domains) {
        domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
      }
    }
  }

  // 检查有项目的领域
  const domainsWithProjects = Array.from(domainMap.keys());
  const emptyDomains = VALID_DOMAINS.filter(d => !domainMap.has(d));

  return {
    name: 'domain-projects-count',
    status: 'pass',
    message: `${domainsWithProjects.length} 个领域有项目，共 ${files.length} 个项目`,
    details: Array.from(domainMap.entries()).map(([domain, count]) => ({
      domain,
      count
    })),
    fixCommand: null
  };
}

/**
 * 检查是否有孤立项目（无领域分类）
 */
async function checkOrphanProjects(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'orphan-projects',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const orphanProjects = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const domainMatch = content.match(/- 领域分类：([^\n]+)/);
    if (!domainMatch) {
      orphanProjects.push({
        file: `wiki/projects/${file}`,
        reason: '缺少领域分类字段'
      });
    }
  }

  if (orphanProjects.length > 0) {
    return {
      name: 'orphan-projects',
      status: 'warning',
      message: `${orphanProjects.length} 个项目没有领域分类`,
      details: orphanProjects.slice(0, 10),
      fixCommand: '运行 Wiki 后处理或手动添加领域分类'
    };
  }

  return {
    name: 'orphan-projects',
    status: 'pass',
    message: `${files.length} 个项目都有领域分类`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查跨项目引用的目标是否存在
 */
async function checkCrossReferenceValid(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'cross-reference-valid',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const existingProjects = new Set();

  // 收集所有存在的项目
  for (const file of files) {
    const match = file.match(/^(.+)_(.+)\.md$/);
    if (match) {
      existingProjects.add(`${match[1]}/${match[2]}`.toLowerCase());
    }
  }

  const invalidRefs = [];

  // 检查每个文件的引用
  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 提取跨项目关联章节中的引用
    const crossRefSection = content.match(/## 跨项目关联\n([\s\S]*?)(?:\n##|$)/);
    if (crossRefSection) {
      const section = crossRefSection[1];
      // 提取 owner/repo 格式的引用
      const repoRefs = section.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/g) || [];

      for (const ref of repoRefs) {
        if (!existingProjects.has(ref.toLowerCase())) {
          invalidRefs.push({
            file: `wiki/projects/${file}`,
            invalidRef: ref,
            reason: '引用的项目不存在'
          });
        }
      }
    }
  }

  if (invalidRefs.length > 0) {
    return {
      name: 'cross-reference-valid',
      status: 'warning',
      message: `${invalidRefs.length} 个跨项目引用无效`,
      details: invalidRefs.slice(0, 10),
      fixCommand: '清理无效引用或检查项目名称是否正确'
    };
  }

  return {
    name: 'cross-reference-valid',
    status: 'pass',
    message: '所有跨项目引用有效',
    details: [],
    fixCommand: null
  };
}

/**
 * 检查领域 Wiki 文件是否存在
 */
async function checkDomainWikiExists(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  const domainsDir = path.join(wikiDir, 'domains');

  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'domain-wiki-exists',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  // 收集所有有项目的领域
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const domainsWithProjects = new Set();

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const domainMatch = content.match(/- 领域分类：([^\n]+)/);
    if (domainMatch) {
      const domains = domainMatch[1].trim().toLowerCase().split(/[,，]/).map(d => d.trim()).filter(d => d);
      for (const domain of domains) {
        domainsWithProjects.add(domain);
      }
    }
  }

  // 检查领域 Wiki 文件
  const missingDomainWikis = [];

  if (fs.existsSync(domainsDir)) {
    const domainFiles = fs.readdirSync(domainsDir).filter(f => f.endsWith('.md'));
    const existingDomainWikis = new Set(
      domainFiles.map(f => f.replace('.md', '').toLowerCase())
    );

    for (const domain of domainsWithProjects) {
      if (!existingDomainWikis.has(domain)) {
        missingDomainWikis.push({
          domain: domain,
          reason: `缺少 wiki/domains/${domain}.md`
        });
      }
    }
  } else {
    // domains 目录不存在
    for (const domain of domainsWithProjects) {
      missingDomainWikis.push({
        domain: domain,
        reason: 'domains 目录不存在'
      });
    }
  }

  if (missingDomainWikis.length > 0) {
    return {
      name: 'domain-wiki-exists',
      status: 'warning',
      message: `${missingDomainWikis.length} 个领域缺少领域 Wiki 文件`,
      details: missingDomainWikis.slice(0, 10),
      fixCommand: 'node scripts/generate-wiki-index.js 或运行 Wiki 后处理'
    };
  }

  return {
    name: 'domain-wiki-exists',
    status: 'pass',
    message: `${domainsWithProjects.size} 个领域的 Wiki 文件都存在`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查项目基本信息完整性
 */
async function checkBasicInfoCompleteness(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'basic-info-completeness',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const requiredFields = [
    { name: '首次上榜', regex: /- 首次上榜：/ },
    { name: '最近上榜', regex: /- 最近上榜：/ },
    { name: '上榜次数', regex: /- 上榜次数：/ },
    { name: '领域分类', regex: /- 领域分类：/ },
    { name: '语言', regex: /- 语言：/ },
    { name: 'GitHub Stars', regex: /- GitHub Stars:/ }
  ];

  const incompleteProjects = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const missing = requiredFields
      .filter(field => !field.regex.test(content))
      .map(field => field.name);

    if (missing.length > 0) {
      incompleteProjects.push({
        file: `wiki/projects/${file}`,
        missing
      });
    }
  }

  if (incompleteProjects.length > 0) {
    return {
      name: 'basic-info-completeness',
      status: 'warning',
      message: `${incompleteProjects.length} 个项目基本信息不完整`,
      details: incompleteProjects.slice(0, 10),
      fixCommand: '重新运行报告生成或手动补充缺失字段'
    };
  }

  return {
    name: 'basic-info-completeness',
    status: 'pass',
    message: `${files.length} 个项目基本信息完整`,
    details: [],
    fixCommand: null
  };
}

module.exports = {
  checkDomainProjectsCount,
  checkOrphanProjects,
  checkCrossReferenceValid,
  checkDomainWikiExists,
  checkBasicInfoCompleteness
};
