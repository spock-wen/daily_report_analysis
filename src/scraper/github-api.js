/**
 * GitHub API 集成模块
 * 用于获取仓库详细信息（星星、forks、语言等）
 */

const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch;
const logger = require('../utils/logger');

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * AI 项目关键词列表
 */
const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'machine learning', 'deep learning',
  'neural network', 'nlp', 'natural language processing', 'computer vision',
  'gpt', 'llm', 'large language model', 'transformer', 'bert', 'chatgpt',
  'openai', 'langchain', 'llama', 'stable diffusion', 'midjourney',
  'hugging face', 'huggingface', 'pytorch', 'tensorflow', 'keras',
  'reinforcement learning', 'gan', 'generative', 'embedding', 'vector',
  'rag', 'retrieval augmented', 'fine-tuning', 'finetuning',
  'autogpt', 'agent', 'copilot', 'assistant', 'chatbot',
  'speech recognition', 'text-to-speech', 'tts', 'asr', 'ocr',
  'object detection', 'image generation', 'text generation',
  'prompt', 'inference', 'training', 'model', 'dataset',
  '人工智能', '机器学习', '深度学习', '神经网络', '自然语言处理',
  '计算机视觉', '大模型', '生成式', '智能'
];

/**
 * 检测项目是否为 AI 项目
 * @param {Object} repo - 仓库数据
 * @returns {boolean} 是否为 AI 项目
 */
function detectAIProject(repo) {
  const textToCheck = `${repo.name || ''} ${repo.description || ''} ${repo.language || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  return AI_KEYWORDS.some(keyword => textToCheck.includes(keyword.toLowerCase()));
}

/**
 * 延迟函数，避免 API 限流
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 格式化时间为北京时间
 */
function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

/**
 * 格式化数字（添加千分位分隔符）
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 获取仓库详细信息
 */
async function fetchRepoDetails(repo, token = null) {
  const url = `${GITHUB_API_BASE}/repos/${repo}`;

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Trending-System'
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
      fullName: data.full_name,
      description: data.description || '',
      language: data.language || '',
      homepage: data.homepage || '',
      topics: data.topics || [],

      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,

      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,

      subscribersCount: data.subscribers_count,
      hasIssues: data.has_issues,
      hasWiki: data.has_wiki,
      hasDiscussions: data.has_discussions || false,

      license: data.license ? data.license.name : null,
      isFork: data.fork,
      isArchived: data.archived,
      defaultBranch: data.default_branch
    };
  } catch (error) {
    logger.error(`[GitHubAPI] 获取 ${repo} 详细信息失败：${error.message}`);
    return null;
  }
}

/**
 * 获取最近 30 天的提交统计
 */
async function fetchCommitStats(repo, token = null) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Trending-System'
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
      commitsLast30Days: commitCount,
      contributorsCount: contributorsCount
    };
  } catch (error) {
    logger.error(`[GitHubAPI] 获取 ${repo} 提交统计失败：${error.message}`);
    return null;
  }
}

/**
 * 增强项目数据（添加 GitHub API 详细信息）
 */
async function enhanceRepositories(repositories, token = null) {
  const enhanced = [];

  for (const repo of repositories) {
    try {
      logger.info(`[GitHubAPI] 获取 ${repo.fullName} 详细信息...`);

      const details = await fetchRepoDetails(repo.fullName, token);

      if (details) {
        // 合并数据，保持旧版格式兼容
        const enhancedRepo = {
          // 先展开原始数据
          ...repo,
          // 然后用 API 数据覆盖
          repo: repo.fullName,
          name: repo.name,
          fullName: repo.fullName,
          desc: repo.description || details.description,
          descZh: repo.description || details.description,
          language: repo.language || details.language,
          homepage: details.homepage,
          topics: details.topics,
          
          stars: details.stars,
          forks: details.forks,
          watchers: details.watchers,
          openIssues: details.openIssues,
          
          todayStars: repo.todayStars || '0',
          
          createdAt: details.createdAt,
          updatedAt: details.updatedAt,
          pushedAt: details.pushedAt,
          
          updateTime: formatTime(details.updatedAt),
          createdTime: formatTime(details.createdAt),
          
          subscribersCount: details.subscribersCount,
          hasIssues: details.hasIssues,
          hasWiki: details.hasWiki,
          hasDiscussions: details.hasDiscussions,
          
          license: details.license,
          isFork: details.isFork,
          isArchived: details.isArchived,
          defaultBranch: details.defaultBranch,
          
          hasApiData: true,
          isAI: detectAIProject({ ...repo, ...details }),
          url: repo.url || `https://github.com/${repo.fullName}`
        };

        // 如果有 token，获取提交统计
        if (token) {
          const commitStats = await fetchCommitStats(repo.fullName, token);
          if (commitStats) {
            enhancedRepo.commitsLast30Days = commitStats.commitsLast30Days;
            enhancedRepo.contributorsCount = commitStats.contributorsCount;
          }
          await sleep(100); // 有 token 时快速请求
        } else {
          await sleep(1000); // 无 token 时慢速请求避免限流
        }

        enhanced.push(enhancedRepo);
      } else {
        // API 失败时返回基础数据，但仍进行 AI 检测
        enhanced.push({
          ...repo,
          repo: repo.fullName,
          hasApiData: false,
          isAI: detectAIProject(repo)
        });
      }
    } catch (error) {
      logger.error(`[GitHubAPI] 处理 ${repo.fullName} 失败：${error.message}`);
      enhanced.push({
        ...repo,
        hasApiData: false,
        isAI: detectAIProject(repo)
      });
    }
  }

  return enhanced;
}

module.exports = {
  fetchRepoDetails,
  fetchCommitStats,
  enhanceRepositories,
  formatTime,
  formatNumber
};
