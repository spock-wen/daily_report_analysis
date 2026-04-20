const https = require('https');

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
      timeout: 10000
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
  const owner = 'aaddrick';
  const repo = 'claude-desktop-debian';
  
  console.log(`检查项目: ${owner}/${repo}`);
  
  try {
    const repoData = await checkProject(owner, repo);
    
    if (repoData) {
      console.log('项目存在!');
      console.log(`名称: ${repoData.name}`);
      console.log(`描述: ${repoData.description}`);
      console.log(`语言: ${repoData.language}`);
      console.log(`Stars: ${repoData.stargazers_count}`);
      console.log(`创建时间: ${repoData.created_at}`);
      console.log(`更新时间: ${repoData.updated_at}`);
    } else {
      console.log('项目不存在!');
    }
  } catch (error) {
    console.error('检查失败:', error.message);
  }
}

// 运行
main();
