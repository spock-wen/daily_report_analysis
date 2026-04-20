const fs = require('fs');
const path = require('path');
const https = require('https');

// 读取项目列表
const projects = JSON.parse(fs.readFileSync('projects.json', 'utf-8'));

// 存储结果
const results = [];
const notFound = [];
const errors = [];

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 获取GitHub项目信息
async function fetchGitHubInfo(owner, repo) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}`,
      method: 'GET',
      headers: {
        'User-Agent': 'GitHub Wiki Updater',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000 // 10秒超时
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
          resolve(null); // 项目不存在
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

// 处理单个项目
async function processProject(project, index, total) {
  console.log(`处理 ${index + 1}/${total}: ${project.owner}/${project.repo}`);
  
  try {
    const repoData = await fetchGitHubInfo(project.owner, project.repo);
    
    if (repoData) {
      results.push({
        file: project.file,
        owner: project.owner,
        repo: project.repo,
        name: repoData.name,
        description: repoData.description,
        stars: repoData.stargazers_count,
        language: repoData.language,
        created_at: repoData.created_at,
        updated_at: repoData.updated_at
      });
      console.log(`✓ 成功获取 ${project.owner}/${project.repo}`);
    } else {
      notFound.push({
        file: project.file,
        owner: project.owner,
        repo: project.repo
      });
      console.log(`✗ 未找到 ${project.owner}/${project.repo}`);
    }
  } catch (error) {
    console.error(`✗ 获取 ${project.owner}/${project.repo} 失败:`, error.message);
    errors.push({
      file: project.file,
      owner: project.owner,
      repo: project.repo,
      error: error.message
    });
  }
  
  // 避免触发GitHub API速率限制
  await delay(1000);
}

// 主函数
async function main() {
  console.log('开始获取GitHub项目信息...');
  console.log(`共 ${projects.length} 个项目`);
  
  for (let i = 0; i < projects.length; i++) {
    await processProject(projects[i], i, projects.length);
  }
  
  // 保存结果
  fs.writeFileSync('github-results.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('github-not-found.json', JSON.stringify(notFound, null, 2));
  fs.writeFileSync('github-errors.json', JSON.stringify(errors, null, 2));
  
  console.log('\n完成！');
  console.log(`成功获取 ${results.length} 个项目的信息`);
  console.log(`未找到 ${notFound.length} 个项目`);
  console.log(`错误 ${errors.length} 个项目`);
}

// 运行
main();
