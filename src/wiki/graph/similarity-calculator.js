/**
 * SimilarityCalculator - 相似度计算器
 * 计算两个项目之间的关联分数
 */

const logger = require('../../utils/logger');

class SimilarityCalculator {
  constructor() {
    this.techKeywords = [
      'python', 'javascript', 'typescript', 'java', 'go', 'rust',
      'ai', 'ml', 'llm', 'agent', 'rag', 'deep learning', 'neural',
      'web', 'frontend', 'backend', 'api', 'database', 'cloud'
    ];
  }

  /**
   * 计算两个项目的相似度分数
   * @param {Object} projectA - 项目 A
   * @param {Object} projectB - 项目 B
   * @returns {Object} 包含分数和类型的结果
   */
  calculate(projectA, projectB) {
    let score = 0;
    const types = [];

    // 1. 同领域 (+3 分)
    const hasCommonDomain = projectA.domains.some(domainA =>
      projectB.domains.includes(domainA)
    );
    if (hasCommonDomain) {
      score += 3;
      types.push('同领域');
    }

    // 2. 同属超级领域 (+1 分)
    const hasCommonSuperDomain = projectA.superDomains.some(sdA =>
      projectB.superDomains.includes(sdA)
    );
    if (hasCommonSuperDomain && !hasCommonDomain) {
      score += 1;
      types.push('同超级领域');
    }

    // 3. 同技术栈 (+2 分)
    if (projectA.language && projectB.language &&
        projectA.language === projectB.language) {
      score += 2;
      types.push('同技术栈');
    }

    // 4. 关键词匹配 (+1~3 分)
    const keywordMatches = this._countKeywordMatches(projectA, projectB);
    if (keywordMatches > 0) {
      const keywordScore = Math.min(keywordMatches, 3);
      score += keywordScore;
      types.push('关键词匹配');
    }

    // 5. 引用关系 (+2 分)
    const hasReference = this._checkReference(projectA, projectB);
    if (hasReference) {
      score += 2;
      types.push('引用关系');
    }

    return {
      score,
      types,
      meetsThreshold: score >= 3
    };
  }

  /**
   * 计算关键词匹配数量
   * @private
   */
  _countKeywordMatches(projectA, projectB) {
    const textA = [
      projectA.repo,
      ...(projectA.coreFunctions || []),
      ...(projectA.domains || [])
    ].join(' ').toLowerCase();

    const textB = [
      projectB.repo,
      ...(projectB.coreFunctions || []),
      ...(projectB.domains || [])
    ].join(' ').toLowerCase();

    let matches = 0;
    for (const keyword of this.techKeywords) {
      if (textA.includes(keyword) && textB.includes(keyword)) {
        matches++;
      }
    }
    return matches;
  }

  /**
   * 检查是否有引用关系
   * @private
   */
  _checkReference(projectA, projectB) {
    const fullNameB = projectB.fullName;
    const hasAReferenceB = projectA.relations.some(r =>
      r.target === fullNameB
    );

    if (hasAReferenceB) return true;

    const fullNameA = projectA.fullName;
    return projectB.relations.some(r =>
      r.target === fullNameA
    );
  }

  /**
   * 批量计算相似度
   * @param {Object} sourceProject - 源项目
   * @param {Array} targetProjects - 目标项目数组
   * @returns {Array} 排序后的结果数组
   */
  calculateBatch(sourceProject, targetProjects) {
    const results = targetProjects
      .filter(p => p.fullName !== sourceProject.fullName)
      .map(target => ({
        project: target,
        ...this.calculate(sourceProject, target)
      }))
      .filter(result => result.meetsThreshold)
      .sort((a, b) => b.score - a.score);

    return results;
  }
}

module.exports = SimilarityCalculator;
