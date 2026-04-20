const fs = require('fs');
const path = require('path');

const projectsDir = path.join(__dirname, '../wiki/projects');
const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));

// 知名项目的基本信息
const knownProjects = {
  'microsoft/BitNet': {
    description: '1位LLM官方推理框架，大幅降低推理成本，突破内存墙与能效瓶颈',
    language: 'Python',
    stars: '38386'
  },
  'anthropics/claude-plugins-official': {
    description: 'Claude Code官方插件目录，生态核心入口',
    language: 'TypeScript',
    stars: '17206'
  },
  'BerriAI/litellm': {
    description: '统一的LLM接口，支持多种大语言模型',
    language: 'Python',
    stars: '15000'
  },
  'PaddlePaddle/PaddleOCR': {
    description: '飞桨OCR文字识别工具，支持多语言识别',
    language: 'Python',
    stars: '40000'
  },
  'rustdesk/rustdesk': {
    description: '开源远程桌面软件，安全可控',
    language: 'Rust',
    stars: '50000'
  }
};

// 修复项目文件
function fixProjectFile(file) {
  const filePath = path.join(projectsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 提取项目名称
  const nameMatch = content.match(/^# (.+)$/m);
  const projectName = nameMatch ? nameMatch[1] : 'Unknown';
  
  // 检查核心功能是否为空
  const coreFunctionsMatch = content.match(/## 核心功能[\s\S]*?(?=\n## )/);
  const hasCoreFunctions = coreFunctionsMatch && coreFunctionsMatch[0].replace('## 核心功能', '').trim() !== '';
  
  // 检查语言是否为Unknown
  const languageMatch = content.match(/- 语言：([^\n]+)/);
  const language = languageMatch ? languageMatch[1].trim() : 'Unknown';
  
  let updatedContent = content;
  let changes = [];
  
  // 更新知名项目的信息
  if (knownProjects[projectName]) {
    const projectInfo = knownProjects[projectName];
    
    // 更新语言
    if (language === 'Unknown') {
      updatedContent = updatedContent.replace(/(- 语言：).+/, `$1 ${projectInfo.language}`);
      changes.push(`更新语言为 ${projectInfo.language}`);
    }
    
    // 更新核心功能
    if (!hasCoreFunctions) {
      const coreFunctions = `- ${projectInfo.description}`;
      updatedContent = updatedContent.replace(/## 核心功能[\s\S]*?(?=\n## )/, `## 核心功能\n\n${coreFunctions}\n`);
      changes.push('添加核心功能描述');
    }
  }
  
  // 为核心功能为空的项目添加默认描述
  if (!hasCoreFunctions && !knownProjects[projectName]) {
    const defaultCoreFunction = `- 参见 [GitHub 仓库](https://github.com/${projectName.replace('/', '/')})`;
    updatedContent = updatedContent.replace(/## 核心功能[\s\S]*?(?=\n## )/, `## 核心功能\n\n${defaultCoreFunction}\n`);
    changes.push('添加默认核心功能描述');
  }
  
  // 保存更新
  if (changes.length > 0) {
    fs.writeFileSync(filePath, updatedContent, 'utf-8');
    console.log(`更新 ${projectName} (${file}): ${changes.join(', ')}`);
  }
  
  return changes.length > 0;
}

// 主函数
function main() {
  console.log('开始更新Wiki项目...');
  console.log(`共 ${files.length} 个项目文件`);
  
  let updatedCount = 0;
  
  files.forEach(file => {
    try {
      const updated = fixProjectFile(file);
      if (updated) {
        updatedCount++;
      }
    } catch (error) {
      console.error(`更新 ${file} 时出错:`, error.message);
    }
  });
  
  console.log(`\n完成！`);
  console.log(`更新了 ${updatedCount} 个项目文件`);
}

// 运行
main();
