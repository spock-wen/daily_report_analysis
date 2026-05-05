
const fs = require('fs');
const path = require('path');

const wikiDir = path.join(__dirname, 'wiki', 'projects');
const files = fs.readdirSync(wikiDir).filter(f => f.endsWith('.md'));

// VALID_DOMAINS from the check script
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

const issues = {
  domainIssues: [],
  missingSections: [],
  missingBasicInfo: [],
  invalidRefs: []
};

const requiredSections = ['## 基本信息', '## 核心功能', '## 版本历史'];
const requiredFields = [
  { name: '首次上榜', regex: /- 首次上榜：/ },
  { name: '最近上榜', regex: /- 最近上榜：/ },
  { name: '上榜次数', regex: /- 上榜次数：/ },
  { name: '领域分类', regex: /- 领域分类：/ },
  { name: '语言', regex: /- 语言：/ },
  { name: 'GitHub Stars', regex: /- GitHub Stars:/ }
];

// First, collect all existing projects
const existingProjects = new Set();
for (const file of files) {
  const match = file.match(/^(.+)_(.+)\.md$/);
  if (match) {
    existingProjects.add(`${match[1]}/${match[2]}`.toLowerCase());
  }
}

for (const file of files) {
  const filePath = path.join(wikiDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Check required sections
  const missingSec = requiredSections.filter(sec => !content.includes(sec));
  if (missingSec.length > 0) {
    issues.missingSections.push({ file, missing: missingSec });
  }
  
  // Check domain validity
  const domainMatch = content.match(/- 领域分类：([^\n]+)/);
  if (domainMatch) {
    const domainStr = domainMatch[1].trim();
    const domains = domainStr.toLowerCase().split(/[,，]/).map(d => d.trim()).filter(d => d);
    const invalidDomains = domains.filter(d => !VALID_DOMAINS.includes(d));
    if (invalidDomains.length > 0) {
      issues.domainIssues.push({ 
        file, 
        domainStr, 
        invalidDomains, 
        allDomains: domains 
      });
    }
  } else {
    issues.domainIssues.push({ file, domainStr: '(missing)', invalidDomains: [], allDomains: [] });
  }
  
  // Check basic info completeness
  const missingFields = requiredFields
    .filter(field => !field.regex.test(content))
    .map(field => field.name);
  if (missingFields.length > 0) {
    issues.missingBasicInfo.push({ file, missing: missingFields });
  }
  
  // Check cross references
  const crossRefSection = content.match(/## 跨项目关联\n([\s\S]*?)(?:\n##|$)/);
  if (crossRefSection) {
    const section = crossRefSection[1];
    const repoRefs = section.match(/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/g) || [];
    for (const ref of repoRefs) {
      if (!existingProjects.has(ref.toLowerCase())) {
        issues.invalidRefs.push({ file, ref });
      }
    }
  }
}

console.log('=== DOMAIN ISSUES ===');
console.log(`Total: ${issues.domainIssues.length}`);
issues.domainIssues.slice(0, 10).forEach(issue => {
  console.log(`${issue.file}: ${issue.domainStr}`);
  if (issue.invalidDomains.length > 0) {
    console.log(`  Invalid: ${issue.invalidDomains.join(', ')}`);
  }
});
console.log();

console.log('=== MISSING SECTIONS ===');
console.log(`Total: ${issues.missingSections.length}`);
issues.missingSections.slice(0, 10).forEach(issue => {
  console.log(`${issue.file}: ${issue.missing.join(', ')}`);
});
console.log();

console.log('=== MISSING BASIC INFO ===');
console.log(`Total: ${issues.missingBasicInfo.length}`);
issues.missingBasicInfo.slice(0, 10).forEach(issue => {
  console.log(`${issue.file}: ${issue.missing.join(', ')}`);
});
console.log();

console.log('=== INVALID REFERENCES ===');
console.log(`Total: ${issues.invalidRefs.length}`);
issues.invalidRefs.forEach(issue => {
  console.log(`${issue.file}: ${issue.ref}`);
});
console.log();

// Let's look at one problematic file in detail
console.log('=== EXAMPLE PROBLEMATIC FILE ===');
if (issues.domainIssues.length > 0) {
  const exampleFile = issues.domainIssues[0].file;
  const examplePath = path.join(wikiDir, exampleFile);
  console.log(fs.readFileSync(examplePath, 'utf-8'));
}
