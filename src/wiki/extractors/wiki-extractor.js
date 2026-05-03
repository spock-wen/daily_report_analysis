/**
 * WikiExtractor - Wiki 解析器
 * 从 Wiki Markdown 文件中提取结构化数据
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

class WikiExtractor {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), 'wiki', 'projects');
  }

  /**
   * 解析单个 Wiki 文件
   * @param {string} filePath - Wiki 文件路径
   * @returns {Object} 结构化项目对象
   */
  parseFile(filePath) {
    if (!fs.existsSync(filePath)) {
      logger.warn(`Wiki 文件不存在: ${filePath}`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.md');
    const nameMatch = fileName.match(/^(.+)_(.+)$/);

    if (!nameMatch) {
      logger.warn(`无法解析文件名: ${fileName}`);
      return null;
    }

    return this.parseMarkdown(content, nameMatch[1], nameMatch[2]);
  }

  /**
   * 解析 Markdown 内容
   * @param {string} content - Markdown 文本
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @returns {Object} 结构化项目对象
   */
  parseMarkdown(content, owner, repo) {
    const result = {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      firstSeen: null,
      lastSeen: null,
      appearances: 0,
      stars: 0,
      language: 'Unknown',
      domains: [],
      superDomains: [],
      coreFunctions: [],
      relations: [],
      projectStatus: null
    };

    // 解析基本信息
    result.firstSeen = this._extractField(content, '首次上榜');
    result.lastSeen = this._extractField(content, '最近上榜');
    result.appearances = this._extractNumericField(content, '上榜次数');
    result.language = this._extractField(content, '语言');
    result.stars = this._extractStars(content);
    result.domains = this._extractDomains(content);
    result.coreFunctions = this._extractCoreFunctions(content);
    result.relations = this._extractRelations(content);
    result.projectStatus = this._extractProjectStatus(content);

    return result;
  }

  /**
   * 提取单个文本字段
   * @private
   */
  _extractField(content, fieldName) {
    const regex = new RegExp(`- ${fieldName}：([^\\n]+)`);
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * 提取数值字段
   * @private
   */
  _extractNumericField(content, fieldName) {
    const regex = new RegExp(`- ${fieldName}：(\\d+)`);
    const match = content.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * 提取 Stars 数
   * @private
   */
  _extractStars(content) {
    const regex = /- GitHub Stars: ([\d,]+)/;
    const match = content.match(regex);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return 0;
  }

  /**
   * 提取领域分类
   * @private
   */
  _extractDomains(content) {
    const regex = /- 领域分类：([^\\n]+)/;
    const match = content.match(regex);
    if (match) {
      return match[1].split(/[,，]/).map(d => d.trim()).filter(Boolean);
    }
    return [];
  }

  /**
   * 提取核心功能
   * @private
   */
  _extractCoreFunctions(content) {
    const regex = /## 核心功能\n([\s\S]*?)(?=\n##|$)/;
    const match = content.match(regex);
    if (match) {
      const funcText = match[1].trim();
      return funcText
        .split(/\n- /)
        .filter(Boolean)
        .map(f => f.replace(/^- /, '').trim());
    }
    return [];
  }

  /**
   * 提取跨项目关联
   * @private
   */
  _extractRelations(content) {
    const relations = [];
    const sectionRegex = /## 跨项目关联\n([\s\S]*?)(?=\n##|$)/;
    const match = content.match(sectionRegex);

    if (match) {
      const tableContent = match[1];
      // 解析 Markdown 表格
      const rows = tableContent.split('\n').filter(row => row.trim().startsWith('|'));
      // 跳过表头行
      for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].split('|').map(cell => cell.trim()).filter(Boolean);
        if (cells.length >= 3) {
          const [project, type, description] = cells;
          const ownerRepoMatch = project.match(/^(.+)\/(.+)$/);
          if (ownerRepoMatch) {
            relations.push({
              target: project,
              type: type || '未知',
              description: description || ''
            });
          }
        }
      }
    }

    return relations;
  }

  /**
   * 提取项目状态
   * @private
   */
  _extractProjectStatus(content) {
    const regex = /## 项目状态\n([\s\S]*?)(?=\n##|$)/;
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * 解析所有项目 Wiki
   * @returns {Array} 项目对象数组
   */
  parseAllProjects() {
    if (!fs.existsSync(this.baseDir)) {
      logger.warn(`项目 Wiki 目录不存在: ${this.baseDir}`);
      return [];
    }

    const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.md'));
    const projects = [];

    for (const file of files) {
      const project = this.parseFile(path.join(this.baseDir, file));
      if (project) {
        projects.push(project);
      }
    }

    logger.debug(`解析完成: ${projects.length} 个项目`);
    return projects;
  }
}

module.exports = WikiExtractor;
