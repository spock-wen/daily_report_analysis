const { isAIProject } = require('./utils');

function getSinceLabel(since) {
  const labels = {
    daily: 'today',
    weekly: 'this week',
    monthly: 'this month'
  };
  return labels[since] || 'today';
}

function cleanHtml(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractNumber(text) {
  if (!text) return 0;
  const cleaned = cleanHtml(text).replace(/,/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

function parseTrending(html, since = 'daily') {
  const projects = [];
  const seen = new Set();

  if (!html || html.length < 1000) {
    throw new Error('HTML 内容无效，长度过短');
  }

  if (!html.includes('github-trending') && !html.includes('Box-row')) {
    throw new Error('HTML 内容不包含 GitHub Trending 特征，页面结构可能已变化');
  }

  console.log('🔍 开始解析 HTML 内容...');

  const sinceLabel = getSinceLabel(since);

  const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;

  while ((articleMatch = articleRegex.exec(html)) !== null) {
    const project = parseArticle(articleMatch[1], sinceLabel);
    if (project && !seen.has(project.repo)) {
      seen.add(project.repo);
      projects.push(project);
    }
  }

  if (projects.length === 0) {
    console.warn('⚠️ 标准解析失败，尝试备用解析方案...');
    const divRegex = /<div[^>]*class="[^"]*f4[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    while ((articleMatch = divRegex.exec(html)) !== null) {
      const project = parseArticle(articleMatch[1], sinceLabel);
      if (project && project.repo && !seen.has(project.repo)) {
        seen.add(project.repo);
        projects.push(project);
      }
    }
  }

  if (projects.length === 0) {
    throw new Error('无法解析任何项目，GitHub Trending 页面结构可能已发生重大变化');
  }

  console.log(`✅ 解析完成：共 ${projects.length} 个项目`);

  const validProjects = projects.filter(p => {
    return p.repo && !p.repo.includes('login') && !p.repo.includes('sponsors');
  });

  const aiProjects = validProjects.filter(p => p.isAI);
  const otherProjects = validProjects.filter(p => !p.isAI);

  console.log(`📊 AI 相关项目：${aiProjects.length} 个`);
  console.log(`📊 其他项目：${otherProjects.length} 个`);

  const sortedProjects = [...aiProjects, ...otherProjects].slice(0, 25);

  return sortedProjects;
}

function parseArticle(articleContent, sinceLabel = 'today') {
  try {
    let repo = null;

    const repoMatch = articleContent.match(/href="\/([^"\/]+\/[^"\/]+)"[^>]*>/);
    if (repoMatch) {
      repo = repoMatch[1];
    }

    if (!repo) {
      const dataHrefMatch = articleContent.match(/data-href="\/([^"\/]+\/[^"\/]+)"/);
      if (dataHrefMatch) {
        repo = dataHrefMatch[1];
      }
    }

    if (!repo) return null;

    let desc = '';

    const descMatch = articleContent.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    if (descMatch) {
      desc = cleanHtml(descMatch[1]);
    }

    if (!desc) {
      const descMatch2 = articleContent.match(/<p[^>]*class="[^"]*text-gray[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      if (descMatch2) {
        desc = cleanHtml(descMatch2[1]);
      }
    }

    let stars = '0';
    const starsMatch = articleContent.match(/href="\/[^"]*\/stargazers"[^>]*>([\s\S]*?)<\/a>/);
    if (starsMatch) {
      stars = cleanHtml(starsMatch[1]).replace(/\s+/g, '');
    }

    let forks = '0';
    const forksMatch = articleContent.match(/href="\/[^"]*\/forks"[^>]*>([\s\S]*?)<\/a>/);
    if (forksMatch) {
      forks = cleanHtml(forksMatch[1]).replace(/\s+/g, '');
    }

    let language = 'Unknown';
    const langMatch = articleContent.match(/<span[^>]*itemprop="programmingLanguage"[^>]*>([^<]+)<\/span>/);
    if (langMatch) {
      language = cleanHtml(langMatch[1]);
    }

    let todayStars = '0';

    const todayStarsRegex = new RegExp(`(\\d[\\d,]*)\\s*stars?\\s*${sinceLabel}`, 'i');
    const todayStarsMatch = articleContent.match(todayStarsRegex);
    if (todayStarsMatch) {
      todayStars = todayStarsMatch[1].replace(/,/g, '');
    }

    if (todayStars === '0') {
      const todayMatch2 = articleContent.match(/>(\d[\d,]*)\s*star/);
      if (todayMatch2) {
        todayStars = todayMatch2[1].replace(/,/g, '');
      }
    }

    const isAI = isAIProject(repo, desc, language);

    return {
      repo,
      desc,
      stars,
      forks,
      language,
      todayStars,
      isAI
    };

  } catch (error) {
    console.warn(`⚠️ 解析项目失败：${error.message}`);
    return null;
  }
}

module.exports = { parseTrending, parseArticle, cleanHtml, extractNumber };
