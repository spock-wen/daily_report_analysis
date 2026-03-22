const { formatDate, formatStars, parseNumber } = require('./utils');
const { analyzeProject, detectProjectType } = require('./analyzer');

const translationCache = new Map();

async function translateDescription(desc) {
  if (!desc) return '';

  const cleanDesc = desc.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

  if (/[\u4e00-\u9fa5]/.test(cleanDesc)) {
    return cleanDesc;
  }

  if (translationCache.has(cleanDesc)) {
    return translationCache.get(cleanDesc);
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanDesc)}&langpair=en|zh-CN`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
      const translated = data.responseData.translatedText;
      translationCache.set(cleanDesc, translated);
      return translated;
    } else {
      throw new Error(data.responseDetails || 'Translation failed');
    }
  } catch (error) {
    console.error('翻译失败，返回原文:', error.message);
    return cleanDesc;
  }
}

async function batchTranslateDescriptions(descriptions) {
  const translatedMap = new Map();

  for (const desc of descriptions) {
    if (!desc || /[\u4e00-\u9fa5]/.test(desc)) {
      translatedMap.set(desc, desc);
      continue;
    }

    try {
      const translated = await translateDescription(desc);
      translatedMap.set(desc, translated);
    } catch (error) {
      console.error('翻译失败:', desc.substring(0, 30), error.message);
      translatedMap.set(desc, desc);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return translatedMap;
}

async function generateJsonData(projects, triggerType = 'daily') {
  const now = new Date().toISOString();
  const date = formatDate(new Date());

  const periodMap = {
    daily: '每日',
    weekly: '每周',
    monthly: '每月'
  };
  const period = periodMap[triggerType] || '每日';

  const totalStars = projects.reduce((sum, p) => {
    return sum + parseNumber(p.stars);
  }, 0);

  const allDescs = projects.map(p => p.desc);
  const translatedDescs = await batchTranslateDescriptions(allDescs);

  return {
    generatedAt: now,
    date: date,
    triggerType: triggerType,
    period: period,
    projects: projects.map(p => {
      const analysis = analyzeProject(p);
      return {
        repo: p.repo,
        name: p.name,
        fullName: p.full_name,
        desc: p.desc,
        descZh: translatedDescs.get(p.desc),
        language: p.language,
        homepage: p.homepage,
        topics: p.topics || [],

        stars: p.stars,
        forks: p.forks,
        watchers: p.watchers,
        open_issues: p.open_issues,
        todayStars: p.todayStars,

        created_at: p.created_at,
        updated_at: p.updated_at,
        pushed_at: p.pushed_at,
        update_time: p.update_time,
        created_time: p.created_time,

        subscribers_count: p.subscribers_count,
        has_issues: p.has_issues,
        has_wiki: p.has_wiki,
        has_discussions: p.has_discussions,

        license: p.license,

        is_fork: p.is_fork,
        is_archived: p.is_archived,
        default_branch: p.default_branch,

        has_api_data: p.has_api_data,

        isAI: p.isAI,

        url: `https://github.com/${p.repo}`,

        analysis: {
          type: analysis.type,
          typeName: analysis.typeName,
          coreFunctions: analysis.coreFunctions,
          useCases: analysis.useCases,
          trends: analysis.trends,
          community: analysis.community
        }
      };
    }),
    stats: {
      totalProjects: projects.length,
      aiProjects: projects.filter(p => p.isAI).length,
      avgStars: `${Math.round(totalStars / projects.length / 1000 * 10) / 10}k`
    }
  };
}

module.exports = { generateJsonData };
