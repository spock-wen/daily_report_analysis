/**
 * 项目分析模块
 * 提供项目类型检测、描述翻译、详细分析等功能
 */

const logger = require('../utils/logger');

// 项目类型模式定义
const PROJECT_PATTERNS = {
  agent: {
    keywords: ['agent', 'bot', 'assistant', 'copilot', 'claude', 'gpt', 'autonomous', 'workflow', 'orchestration', 'swarm', '智能体', '代理'],
    name: 'Agent 系统',
    coreFunctions: [
      '提供智能代理/自动化助手功能',
      '支持多步骤任务规划和执行',
      '集成 LLM 能力进行自然语言交互',
      '支持工具调用和外部 API 集成'
    ],
    useCases: [
      '自动化工作流程和任务处理',
      '智能客服和对话系统',
      '代码生成和开发辅助',
      '数据处理和报告生成'
    ]
  },
  rag: {
    keywords: ['rag', 'retrieval', 'vector', 'embedding', 'index', 'search', 'knowledge', 'semantic', '检索', '向量', '知识库'],
    name: 'RAG / 向量检索',
    coreFunctions: [
      '提供高效的向量检索和语义搜索',
      '支持大规模知识库构建和管理',
      '集成 Embedding 模型进行向量化',
      '优化检索准确性和响应速度'
    ],
    useCases: [
      '企业知识库和文档检索',
      '智能问答系统',
      '内容推荐和相似度匹配',
      '多模态数据检索'
    ]
  },
  llm: {
    keywords: ['llm', 'language model', 'transformer', 'gpt', 'bert', 'huggingface', 'hf', 'model', 'fine-tune', '大模型', '预训练'],
    name: 'LLM 工具/框架',
    coreFunctions: [
      '提供大语言模型训练和推理能力',
      '支持模型微调和参数优化',
      '集成主流 Transformer 架构',
      '提供模型部署和 serving 工具'
    ],
    useCases: [
      '自定义大模型训练',
      '领域特定模型微调',
      '模型性能优化和压缩',
      '多模型集成和对比'
    ]
  },
  speech: {
    keywords: ['speech', 'voice', 'asr', 'tts', 'audio', 'whisper', 'recognition', '语音', '识别', '合成'],
    name: '语音处理',
    coreFunctions: [
      '提供语音识别(ASR)和文本转语音(TTS)',
      '支持多语言和方言识别',
      '实时音频流处理能力',
      '针对边缘设备优化性能'
    ],
    useCases: [
      '语音助手和智能设备',
      '会议记录和语音转写',
      '有声内容生成',
      '实时翻译和字幕生成'
    ]
  },
  devtool: {
    keywords: ['cli', 'tool', 'framework', 'sdk', 'library', 'plugin', 'extension', 'ide', 'editor', '开发工具'],
    name: '开发工具',
    coreFunctions: [
      '提供开发者工具和效率提升功能',
      '支持多种编程语言和框架',
      '集成开发环境和工作流优化',
      '提供调试和测试辅助功能'
    ],
    useCases: [
      '提升开发效率和代码质量',
      '自动化重复性开发任务',
      '团队协作和项目管理',
      '持续集成和部署流程'
    ]
  },
  database: {
    keywords: ['database', 'db', 'storage', 'cache', 'sql', 'nosql', 'graph', '数据库', '存储'],
    name: '数据库/存储',
    coreFunctions: [
      '提供高性能数据存储和查询',
      '支持分布式和水平扩展',
      '优化读写性能和数据一致性',
      '提供丰富的数据类型和索引'
    ],
    useCases: [
      '大规模数据存储和管理',
      '实时数据分析和处理',
      '缓存和会话存储',
      '图数据和关系分析'
    ]
  },
  security: {
    keywords: ['security', 'pentest', 'vulnerability', 'scan', 'audit', '安全', '渗透', '漏洞'],
    name: '安全工具',
    coreFunctions: [
      '提供安全测试和漏洞扫描',
      '支持自动化渗透测试',
      '集成安全审计和合规检查',
      '实时威胁检测和响应'
    ],
    useCases: [
      '企业安全评估和加固',
      '自动化安全测试流程',
      '漏洞管理和修复跟踪',
      '安全合规性检查'
    ]
  },
  browser: {
    keywords: ['browser', 'automation', 'scraping', 'crawler', 'selenium', 'puppeteer', 'playwright', '浏览器', '自动化'],
    name: '浏览器自动化',
    coreFunctions: [
      '提供浏览器自动化控制能力',
      '支持网页数据抓取和解析',
      '集成主流自动化框架',
      '支持无头模式和分布式执行'
    ],
    useCases: [
      '自动化测试和回归验证',
      '网页数据采集和监控',
      '自动化表单填写和提交',
      '端到端业务流程自动化'
    ]
  }
};

