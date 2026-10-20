const logger = require('../utils/logger');

const translationCache = new Map();

const PROJECT_PATTERNS = {
  agent: {
    keywords: ['agent', 'bot', 'assistant', 'copilot', 'claude', 'gpt', 'autonomous', 'workflow', 'orchestration', 'swarm', '智能体', '代理']
  },
  rag: {
    keywords: ['rag', 'retrieval', 'vector', 'embedding', 'index', 'search', 'knowledge', 'semantic', '检索', '向量', '知识库']
  },
  llm: {
    keywords: ['llm', 'language model', 'transformer', 'gpt', 'bert', 'huggingface', 'hf', 'model', 'fine-tune', '大模型', '预训练']
  },
  speech: {
    keywords: ['speech', 'voice', 'asr', 'tts', 'audio', 'whisper', 'recognition', '语音', '识别', '合成']
  },
  devtool: {
    keywords: ['cli', 'tool', 'framework', 'sdk', 'library', 'plugin', 'extension', 'ide', 'editor', '开发工具']
  },
  database: {
    keywords: ['database', 'db', 'storage', 'cache', 'sql', 'nosql', 'graph', '数据库', '存储']
  },
  security: {
    keywords: ['security', 'pentest', 'vulnerability', 'scan', 'audit', '安全', '渗透', '漏洞']
  },
  browser: {
    keywords: ['browser', 'automation', 'scraping', 'crawler', 'selenium', 'puppeteer', 'playwright', '浏览器', '自动化']
  }
};

function detectProjectType(repo, desc) {
  const text = `${repo || ''} ${desc || ''}`.toLowerCase();

  for (const [type, config] of Object.entries(PROJECT_PATTERNS)) {
    if (config.keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
      return type;
    }
  }

  return 'general';
}

function getProjectTypeName(type) {
  const names = {
    agent: 'Agent 系统',
    rag: 'RAG / 向量检索',
    llm: 'LLM 工具/框架',
    speech: '语音处理',
    devtool: '开发工具',
    database: '数据库/存储',
    security: '安全工具',
    browser: '浏览器自动化',
    general: '通用工具'
  };
  return names[type] || names.general;
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const text = String(value).replace(/,/g, '').trim().toLowerCase();
  if (text.endsWith('k')) return parseFloat(text) * 1000;
  if (text.endsWith('m')) return parseFloat(text) * 1000000;

  const number = parseInt(text, 10);
  return Number.isNaN(number) ? 0 : number;
}

function firstSentence(text) {
  if (!text) return '';
  const normalized = String(text).replace(/[#>*_`[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const match = normalized.match(/^(.{1,120}?[。.!?！？])(?:\s|$)/);
  return (match ? match[1] : normalized.slice(0, 120)).trim();
}

function generateOneSentence(project) {
  const fullName = project.fullName || project.repo || project.name || '';
  const rawDescription = project.descZh || project.description || project.desc || '';
  let detail = String(rawDescription).replace(/\s+/g, ' ').trim();

  if (!detail) {
    const readme = project.readmeSummary || project.readme_summary || project.readme || project.readmeText || '';
    detail = firstSentence(readme);
  }

  const topics = Array.isArray(project.topics)
    ? project.topics.filter(Boolean).slice(0, 3)
    : [];

  const sentenceDetail = detail.replace(/[。.!?！？]+$/, '');

  if (sentenceDetail) {
    const reason = topics.length > 0
      ? `，因 ${topics.join('、')} 方向受到关注`
      : '';
    return `${fullName}：${sentenceDetail}${reason}。`;
  }

  if (topics.length > 0) {
    return `${fullName}：围绕 ${topics.join('、')} 的开源项目。`;
  }

  return `${fullName}：暂无项目描述，上榜原因未知。`;
}

function generateCommunityActivity(project) {
  const todayStars = parseNumber(project.todayStars);
  const totalStars = parseNumber(project.stars);

  if (todayStars > 1000 && totalStars > 20000) {
    return { level: '极高', desc: '社区非常活跃，是领域内的标杆项目' };
  } else if (todayStars > 500 || totalStars > 10000) {
    return { level: '极高', desc: '社区非常活跃，持续有开发者关注和贡献' };
  } else if (todayStars > 200 || totalStars > 5000) {
    return { level: '高', desc: '社区活跃，持续有开发者关注和贡献' };
  } else if (todayStars > 50 || totalStars > 1000) {
    return { level: '中', desc: '社区稳定，有固定的用户群体' };
  }

  return { level: '低', desc: '新兴项目，社区正在建设中' };
}

function generateAnalysis(project) {
  const fullName = project.fullName || project.repo || project.name;
  const description = project.description || project.desc || '';
  const projectType = detectProjectType(fullName, description);

  return {
    type: projectType,
    typeName: getProjectTypeName(projectType),
    oneSentence: generateOneSentence(project),
    community: generateCommunityActivity(project)
  };
}

async function translateDescription(desc) {
  if (!desc) return '';

  const cleanDesc = desc
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      translationCache.set(cleanDesc, translated);
      return translated;
    }

    throw new Error(data.responseDetails || 'Translation failed');
  } catch (error) {
    logger.warn(`翻译失败，返回原文：${error.message}`);
    return cleanDesc;
  }
}

class ProjectAnalyzer {
  constructor() {
    this.name = 'ProjectAnalyzer';
  }

  async analyzeProjects(projects) {
    const analyzedProjects = [];

    for (const project of projects || []) {
      try {
        analyzedProjects.push(await this.analyzeProject(project));
        await this.sleep(300);
      } catch (error) {
        logger.warn(`分析项目失败：${project.fullName || project.name}`, { error: error.message });
        analyzedProjects.push(project);
      }
    }

    return analyzedProjects;
  }

  async analyzeProject(project) {
    const description = project.description || project.desc || '';
    const descZh = await translateDescription(description);

    return {
      ...project,
      desc: description,
      descZh,
      analysis: this.generateAnalysis(project)
    };
  }

  generateAnalysis(project) {
    return generateAnalysis(project);
  }

  generateOneSentence(project) {
    return generateOneSentence(project);
  }

  detectProjectType(repo, desc) {
    return detectProjectType(repo, desc);
  }

  getProjectTypeName(type) {
    return getProjectTypeName(type);
  }

  parseNumber(value) {
    return parseNumber(value);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ProjectAnalyzer;
module.exports.ProjectAnalyzer = ProjectAnalyzer;
module.exports.detectProjectType = detectProjectType;
module.exports.getProjectTypeName = getProjectTypeName;
module.exports.parseNumber = parseNumber;
module.exports.generateOneSentence = generateOneSentence;
module.exports.generateCommunityActivity = generateCommunityActivity;
module.exports.generateAnalysis = generateAnalysis;
module.exports.translateDescription = translateDescription;
