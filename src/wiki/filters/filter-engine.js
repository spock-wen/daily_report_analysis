/**
 * FilterEngine - 筛选引擎
 * 支持多维度项目筛选
 */

const logger = require('../../utils/logger');

class FilterEngine {
  constructor(knowledgeGraph) {
    this.kg = knowledgeGraph;
  }

  /**
   * 筛选项目
   * @param {Object} filters - 筛选条件
   * @param {string} [filters.superDomain] - 超级领域
   * @param {string} [filters.domain] - 子领域
   * @param {Object} [filters.timeRange] - 时间范围
   * @param {number} [filters.minAppearances] - 最小上榜次数
   * @param {string} [filters.searchQuery] - 搜索关键词
   * @returns {Object} 筛选结果和元数据
   */
  filter(filters = {}) {
    let projects = this.kg.getAllProjects();
    const metadata = {
      total: projects.length,
      filtered: 0,
      domainCounts: {}
    };

    // 1. 超级领域筛选
    if (filters.superDomain) {
      projects = this._filterBySuperDomain(projects, filters.superDomain);
    }

    // 2. 子领域筛选
    if (filters.domain) {
      projects = this._filterByDomain(projects, filters.domain);
    }

    // 3. 时间范围筛选
    if (filters.timeRange) {
      projects = this._filterByTimeRange(projects, filters.timeRange);
    }

    // 4. 最小上榜次数筛选
    if (filters.minAppearances) {
      projects = projects.filter(p => p.appearances >= filters.minAppearances);
    }

    // 5. 搜索筛选
    if (filters.searchQuery) {
      projects = this._filterBySearch(projects, filters.searchQuery);
    }

    // 计算元数据
    metadata.filtered = projects.length;
    metadata.domainCounts = this._countDomains(projects);

    return {
      projects,
      metadata
    };
  }

  /**
   * 按超级领域筛选
   * @private
   */
  _filterBySuperDomain(projects, superDomain) {
    return projects.filter(project =>
      project.superDomains.includes(superDomain)
    );
  }

  /**
   * 按子领域筛选
   * @private
   */
  _filterByDomain(projects, domain) {
    return projects.filter(project =>
      project.domains.includes(domain)
    );
  }

  /**
   * 按时间范围筛选
   * @private
   */
  _filterByTimeRange(projects, timeRange) {
    const now = new Date();
    let startDate, endDate;

    if (timeRange.type === 'thisWeek') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = weekAgo.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else if (timeRange.type === 'thisMonth') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = monthAgo.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else if (timeRange.type === 'custom' && timeRange.startDate && timeRange.endDate) {
      startDate = timeRange.startDate;
      endDate = timeRange.endDate;
    }

    if (startDate && endDate) {
      return projects.filter(project =>
        project.lastSeen &&
        project.lastSeen >= startDate &&
        project.lastSeen <= endDate
      );
    }

    return projects;
  }

  /**
   * 按搜索筛选
   * @private
   */
  _filterBySearch(projects, query) {
    const lowerQuery = query.toLowerCase();
    return projects.filter(project => {
      const fullName = project.fullName.toLowerCase();
      const repoName = project.repo.toLowerCase();
      const ownerName = project.owner.toLowerCase();
      const domains = project.domains.join(' ').toLowerCase();

      return fullName.includes(lowerQuery) ||
             repoName.includes(lowerQuery) ||
             ownerName.includes(lowerQuery) ||
             domains.includes(lowerQuery);
    });
  }

  /**
   * 统计项目各领域数量
   * @private
   */
  _countDomains(projects) {
    const counts = {};
    for (const project of projects) {
      for (const domain of project.domains) {
        counts[domain] = (counts[domain] || 0) + 1;
      }
    }
    return counts;
  }
}

module.exports = FilterEngine;
