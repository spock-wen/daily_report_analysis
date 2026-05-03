/**
 * KnowledgeGraph - 知识图谱核心
 * 负责构建、查询和操作知识图谱
 */

const DomainMapper = require('../config/domain-mapper');
const WikiExtractor = require('../extractors/wiki-extractor');
const logger = require('../../utils/logger');

class KnowledgeGraph {
  constructor() {
    this.nodes = new Map(); // key: "owner/repo"
    this.edges = new Map(); // key: sourceNode, value: array of target edges
    this.domainIndex = new Map(); // domain -> Set of project keys
    this.superDomainIndex = new Map(); // superDomain -> Set of project keys
    this.domainMapper = new DomainMapper();
  }

  /**
   * 从项目数组构建完整图谱
   * @param {Array} projects - 项目对象数组
   */
  build(projects) {
    logger.debug('开始构建知识图谱...');

    // 清空现有数据
    this.nodes.clear();
    this.edges.clear();
    this.domainIndex.clear();
    this.superDomainIndex.clear();

    // 1. 添加所有节点
    for (const project of projects) {
      this._addNode(project);
    }

    // 2. 添加边（基于领域、技术栈等）
    for (const [key, project] of this.nodes.entries()) {
      this._buildEdges(project);
    }

    logger.debug(`知识图谱构建完成: ${this.nodes.size} 个节点, ${this._countEdges()} 条边`);
  }

  /**
   * 从 Wiki 目录构建完整图谱
   */
  async buildFromWiki() {
    const extractor = new WikiExtractor();
    const projects = extractor.parseAllProjects();
    await this.domainMapper.buildMapping();

    // 为项目添加超级领域信息
    for (const project of projects) {
      project.superDomains = this.domainMapper.getSuperDomains(project.domains);
    }

    this.build(projects);
    return projects;
  }

  /**
   * 添加单个节点
   * @private
   */
  _addNode(project) {
    const key = project.fullName;
    this.nodes.set(key, project);

    // 更新领域索引
    for (const domain of project.domains) {
      if (!this.domainIndex.has(domain)) {
        this.domainIndex.set(domain, new Set());
      }
      this.domainIndex.get(domain).add(key);
    }

    // 更新超级领域索引
    for (const superDomain of project.superDomains) {
      if (!this.superDomainIndex.has(superDomain)) {
        this.superDomainIndex.set(superDomain, new Set());
      }
      this.superDomainIndex.get(superDomain).add(key);
    }
  }

  /**
   * 为项目构建边
   * @private
   */
  _buildEdges(project) {
    const sourceKey = project.fullName;
    const edges = [];

    // 1. 基于同领域构建边
    for (const domain of project.domains) {
      const domainProjects = this.domainIndex.get(domain) || new Set();
      for (const targetKey of domainProjects) {
        if (targetKey !== sourceKey) {
          const existingEdge = edges.find(e => e.target === targetKey);
          if (existingEdge) {
            existingEdge.score += 3;
            if (!existingEdge.types.includes('同领域')) {
              existingEdge.types.push('同领域');
            }
          } else {
            edges.push({
              target: targetKey,
              types: ['同领域'],
              score: 3
            });
          }
        }
      }
    }

    // 2. 基于同技术栈构建边
    for (const [targetKey, targetProject] of this.nodes.entries()) {
      if (targetKey !== sourceKey && targetProject.language === project.language) {
        const existingEdge = edges.find(e => e.target === targetKey);
        if (existingEdge) {
          existingEdge.score += 2;
          if (!existingEdge.types.includes('同技术栈')) {
            existingEdge.types.push('同技术栈');
          }
        } else {
          edges.push({
            target: targetKey,
            types: ['同技术栈'],
            score: 2
          });
        }
      }
    }

    // 3. 基于项目内置关系构建边
    for (const relation of project.relations) {
      const existingEdge = edges.find(e => e.target === relation.target);
      if (existingEdge) {
        existingEdge.score += 2;
        if (!existingEdge.types.includes(relation.type)) {
          existingEdge.types.push(relation.type);
        }
        existingEdge.description = relation.description;
      } else if (this.nodes.has(relation.target)) {
        edges.push({
          target: relation.target,
          types: [relation.type],
          score: 2,
          description: relation.description
        });
      }
    }

    // 过滤并排序边（只保留分数 >= 3 的）
    const filteredEdges = edges
      .filter(e => e.score >= 3)
      .sort((a, b) => b.score - a.score);

    this.edges.set(sourceKey, filteredEdges);
  }

  /**
   * 统计总边数
   * @private
   */
  _countEdges() {
    let count = 0;
    for (const edges of this.edges.values()) {
      count += edges.length;
    }
    return count;
  }

  /**
   * 获取指定项目的邻居节点
   * @param {string} projectKey - 项目 key "owner/repo"
   * @param {Object} options - 选项
   * @param {number} options.limit - 返回数量限制
   * @returns {Array} 邻居项目数组
   */
  getNeighbors(projectKey, options = {}) {
    const limit = options.limit || 5;
    const edges = this.edges.get(projectKey) || [];

    return edges
      .slice(0, limit)
      .map(edge => ({
        project: this.nodes.get(edge.target),
        types: edge.types,
        score: edge.score,
        description: edge.description
      }))
      .filter(item => item.project);
  }

  /**
   * 获取 Top N 热门项目（按 Stars 排序）
   * @param {number} n - 返回数量
   * @returns {Array} 项目数组
   */
  getTopHotProjects(n = 20) {
    const projects = Array.from(this.nodes.values());
    return projects
      .sort((a, b) => b.stars - a.stars)
      .slice(0, n);
  }

  /**
   * 按领域筛选项目
   * @param {string} domain - 领域名称
   * @returns {Array} 项目数组
   */
  getProjectsByDomain(domain) {
    const projectKeys = this.domainIndex.get(domain) || new Set();
    return Array.from(projectKeys)
      .map(key => this.nodes.get(key))
      .filter(Boolean);
  }

  /**
   * 按超级领域筛选项目
   * @param {string} superDomain - 超级领域 key
   * @returns {Array} 项目数组
   */
  getProjectsBySuperDomain(superDomain) {
    const projectKeys = this.superDomainIndex.get(superDomain) || new Set();
    return Array.from(projectKeys)
      .map(key => this.nodes.get(key))
      .filter(Boolean);
  }

  /**
   * 搜索项目（模糊匹配）
   * @param {string} query - 搜索关键词
   * @returns {Array} 匹配的项目数组
   */
  searchProject(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const project of this.nodes.values()) {
      const fullName = project.fullName.toLowerCase();
      const repoName = project.repo.toLowerCase();
      const ownerName = project.owner.toLowerCase();

      if (fullName.includes(lowerQuery) ||
          repoName.includes(lowerQuery) ||
          ownerName.includes(lowerQuery)) {
        results.push(project);
      }
    }

    return results.sort((a, b) => b.stars - a.stars);
  }

  /**
   * 获取单个项目
   * @param {string} projectKey - 项目 key
   * @returns {Object|null} 项目对象
   */
  getProject(projectKey) {
    return this.nodes.get(projectKey) || null;
  }

  /**
   * 获取所有项目
   * @returns {Array} 所有项目数组
   */
  getAllProjects() {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取图谱统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      nodes: this.nodes.size,
      edges: this._countEdges(),
      domains: this.domainIndex.size,
      superDomains: this.superDomainIndex.size
    };
  }
}

module.exports = KnowledgeGraph;
