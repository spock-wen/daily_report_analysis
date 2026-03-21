const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch;

const GITHUB_API_BASE = 'https://api.github.com';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchRepoDetails(repo, token = null) {
  const url = `${GITHUB_API_BASE}/repos/${repo}`;

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Brief-System'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API 速率限制已达，请设置 GITHUB_TOKEN 环境变量');
      }
      throw new Error(`GitHub API 返回错误：${response.status}`);
    }

    const data = await response.json();

    return {
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      language: data.language,

      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      open_issues: data.open_issues_count,

      created_at: data.created_at,
      updated_at: data.updated_at,
      pushed_at: data.pushed_at,

      subscribers_count: data.subscribers_count,
      has_issues: data.has_issues,
      has_wiki: data.has_wiki,
      has_pages: data.has_pages,
      has_discussions: data.has_discussions,

      license: data.license ? data.license.name : null,

      homepage: data.homepage,
      topics: data.topics || [],
      is_fork: data.fork,
      is_archived: data.archived,
      is_disabled: data.disabled,
      default_branch: data.default_branch
    };
  } catch (error) {
    console.error(`获取 ${repo} 详细信息失败:`, error.message);
    return null;
  }
}

async function fetchCommitStats(repo, token = null) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Brief-System'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    const url = `${GITHUB_API_BASE}/repos/${repo}/commits?since=${since}&per_page=1`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return null;
    }

    const linkHeader = response.headers.get('link');
    let commitCount = 0;

    if (linkHeader) {
      const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
      if (match) {
        commitCount = parseInt(match[1], 10);
      }
    }

    const contributorsUrl = `${GITHUB_API_BASE}/repos/${repo}/contributors?per_page=1`;
    const contributorsResponse = await fetch(contributorsUrl, { headers });

    let contributorsCount = 0;
    if (contributorsResponse.ok) {
      const contributorsLink = contributorsResponse.headers.get('link');
      if (contributorsLink) {
        const match = contributorsLink.match(/&page=(\d+)>; rel="last"/);
        if (match) {
          contributorsCount = parseInt(match[1], 10);
        }
      }
    }

    return {
      commits_last_30_days: commitCount,
      contributors_count: contributorsCount
    };
  } catch (error) {
    console.error(`获取 ${repo} Commits 统计失败:`, error.message);
    return null;
  }
}

async function enhanceProjects(projects, token = null) {
  const enhanced = [];

  for (const project of projects) {
    try {
      console.log(`📡 获取 ${project.repo} 详细信息...`);

      const details = await fetchRepoDetails(project.repo, token);

      if (details) {
        enhanced.push({
          ...project,
          ...details,

          update_time: formatTime(details.updated_at),
          created_time: formatTime(details.created_at),

          has_api_data: true
        });
      } else {
        enhanced.push({
          ...project,
          has_api_data: false
        });
      }

      if (token) {
        await sleep(100);
      } else {
        await sleep(1000);
      }

    } catch (error) {
      console.error(`处理 ${project.repo} 失败:`, error.message);
      enhanced.push({
        ...project,
        has_api_data: false
      });
    }
  }

  return enhanced;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function generateDetailedReport(project) {
  if (!project.has_api_data) {
    return null;
  }

  const report = {
    name: project.full_name,
    description: project.description || project.desc,
    language: project.language || project.language,
    homepage: project.homepage,
    topics: project.topics,

    stars: formatNumber(project.stars),
    forks: formatNumber(project.forks),
    watchers: formatNumber(project.watchers),
    open_issues: project.open_issues,

    created_at: project.created_time,
    updated_at: project.update_time,
    pushed_at: formatTime(project.pushed_at),

    subscribers: project.subscribers_count,
    has_issues: project.has_issues,
    has_wiki: project.has_wiki,
    has_discussions: project.has_discussions,

    license: project.license,

    is_archived: project.is_archived,
    is_fork: project.is_fork,
    default_branch: project.default_branch
  };

  return report;
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = {
  fetchRepoDetails,
  fetchCommitStats,
  enhanceProjects,
  generateDetailedReport,
  formatTime,
  formatNumber
};
