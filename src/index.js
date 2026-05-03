/**
 * GitHub Trending 报告生成系统 - 主入口文件
 * 
 * 统一导出所有核心模块，提供完整的 API 接口
 */

// 核心模块
const DataLoader = require('./loader/data-loader');
const InsightAnalyzer = require('./analyzer/insight-analyzer');
const HTMLGenerator = require('./generator/html-generator');
const MessageSender = require('./notifier/message-sender');

// Wiki & 知识图谱模块
const WikiManager = require('./wiki/wiki-manager');
const WikiExtractor = require('./wiki/extractors/wiki-extractor');
const DomainMapper = require('./wiki/config/domain-mapper');
const KnowledgeGraph = require('./wiki/graph/knowledge-graph');
const SimilarityCalculator = require('./wiki/graph/similarity-calculator');
const FilterEngine = require('./wiki/filters/filter-engine');
const IndexPageGenerator = require('./generator/index-page-generator');

// 工具模块
const utils = require('./utils');
const pathUtils = require('./utils/path');
const logger = require('./utils/logger');
const fsUtils = require('./utils/fs');
const llmUtils = require('./utils/llm');
const templateUtils = require('./utils/template');

// 配置
const config = require('../config/config.json');
const prompts = require('../config/prompts.json');

module.exports = {
  // 核心模块
  DataLoader,
  InsightAnalyzer,
  HTMLGenerator,
  MessageSender,

  // Wiki & 知识图谱模块
  WikiManager,
  WikiExtractor,
  DomainMapper,
  KnowledgeGraph,
  SimilarityCalculator,
  FilterEngine,
  IndexPageGenerator,
  
  // 工具模块
  utils,
  path: pathUtils,
  logger,
  fs: fsUtils,
  llm: llmUtils,
  template: templateUtils,
  
  // 配置
  config,
  prompts,
  
  // 版本信息
  version: '2.1.0'
};
