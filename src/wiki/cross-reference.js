/**
 * Cross Reference Analyzer - 跨项目关联分析
 * 分析项目之间的关系：相似项目、引用关系、同领域等
 */

const logger = require('../utils/logger');

class CrossReferenceAnalyzer {
  constructor() {
    // arXiv ID 正则匹配
    this.arxivRegex = /arXiv[:\s]+(\d{4}\.\d{4,5})/gi;
  }

  /**
   * 从 BibTeX 中提取引用关系
   * @param {string} bibtex - BibTeX 内容
   * @returns {Array} arXiv ID 列表
   */
  extractCitationsFromBibTeX(bibtex) {
    if (!bibtex) return [];

    const citations = [];
    let match;

    while ((match = this.arxivRegex.exec(bibtex)) !== null) {
      const arxivId = match[1];
      if (!citations.includes(arxivId)) {
        citations.push(arxivId);
      }
    }

    logger.debug(`从 BibTeX 提取 ${citations.length} 个引用：${citations.join(', ')}`);
    return citations;
  }

  /**
   * 基于 Wiki 内容检测相似项目
   * @param {Object} currentProject - 当前项目
   * @param {Array} allWikis - 所有 Wiki 内容数组
   * @returns {Array} 相似项目列表
   */
  findSimilarProjects(currentProject, allWikis) {
    if (!allWikis || allWikis.length === 0) return [];

    const currentDomain = currentProject.domain?.toLowerCase();
    const currentDesc = (currentProject.description || '').toLowerCase();
    const currentRepo = (currentProject.repo || '').toLowerCase();

    const scores = [];

    for (const wiki of allWikis) {
      // 跳过自己
      const wikiName = `${wiki.owner}/${wiki.repo}`.toLowerCase();
      if (wikiName === currentRepo) continue;

      let score = 0;
      const reasons = [];

      // 同领域 +3 分
      const wikiDomain = this._extractField(wiki.content, '领域分类');
      if (wikiDomain && wikiDomain.toLowerCase() === currentDomain) {
        score += 3;
        reasons.push('同领域');
      }

      // 同技术栈 +2 分
      const wikiLanguage = this._extractField(wiki.content, '语言');
      if (wikiLanguage && wikiLanguage === currentProject.language) {
        score += 2;
        reasons.push('同技术栈');
      }

      // 关键词匹配 +1 分
      const wikiContent = wiki.content.toLowerCase();
      const keywords = this._extractKeywords(currentDesc);
      let keywordMatch = 0;
      for (const kw of keywords) {
        if (wikiContent.includes(kw)) {
          keywordMatch++;
        }
      }
      if (keywordMatch >= 2) {
        score += 1;
        reasons.push(`关键词匹配 (${keywordMatch})`);
      }

      if (score > 0) {
        scores.push({
          owner: wiki.owner,
          repo: wiki.repo,
          score,
          reasons
        });
      }
    }

    // 按分数降序排序
    scores.sort((a, b) => b.score - a.score);

    logger.debug(`找到 ${scores.length} 个相似项目`);
    return scores.slice(0, 5);
  }

  /**
   * 基于关键词检测领域内项目
   * @param {string} domain - 领域名称
   * @param {Array} allWikis - 所有 Wiki 内容
   * @returns {Array} 领域内项目列表
   */
  getProjectsByDomain(domain, allWikis) {
    if (!domain || !allWikis) return [];

    const domainLower = domain.toLowerCase();
    const projects = [];

    for (const wiki of allWikis) {
      const wikiDomain = this._extractField(wiki.content, '领域分类');
      if (wikiDomain && wikiDomain.toLowerCase() === domainLower) {
        projects.push({
          owner: wiki.owner,
          repo: wiki.repo,
          content: wiki.content
        });
      }
    }

    return projects;
  }

  /**
   * 从 Wiki 内容中提取字段值
   * @param {string} content - Wiki 内容
   * @param {string} fieldName - 字段名称
   * @returns {string|null} 字段值
   */
  _extractField(content, fieldName) {
    if (!content) return null;

    const regex = new RegExp(`- ${fieldName}：(.+)\\n`);
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * 从文本中提取关键词
   * @param {string} text - 文本内容
   * @returns {Array} 关键词列表
   */
  _extractKeywords(text) {
    if (!text) return [];

    // 简单的关键词提取：提取技术关键词
    const keywords = [];

    // 技术关键词
    const techKeywords = [
      'agent', 'rag', 'llm', 'transformer', 'embedding', 'vector',
      'retrieval', 'fine-tune', 'inference', 'workflow', 'automation',
      '多智能体', '知识库', '检索', '向量', '大模型'
    ];

    const textLower = text.toLowerCase();
    for (const kw of techKeywords) {
      if (textLower.includes(kw.toLowerCase())) {
        keywords.push(kw.toLowerCase());
      }
    }

    return keywords;
  }
}

module.exports = CrossReferenceAnalyzer;
