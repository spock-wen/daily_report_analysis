/**
 * Wiki Manager - Wiki 读写管理
 * 负责 GitHub 项目和论文 Wiki 的创建、读取、更新
 */

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('./wiki-templates');
const logger = require('../utils/logger');

class WikiManager {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), 'wiki');
    this.projectsDir = path.join(this.baseDir, 'projects');
    this.papersDir = path.join(this.baseDir, 'papers');
    this.domainsDir = path.join(this.baseDir, 'domains');

    // 确保目录存在
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.projectsDir, this.papersDir, this.domainsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 读取项目 Wiki（如果不存在则创建）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @returns {Promise<Object>} Wiki 内容和元数据
   */
  async getOrCreateWiki(owner, repo) {
    const fileName = `${owner}_${repo}.md`;
    const wikiPath = path.join(this.projectsDir, fileName);

    if (fs.existsSync(wikiPath)) {
      const content = fs.readFileSync(wikiPath, 'utf-8');
      logger.debug(`读取项目 Wiki: ${owner}/${repo}`);
      return {
        exists: true,
        path: wikiPath,
        fileName,
        content,
        owner,
        repo
      };
    } else {
      logger.debug(`创建新项目 Wiki: ${owner}/${repo}`);
      return {
        exists: false,
        path: wikiPath,
        fileName,
        content: null,
        owner,
        repo
      };
    }
  }

  /**
   * 读取论文 Wiki（如果不存在则返回 null）
   * @param {string} arxivId - arXiv ID
   * @returns {Promise<Object|null>}
   */
  async getPaperWiki(arxivId) {
    const fileName = `${arxivId}.md`;
    const wikiPath = path.join(this.papersDir, fileName);

    if (fs.existsSync(wikiPath)) {
      const content = fs.readFileSync(wikiPath, 'utf-8');
      return {
        exists: true,
        path: wikiPath,
        fileName,
        content,
        arxivId
      };
    }

    return null;
  }

  /**
   * 创建项目 Wiki
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} data - Wiki 数据
   * @returns {Promise<string>} Wiki 文件路径
   */
  async createProjectWiki(owner, repo, data) {
    const { exists, path: wikiPath } = await this.getOrCreateWiki(owner, repo);
    if (exists) {
      logger.warn(`Wiki 已存在：${owner}/${repo}`);
      return wikiPath;
    }

    const content = renderTemplate('project', {
      owner,
      repo,
      firstSeen: data.firstSeen || new Date().toISOString().split('T')[0],
      lastSeen: data.lastSeen || data.firstSeen,
      appearances: data.appearances || '1',
      domain: data.domain || 'General',
      language: data.language || 'Unknown',
      stars: data.stars || '0',
      coreFunctions: data.coreFunctions ? data.coreFunctions.map(f => `- ${f}`).join('\n') : '',
      versionHistory: data.versionHistory || '',
      crossReferences: data.crossReferences || ''
    });

    fs.writeFileSync(wikiPath, content, 'utf-8');
    logger.success(`创建项目 Wiki: ${owner}/${repo}`);
    return wikiPath;
  }

  /**
   * 创建论文 Wiki
   * @param {string} arxivId - arXiv ID
   * @param {Object} data - 论文数据
   * @returns {Promise<string>} Wiki 文件路径
   */
  async createPaperWiki(arxivId, data) {
    const existing = await this.getPaperWiki(arxivId);
    if (existing) {
      logger.warn(`论文 Wiki 已存在：${arxivId}`);
      return existing.path;
    }

    const fileName = `${arxivId}.md`;
    const wikiPath = path.join(this.papersDir, fileName);

    const content = renderTemplate('paper', {
      title: data.title || 'Untitled',
      arxivId,
      publishDate: data.publishDate || '',
      firstRecorded: data.firstRecorded || new Date().toISOString().split('T')[0],
      paperType: data.paperType || 'Research',
      domain: data.domain || 'General',
      authors: Array.isArray(data.authors) ? data.authors.join(', ') : (data.authors || ''),
      contributions: data.contributions ? data.contributions.map(c => `- ${c}`).join('\n') : '',
      githubLinks: data.githubLinks || '',
      analysis: data.analysis || '',
      crossReferences: data.crossReferences || '',
      bibtex: data.bibtex || ''
    });

    fs.writeFileSync(wikiPath, content, 'utf-8');
    logger.success(`创建论文 Wiki: ${arxivId}`);
    return wikiPath;
  }

  /**
   * 追加版本记录到项目 Wiki
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} versionData - 版本数据
   * @returns {Promise<void>}
   */
  async appendVersion(owner, repo, versionData) {
    const wiki = await this.getOrCreateWiki(owner, repo);
    let content = wiki.content || '';

    // 如果没有内容，先创建基本结构
    if (!content) {
      await this.createProjectWiki(owner, repo, {
        firstSeen: versionData.date,
        lastSeen: versionData.date,
        appearances: '1',
        ...versionData
      });
      return;
    }

    // 追加版本历史
    const versionSection = `
### ${versionData.date}（${versionData.eventType}）
**来源**: ${versionData.source}
**分析**: ${versionData.analysis}
`;

    // 检查是否已存在版本历史部分
    if (content.includes('## 版本历史')) {
      // 追加到版本历史后面
      content = content.replace(
        /(## 跨项目关联)/s,
        `${versionSection}\n$1`
      );
    } else {
      // 添加版本历史部分
      content = content.replace(
        /(## 核心功能[\s\S]*?)(\n##|$)/s,
        `$1\n\n## 版本历史\n${versionSection}$2`
      );
    }

    fs.writeFileSync(wiki.path, content, 'utf-8');
    logger.debug(`追加版本记录：${owner}/${repo} - ${versionData.date}`);
  }

  /**
   * 更新基本信息（上榜次数、最近日期等）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} newData - 新数据
   * @returns {Promise<void>}
   */
  async updateBasicInfo(owner, repo, newData) {
    const wiki = await this.getOrCreateWiki(owner, repo);
    if (!wiki.exists || !wiki.content) return;

    let content = wiki.content;

    // 更新上榜次数
    if (newData.appearances) {
      content = content.replace(
        /- 上榜次数：\d+/,
        `- 上榜次数：${newData.appearances}`
      );
    }

    // 更新最近上榜日期
    if (newData.lastSeen) {
      content = content.replace(
        /- 最近上榜：[\d-]+/,
        `- 最近上榜：${newData.lastSeen}`
      );
    }

    // 更新 Stars
    if (newData.stars) {
      content = content.replace(
        /- GitHub Stars: [\d,]+(?:（最后更新：[\d-]+）)?/,
        `- GitHub Stars: ${newData.stars}（最后更新：${newData.starsDate || new Date().toISOString().split('T')[0]}）`
      );
    }

    fs.writeFileSync(wiki.path, content, 'utf-8');
    logger.debug(`更新基本信息：${owner}/${repo}`);
  }

  /**
   * 扫描所有 Wiki 获取跨项目关联
   * @param {Object} project - 当前项目
   * @returns {Promise<Array>} 关联项目列表
   */
  async findRelatedProjects(project) {
    const files = fs.readdirSync(this.projectsDir);
    const related = [];

    // 基于领域分类查找
    if (project.domain) {
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = fs.readFileSync(path.join(this.projectsDir, file), 'utf-8');
        if (content.includes(`领域分类：${project.domain}`)) {
          const match = file.match(/^(.+)_(.+)\.md$/);
          if (match) {
            related.push({
              owner: match[1],
              repo: match[2],
              reason: '同领域'
            });
          }
        }
      }
    }

    // 基于技术栈查找（简单关键词匹配）
    if (project.language) {
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = fs.readFileSync(path.join(this.projectsDir, file), 'utf-8');
        if (content.includes(`语言：${project.language}`)) {
          const match = file.match(/^(.+)_(.+)\.md$/);
          if (match) {
            const name = `${match[1]}/${match[2]}`;
            if (!related.find(r => r.owner === match[1] && r.repo === match[2])) {
              related.push({
                owner: match[1],
                repo: match[2],
                reason: '同技术栈'
              });
            }
          }
        }
      }
    }

    return related.slice(0, 5); // 最多返回 5 个关联项目
  }

  /**
   * 更新跨论文关联（被引用时）
   * @param {string} citedArxivId - 被引用的论文 ID
   * @param {string} citingArxivId - 引用方的论文 ID
   * @returns {Promise<void>}
   */
  async addCitationLink(citedArxivId, citingArxivId) {
    const wiki = await this.getPaperWiki(citedArxivId);
    if (!wiki) {
      logger.warn(`被引用论文 Wiki 不存在：${citedArxivId}`);
      return;
    }

    let content = wiki.content;
    const citationLink = `[${citingArxivId}](${citingArxivId}.md)`;

    // 检查是否已存在关联
    if (content.includes(citationLink)) {
      return;
    }

    // 添加被引用关联
    if (content.includes('## 跨论文关联')) {
      content = content.replace(
        /(## 跨论文关联\n)/,
        `- 被引用：${citationLink}（${new Date().toISOString().split('T')[0]}）\n$1`
      );
    }

    fs.writeFileSync(wiki.path, content, 'utf-8');
    logger.debug(`添加引用关联：${citedArxivId} <- ${citingArxivId}`);
  }

  /**
   * 获取 Wiki 统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    const countFiles = (dir) => {
      if (!fs.existsSync(dir)) return 0;
      return fs.readdirSync(dir).filter(f => f.endsWith('.md')).length;
    };

    return {
      projects: countFiles(this.projectsDir),
      papers: countFiles(this.papersDir),
      domains: countFiles(this.domainsDir),
      total: countFiles(this.projectsDir) + countFiles(this.papersDir) + countFiles(this.domainsDir)
    };
  }
}

module.exports = WikiManager;
