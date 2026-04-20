const fs = require('fs');
const path = require('path');

const projectsDir = path.join(__dirname, '../wiki/projects');
const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));

const projects = [];

files.forEach(file => {
  // 跳过特殊文件
  if (file === '.gitkeep') return;
  
  // 提取owner和repo
  const nameWithoutExt = file.replace('.md', '');
  const parts = nameWithoutExt.split('_');
  
  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts.slice(1).join('_');
    
    projects.push({
      file: file,
      owner: owner,
      repo: repo,
      path: path.join(projectsDir, file)
    });
  } else {
    console.log(`Warning: Invalid filename format: ${file}`);
  }
});

console.log(JSON.stringify(projects, null, 2));
