const https = require('https');

// 要检查的项目列表
const projects = [
  { owner: 'addyosmani', repo: 'agent-skills', file: 'addyosmani_agent-skills.md' },
  { owner: 'affaan-m', repo: 'everything-claude-code', file: 'affaan-m_everything-claude-code.md' },
  { owner: 'agentscope-ai', repo: 'ReMe', file: 'agentscope-ai_ReMe.md' },
  { owner: 'alibaba', repo: 'OpenSandbox', file: 'alibaba_OpenSandbox.md' }
];

// 检查单个项目
async function checkProject(owner, repo) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}`,
      method: 'GET',
      headers: {
        'User-Agent': 'GitHub Wiki Updater',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const repoData = JSON.parse(data);
            resolve(repoData);
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// 主函数
async function main() {
  console.log('开始批量检查项目...');
  
  for (const project of projects) {
    console.log(`\n检查项目: ${project.owner}/${project.repo}`);
    console.log(`文件: ${project.file}`);
    
    try {
      const repoData = await checkProject(project.owner, project.repo);
      
      if (repoData) {
        console.log('✅ 项目存在!');
        console.log(`名称: ${repoData.name}`);
        console.log(`描述: ${repoData.description || '无'}`);
        console.log(`语言: ${repoData.language || 'Unknown'}`);
        console.log(`Stars: ${repoData.stargazers_count}`);
        console.log(`创建时间: ${repoData.created_at}`);
        console.log(`更新时间: ${repoData.updated_at}`);
      } else {
        console.log('❌ 项目不存在!');
      }
    } catch (error) {
      console.log(`❌ 检查失败: ${error.message}`);
    }
  }
  
  console.log('\n批量检查完成!');
}

// 运行
main();
