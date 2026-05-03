/**
 * 知识图谱系统 - 主入口
 * 统一导出所有知识图谱模块
 */

// 配置模块
const DomainMapper = require('./config/domain-mapper');

// 提取器模块
const WikiExtractor = require('./extractors/wiki-extractor');

// 图谱核心模块
const KnowledgeGraph = require('./graph/knowledge-graph');
const SimilarityCalculator = require('./graph/similarity-calculator');

// 筛选模块
const FilterEngine = require('./filters/filter-engine');

// 生成器模块
const IndexPageGenerator = require('../generator/index-page-generator');

module.exports = {
  // 配置
  DomainMapper,

  // 提取器
  WikiExtractor,

  // 图谱核心
  KnowledgeGraph,
  SimilarityCalculator,

  // 筛选
  FilterEngine,

  // 生成器
  IndexPageGenerator
};
