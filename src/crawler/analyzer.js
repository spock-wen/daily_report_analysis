const { parseNumber } = require('./utils');

const PROJECT_PATTERNS = {
  agent: {
    keywords: ['agent', 'bot', 'assistant', 'copilot', 'claude', 'gpt', 'autonomous', 'workflow', 'orchestration', 'swarm', '智能体', '代理'],
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
  }
};

const LANG_FEATURES = {
  'Python': { ecosystem: 'AI/ML 首选', strengths: '丰富的 AI 库生态，快速原型开发' },
  'TypeScript': { ecosystem: '现代 Web 开发', strengths: '类型安全，大型企业级应用' },
  'Rust': { ecosystem: '高性能系统', strengths: '内存安全，极致性能，适合底层开发' },
  'Go': { ecosystem: '云原生后端', strengths: '高并发，快速编译，部署简单' },
  'Java': { ecosystem: '企业级应用', strengths: '成熟的生态，强大的并发能力' },
  'C++': { ecosystem: '系统/游戏开发', strengths: '极致性能，硬件控制能力强' },
  'C': { ecosystem: '嵌入式/系统', strengths: '轻量级，高效，适合资源受限环境' },
  'JavaScript': { ecosystem: '全栈开发', strengths: '广泛的浏览器支持，生态丰富' }
};

function detectProjectType(repo, desc) {
  const text = `${repo} ${desc}`.toLowerCase();

  for (const [type, config] of Object.entries(PROJECT_PATTERNS)) {
    if (config.keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return type;
    }
  }

  return 'general';
}

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

function generateUseCases(project, projectType) {
  const patterns = PROJECT_PATTERNS[projectType] || PROJECT_PATTERNS.devtool;
  return patterns.useCases.slice(0, 4);
}

function generateTrendAnalysis(project) {
  const trends = [];

  const todayStars = parseNumber(project.todayStars);
  const totalStars = parseNumber(project.stars);

  if (todayStars > 500) {
    trends.push('🔥 今日热度极高，受到社区广泛关注');
  } else if (todayStars > 200) {
    trends.push('📈 今日增长迅速，值得关注');
  } else if (todayStars > 50) {
    trends.push('📊 稳定增长，社区认可度良好');
  }

  if (totalStars > 20000) {
    trends.push('⭐ 明星项目，在开发者社区具有重要影响力');
  } else if (totalStars > 5000) {
    trends.push('🌟 热门项目，已被广泛采用');
  } else if (totalStars > 1000) {
    trends.push('💡 新兴项目，具有良好发展潜力');
  }

  if (project.has_api_data) {
    if (project.update_time) {
      trends.push(`🕒 最近更新时间：${project.update_time}`);
    }

    if (project.commits_last_30_days) {
      trends.push(`📝 近 30 天 Commits：${project.commits_last_30_days}`);
    }

    if (project.contributors_count) {
      trends.push(`👥 贡献者数量：${project.contributors_count}+`);
    }
  }

  const projectType = detectProjectType(project.repo, project.desc);
  const typeTrends = {
    agent: '🤖 AI Agent 领域持续火热，多智能体协作成为趋势',
    rag: '🔍 RAG 技术不断优化，企业知识管理需求增长',
    llm: '🧠 大模型生态日趋成熟，微调部署工具需求旺盛',
    speech: '🎤 边缘设备语音处理需求增长，轻量化模型受关注',
    database: '💾 高性能数据存储方案持续受到重视'
  };

  if (typeTrends[projectType]) {
    trends.push(typeTrends[projectType]);
  }

  return trends;
}

function generateCommunityActivity(project) {
  const todayStars = parseNumber(project.todayStars);
  const totalStars = parseNumber(project.stars);

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

function analyzeProject(project) {
  const projectType = detectProjectType(project.repo, project.desc);

  return {
    type: projectType,
    typeName: getProjectTypeName(projectType),
    coreFunctions: generateCoreFunctions(project, projectType),
    useCases: generateUseCases(project, projectType),
    trends: generateTrendAnalysis(project),
    community: generateCommunityActivity(project)
  };
}

function getProjectTypeName(type) {
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

module.exports = {
  analyzeProject,
  detectProjectType,
  generateCoreFunctions,
  generateUseCases,
  generateTrendAnalysis,
  PROJECT_PATTERNS,
  LANG_FEATURES
};
