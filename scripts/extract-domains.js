const fs = require('fs');
const path = require('path');

// 读取所有项目文件并提取领域分类
function extractDomains() {
  const projectsDir = path.join(__dirname, '../wiki/projects');
  const files = fs.readdirSync(projectsDir);
  
  const domains = new Set();
  
  files.forEach(file => {
    if (file.endsWith('.md') && file !== '.gitkeep') {
      const filePath = path.join(projectsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 提取领域分类
      const domainMatch = content.match(/- 领域分类：(.+)/);
      if (domainMatch && domainMatch[1]) {
        const domainStr = domainMatch[1].trim();
        // 分割多个领域
        const domainList = domainStr.split(',').map(d => d.trim());
        domainList.forEach(domain => {
          if (domain) {
            domains.add(domain);
          }
        });
      }
    }
  });
  
  // 转换为数组并排序
  const domainArray = Array.from(domains).sort();
  
  console.log('提取的领域分类:');
  domainArray.forEach(domain => {
    console.log(`- ${domain}`);
  });
  
  console.log(`\n总共有 ${domainArray.length} 个唯一领域`);
  
  // 保存到文件
  const outputPath = path.join(__dirname, '../wiki/domains.md');
  const outputContent = `# Wiki 领域分类\n\n## 所有领域\n\n${domainArray.map(domain => `- ${domain}`).join('\n')}\n\n## 更新时间\n${new Date().toISOString().split('T')[0]}`;
  
  fs.writeFileSync(outputPath, outputContent);
  console.log(`\n领域分类已保存到 ${outputPath}`);
  
  return domainArray;
}

// 执行提取
const domains = extractDomains();