// 编程语言特性
const LANG_FEATURES = {
  'Python': { ecosystem: 'AI/ML 首选', strengths: '丰富的 AI 库生态，快速原型开发' },
  'TypeScript': { ecosystem: '现代 Web 开发', strengths: '类型安全，大型企业级应用' },
  'Rust': { ecosystem: '高性能系统', strengths: '内存安全，极致性能，适合底层开发' },
  'Go': { ecosystem: '云原生后端', strengths: '高并发，快速编译，部署简单' },
  'Java': { ecosystem: '企业级应用', strengths: '成熟的生态，强大的并发能力' },
  'C++': { ecosystem: '系统/游戏开发', strengths: '极致性能，硬件控制能力强' },
  'C': { ecosystem: '嵌入式/系统', strengths: '轻量级，高效，适合资源受限环境' },
  'JavaScript': { ecosystem: '全栈开发', strengths: '广泛的浏览器支持，生态丰富' },
  'Ruby': { ecosystem: 'Web 开发', strengths: '开发效率高，适合快速迭代' },
  'Swift': { ecosystem: 'iOS/macOS', strengths: '苹果生态原生支持，性能优秀' }
};

/**
 * 检测项目类型
 * @param {string} repo - 仓库名
 * @param {string} desc - 项目描述
 * @returns {string} 项目类型
 */
function detectProjectType(repo, desc) {
  const text = `${repo} ${desc || ''}`.toLowerCase();

  for (const [type, config] of Object.entries(PROJECT_PATTERNS)) {
    if (config.keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return type;
    }
  }

  return 'general';
}

/**
 * 获取项目类型名称
 * @param {string} type - 项目类型
 * @returns {string} 类型名称
 */
function getProjectTypeName(type) {
  return PROJECT_PATTERNS[type]?.name || '通用工具';
}

/**
 * 解析数字（支持 k, m 后缀）
 * @param {string|number} value - 数值字符串
 * @returns {number} 解析后的数字
 */
function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = value.toString().replace(/,/g, '').toLowerCase();
  
  if (str.includes('k')) {
    return parseFloat(str.replace('k', '')) * 1000;
  } else if (str.includes('m')) {
    return parseFloat(str.replace('m', '')) * 1000000;
  }
  
  return parseInt(str, 10) || 0;
}

/**
 * 生成核心功能列表
 * @param {Object} project - 项目数据
 * @param {string} projectType - 项目类型
 * @returns {Array} 核心功能列表
 */
function generateCoreFunctions(project, projectType) {
  const patterns = PROJECT_PATTERNS[projectType] || PROJECT_PATTERNS.devtool;
  const langFeature = LANG_FEATURES[project.language] || { strengths: '跨平台开发' };

  const functions = [...patterns.coreFunctions];

  if (langFeature.strengths) {
    functions.push(`基于 ${project.language} - ${langFeature.strengths}`);
  }

  const stars = parseNumber(project.stars);

  if (stars > 10000) {
    functions.push('经过大规模生产环境验证，社区活跃度高');
  } else if (stars > 1000) {
    functions.push('社区认可度良好，持续迭代更新');
  }

  return functions.slice(0, 4);
}

/**
 * 生成适用场景
 * @param {Object} project - 项目数据
 * @param {string} projectType - 项目类型
 * @returns {Array} 适用场景列表
 */
function generateUseCases(project, projectType) {
  const patterns = PROJECT_PATTERNS[projectType] || PROJECT_PATTERNS.devtool;
  return patterns.useCases.slice(0, 4);
}

/**
 * 生成趋势分析
 * @param {Object} project - 项目数据
 * @returns {Array} 趋势分析列表
 */
function generateTrendAnalysis(project) {
  const trends = [];

  const todayStars = parseNumber(project.todayStars);
  const totalStars = parseNumber(project.stars);

  if (todayStars > 1000) {
    trends.push('🔥 今日热度极高，受到社区广泛关注');
  } else if (todayStars > 500) {
    trends.push('📈 今日增长迅速，成为热门项目');
  } else if (todayStars > 200) {
    trends.push('📊 稳定增长，社区认可度良好');
  } else if (todayStars > 50) {
    trends.push('🌱 持续获得关注，发展潜力良好');
  }

  if (totalStars > 50000) {
    trends.push('⭐ 明星项目，在开发者社区具有重要影响力');
  } else if (totalStars > 20000) {
    trends.push('🌟 热门项目，已被广泛采用');
  } else if (totalStars > 5000) {
    trends.push('💎 优质项目，具有良好的技术价值');
  } else if (totalStars > 1000) {
    trends.push('💡 新兴项目，具有良好发展潜力');
  }

  const projectType = detectProjectType(project.fullName || project.repo, project.description || project.desc);
  const typeTrends = {
    agent: '🤖 AI Agent 领域持续火热，多智能体协作成为趋势',
    rag: '🔍 RAG 技术不断优化，企业知识管理需求增长',
    llm: '🧠 大模型生态日趋成熟，微调部署工具需求旺盛',
    speech: '🎤 边缘设备语音处理需求增长，轻量化模型受关注',
    database: '💾 高性能数据存储方案持续受到重视',
    security: '🛡️ 安全自动化需求上升，AI 驱动的渗透测试受关注',
    browser: '🌐 浏览器自动化与 AI 结合，Web 代理成为新趋势',
    devtool: '🛠️ 开发者效率工具持续创新，AI 辅助开发成主流'
  };

  if (typeTrends[projectType]) {
    trends.push(typeTrends[projectType]);
  }

  return trends;
}

/**
 * 生成社区活跃度评估
 * @param {Object} project - 项目数据
 * @returns {Object} 社区活跃度信息
 */
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
  } else {
    return { level: '低', desc: '新兴项目，社区正在建设中' };
  }
}

/**
 * 简单的描述翻译（基于关键词映射）
 * @param {string} desc - 英文描述
 * @param {