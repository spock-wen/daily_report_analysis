const fs = require('fs');
const path = require('path');

const projectsDir = path.join(__dirname, '../wiki/projects');
const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));

// 分析结果
const analysis = {
  total: files.length,
  realProjects: [],
  testProjects: [],
  abstractProjects: [],
  emptyCoreFunctions: [],
  lowQuality: []
};

// 测试项目关键词
const testKeywords = ['test', 'example', 'demo', 'sample', 'owner/repo'];

// 抽象概念关键词
const abstractKeywords = ['CI/CD', 'Markdown/PDF', 'TypeScript/Python'];

// 分析单个项目
function analyzeProject(file) {
  const filePath = path.join(projectsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 提取基本信息
  const nameMatch = content.match(/^# (.+)$/m);
  const name = nameMatch ? nameMatch[1] : 'Unknown';
  
  const starsMatch = content.match(/- GitHub Stars:[^\n]+/);
  let stars = '0';
  if (starsMatch) {
    stars = starsMatch[0].replace('- GitHub Stars:', '').trim().replace(/（.*）/, '').trim();
  }
  
  const languageMatch = content.match(/- 语言：[^\n]+/);
  let language = 'Unknown';
  if (languageMatch) {
    language = languageMatch[0].replace('- 语言：', '').trim();
  }
  
  const domainMatch = content.match(/- 领域分类：[^\n]+/);
  let domain = 'Unknown';
  if (domainMatch) {
    domain = domainMatch[0].replace('- 领域分类：', '').trim();
  }
  
  // 检查核心功能是否为空
  const coreFunctionsMatch = content.match(/## 核心功能[\s\S]*?(?=\n## )/);
  const hasCoreFunctions = coreFunctionsMatch && coreFunctionsMatch[0].replace('## 核心功能', '').trim() !== '';
  
  // 检查版本历史是否为空
  const versionHistoryMatch = content.match(/## 版本历史[\s\S]*?(?=\n## |$)/);
  const hasVersionHistory = versionHistoryMatch && versionHistoryMatch[0].replace('## 版本历史', '').trim() !== '';
  
  // 分析项目类型
  let projectType = 'real';
  let issues = [];
  
  // 检查是否是测试项目
  if (testKeywords.some(keyword => name.toLowerCase().includes(keyword)) || 
      content.toLowerCase().includes('test repo')) {
    projectType = 'test';
    issues.push('测试项目');
  }
  
  // 检查是否是抽象概念
  if (abstractKeywords.some(keyword => name.includes(keyword))) {
    projectType = 'abstract';
    issues.push('抽象概念');
  }
  
  // 检查核心功能是否为空
  if (!hasCoreFunctions) {
    analysis.emptyCoreFunctions.push(name);
    issues.push('核心功能为空');
  }
  
  // 检查版本历史是否为空
  if (!hasVersionHistory) {
    issues.push('版本历史为空');
  }
  
  // 检查语言是否为Unknown
  if (language === 'Unknown') {
    issues.push('语言未知');
  }
  
  // 检查Stars是否为0
  if (stars === '0') {
    issues.push('Stars为0');
  }
  
  // 综合评估质量
  if (issues.length >= 3) {
    analysis.lowQuality.push({ name, issues });
  }
  
  // 分类项目
  analysis[`${projectType}Projects`].push({
    name,
    file,
    stars,
    language,
    domain,
    hasCoreFunctions,
    hasVersionHistory,
    issues
  });
}

// 主函数
function main() {
  console.log('开始分析Wiki项目...');
  console.log(`共 ${files.length} 个项目文件`);
  
  files.forEach(file => {
    try {
      analyzeProject(file);
    } catch (error) {
      console.error(`分析 ${file} 时出错:`, error.message);
    }
  });
  
  // 输出结果
  console.log('\n分析结果:');
  console.log(`总项目数: ${analysis.total}`);
  console.log(`真实项目: ${analysis.realProjects.length}`);
  console.log(`测试项目: ${analysis.testProjects.length}`);
  console.log(`抽象概念: ${analysis.abstractProjects.length}`);
  console.log(`核心功能为空: ${analysis.emptyCoreFunctions.length}`);
  console.log(`低质量项目: ${analysis.lowQuality.length}`);
  
  // 输出详细信息
  console.log('\n测试项目:');
  analysis.testProjects.forEach(project => {
    console.log(`- ${project.name} (${project.file})`);
  });
  
  console.log('\n抽象概念:');
  analysis.abstractProjects.forEach(project => {
    console.log(`- ${project.name} (${project.file})`);
  });
  
  console.log('\n低质量项目:');
  analysis.lowQuality.forEach(project => {
    console.log(`- ${project.name} (${project.file}): ${project.issues.join(', ')}`);
  });
  
  // 保存结果
  fs.writeFileSync('wiki-analysis.json', JSON.stringify(analysis, null, 2));
  console.log('\n分析结果已保存到 wiki-analysis.json');
}

// 运行
main();
