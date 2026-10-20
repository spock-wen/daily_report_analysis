/**
 * ProjectAnalyzer - 项目分析器
 * 提供项目描述翻译和详细分析功能
 */

const logger = require('../utils/logger');

// 翻译缓存
const translationCache = new Map();

// 项目类型模式
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
  }
};

class ProjectAnalyzer {
  constructor() {
    this.name = 'ProjectAnalyzer';
  }

  /**
   * 批量分析项目（翻译描述 + 生成分析）
   * @param {Array} projects - 项目列表
   * @returns {Promise<Array>} 分析后的项目列表
   */
  async analyzeProjects(projects) {
    logger.info(`[${this.name}] 开始分析 ${projects.length} 个项目...`);

    const analyzedProjects = [];

    for (const project of projects) {
      try {
        const analyzed = await this.analyzeProject(project);
        analyzedProjects.push(analyzed);

        // 添加延迟避免翻译 API 速率限制（HTTP 429）
        await this.sleep(300);
      } catch (error) {
        logger.warn(`[${this.name}] 分析项目失败：${project.fullName || project.name}`, { error: error.message });
        analyzedProjects.push(project);
      }
    }

    logger.info(`[${this.name}] 项目分析完成`);
    return analyzedProjects;
  }

  /**
   * 分析单个项目
   * @param {Object} project - 项目数据
   * @returns {Promise<Object>} 分析后的项目数据
   */
  async analyzeProject(project) {
    const fullName = project.fullName || project.repo || project.name;
    const description = project.description || project.desc || '';
    
    // 翻译描述
    const descZh = await this.translateDescription(description);
    
    // 生成详细分析
    const analysis = this.generateAnalysis(project);
    
    return {
      ...project,
      desc: description, // 英文描述
      descZh, // 中文描述
      analysis
    };
  }

  /**
   * 翻译描述
   * @param {string} desc - 英文描述
   * @returns {Promise<string>} 中文描述
   */
  async translateDescription(desc) {
    if (!desc) return '';

    const cleanDesc = desc
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    // 如果已经是中文，直接返回
    if (/[\u4e00-\u9fa5]/.test(cleanDesc)) {
      return cleanDesc;
    }

    // 检查缓存
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
      } else {
        throw new Error(data.responseDetails || 'Translation failed');
      }
    } catch (error) {
      logger.warn(`[${this.name}] 翻译失败，返回原文: ${error.message}`);
      return cleanDesc;
    }
  }

  /**
   * 生成项目分析
   * @param {Object} project - 项目数据
   * @returns {Object} 分析结果
   */
  generateAnalysis(project) {
    const fullName = project.fullName || project.repo || project.name;
    const description = project.description || project.desc || '';
    const projectType = this.detectProjectType(fullName, description);

    return {
      type: projectType,
      typeName: this.getProjectTypeName(projectType),
      oneSentence: this.generateOneSentence(project),
      community: this.generateCommunityActivity(project)
    };
  }

  /**
   * 检测项目类型
   * @param {string} repo - 仓库名
   * @param {string} desc - 描述
   * @returns {string} 项目类型
   */
  detectProjectType(repo, desc) {
    const text = `${repo} ${desc}`.toLowerCase();

    for (const [type, config] of Object.entries(PROJECT_PATTERNS)) {
      if (config.keywords.some(kw => text.includes(kw.toLowerCase()))) {
        return type;
      }
    }

    return 'general';
  }

  /**
   * 获取项目类型名称
   * @param {string} type - 类型代码
   * @returns {string} 类型名称
   */
  getProjectTypeName(type) {
    const names = {
      agent: 'Agent 系统',
      rag: 'RAG / 向量检索',
      llm: 'LLM 工具/框架',
      speech: '语音处理',
      devtool: '开发工具',
      database: '数据库/存储',
      general: '通用工具'
    };
    return names[type] || names.general;
  }

  /**
   * 生成每项目一句话：这是什么、为什么上榜
   * 只依据该项目自身的 description/descZh/topics/README 摘要
   * @param {Object} project - 项目数据
   * @returns {string} 一句话
   */
  generateOneSentence(project) {
    const fullName = project.fullName || project.repo || project.name || '';
    const rawDescription = project.descZh || project.description || project.desc || '';
    let detail = String(rawDescription).replace(/\s+/g, ' ').trim();

    if (!detail) {
      const readme = project.readmeSummary || project.readme_summary || project.readme || project.readmeText || '';
      detail = this.firstSentence(readme);
    }

    const topics = Array.isArray(project.topics)
      ? project.topics.filter(Boolean).slice(0, 3)
      : [];

    if (detail && !/[。.!?！？]$/.test(detail)) {
      detail += '。';
    }

    if (detail) {
      const reason = topics.length > 0
        ? `上榜与 ${topics.join('、')} 方向相关。`
        : '上榜原因未知。';
      return `${fullName}：${detail}${reason}`;
    }

    if (topics.length > 0) {
      return `${fullName}：围绕 ${topics.join('、')} 的开源项目；上榜与这些方向相关。`;
    }

    return `${fullName}：暂无项目描述，上榜原因未知。`;
  }

  /**
   * 提取文本的第一句
   * @param {string} text - 原始文本
   * @returns {string} 第一句
   */
  firstSentence(text) {
    if (!text) return '';
    const normalized = String(text).replace(/[#>*_`\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    const match = normalized.match(/^(.{1,120}?[。.!?！？])(?:\s|$)/);
    return (match ? match[1] : normalized.slice(0, 120)).trim();
  }

  /**
   * 生成社区活跃度评估
   * @param {Object} project - 项目数据
   * @returns {Object} 社区活跃度
   */
  generateCommunityActivity(project) {
    const todayStars = this.parseNumber(project.todayStars);
    const totalStars = this.parseNumber(project.stars);

    if (todayStars > 500 && totalStars > 10000) {
      return { level: '极高', desc: '社区非常活跃，是领域内的标杆项目' };
    } else if (todayStars > 200 || totalStars > 5000) {
      return { level: '高', desc: '社区活跃，持续有开发者关注和贡献' };
    } else if (todayStars > 50 || totalStars > 1000) {
      return { level: '中', desc: '社区稳定，有固定的用户群体' };
    } else {
      return { level: '低', desc: '新兴项目，社区正在建设中' };
    }
  }

  /**
   * 解析数字（支持带逗号的字符串）
   * @param {string|number} value - 数值
   * @returns {number} 数字
   */
  parseNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const cleaned = String(value).replace(/,/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  }

  /**
   * 延迟函数
   * @param {number} ms - 毫秒
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ProjectAnalyzer;
