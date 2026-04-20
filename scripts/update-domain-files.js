const fs = require('fs');
const path = require('path');

// 读取所有项目文件并提取项目信息和领域分类
function extractProjectInfo() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const projects = [];
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取项目名称
      const nameMatch = content.match(/^# (.+)/);
      if (!nameMatch) return;
      const projectName = nameMatch[1].trim();
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      if (!domainMatch) return;
      const domainStr = domainMatch[1].trim();
      const domains = domainStr.split(',').map(d => d.trim());
      
      // 提取首次上榜时间
      const first上榜Match = content.match(/- 首次上榜：(.+)/);
      const first上榜 = first上榜Match ? first上榜Match[1].trim() : '未知';
      
      // 提取上榜次数
      const 上榜次数Match = content.match(/- 上榜次数：(.+)/);
      const 上榜次数 = 上榜次数Match ? parseInt(上榜次数Match[1].trim()) : 0;
      
      // 提取GitHub Stars
      const starsMatch = content.match(/- GitHub Stars: (.+)/);
      let stars = 0;
      if (starsMatch) {
        const starsStr = starsMatch[1].trim();
        const numMatch = starsStr.match(/\d+/);
        if (numMatch) {
          stars = parseInt(numMatch[0]);
        }
      }
      
      projects.push({
        name: projectName,
        file: file,
        domains: domains,
        first上榜: first上榜,
        上榜次数: 上榜次数,
        stars: stars
      });
    }
  });
  
  return projects;
}

// 按领域分组项目
function groupProjectsByDomain(projects) {
  const domainGroups = {};
  
  projects.forEach(project => {
    project.domains.forEach(domain => {
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(project);
    });
  });
  
  return domainGroups;
}

// 获取领域的emoji
function getDomainEmoji(domain) {
  const emojiMap = {
    'AI Agent': '🤖',
    'AI Infrastructure': '🏗️',
    'AI Tools': '🛠️',
    'Cloud': '☁️',
    'Coding Agent': '💻',
    'Containerization': '📦',
    'Developer Tools': '🔧',
    'Development Tools': '🛠️',
    'Framework': '🏗️',
    'General': '🌐',
    'Generative AI': '✨',
    'LLM Applications': '🧠',
    'Machine Learning': '🤖',
    'Memory Management': '💾',
    'Multi-Agent Collaboration': '🤝',
    'Performance Optimization': '⚡',
    'Plugins': '🔌',
    'RAG': '📚',
    'Sandbox': '🏖️',
    'Software Development': '💻',
    'Vertex AI': '🔺',
    'agent': '🤖',
    'browser': '🌐',
    'dev-tool': '🛠️',
    'general': '🌐',
    'llm': '🧠',
    'other': '📦',
    'rag': '📚',
    'speech': '🗣️',
    'vision': '👁️'
  };
  
  return emojiMap[domain] || '📦';
}

// 生成领域md文件内容
function generateDomainContent(domain, projects) {
  // 按上榜次数排序，相同上榜次数按stars排序
  const sortedProjects = projects.sort((a, b) => {
    if (b.上榜次数 !== a.上榜次数) {
      return b.上榜次数 - a.上榜次数;
    }
    return b.stars - a.stars;
  });
  
  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const avg上榜次数 = (projects.reduce((sum, p) => sum + p.上榜次数, 0) / projects.length).toFixed(1);
  const hottestProject = projects.reduce((max, p) => p.stars > max.stars ? p : max, projects[0]);
  
  const tableRows = sortedProjects.map((project, index) => {
    return `| ${index + 1} | [${project.name}](../../wiki/projects/${project.file}) | ${project.first上榜} | ${project.上榜次数} | ${project.stars} |`;
  }).join('\n');
  
  const content = `# ${getDomainEmoji(domain)} ${domain} 领域

## 领域概览

- 项目总数：${projects.length}
- 最近更新：${new Date().toISOString().split('T')[0]}
- 报告类型：weekly

${domain} 领域收录了与${domain}相关的项目。

## 代表项目（按上榜次数排序）

| 排名 | 项目 | 首次上榜 | 上榜次数 | Stars |
|------|------|----------|----------|-------|
${tableRows}

## 领域趋势


- 平均上榜次数：${avg上榜次数}
- 总 Stars 数：${totalStars.toLocaleString()}
- 最热项目：[${hottestProject.name}](../../wiki/projects/${hottestProject.file}) (${hottestProject.stars.toLocaleString()} ⭐)


---

*本页面由 WikiPostProcessor 自动生成*`;
  
  return content;
}

// 更新领域文件
function updateDomainFiles() {
  const projects = extractProjectInfo();
  const domainGroups = groupProjectsByDomain(projects);
  
  const domainsDir = path.join(__dirname, '../wiki/domains');
  
  // 处理每个领域
  Object.keys(domainGroups).forEach(domain => {
    const domainFile = path.join(domainsDir, `${domain.toLowerCase().replace(/\s+/g, '-')}.md`);
    const content = generateDomainContent(domain, domainGroups[domain]);
    
    fs.writeFileSync(domainFile, content);
    console.log(`已更新领域文件: ${domainFile}`);
  });
  
  console.log(`\n已更新 ${Object.keys(domainGroups).length} 个领域文件`);
}

// 执行更新
updateDomainFiles();
