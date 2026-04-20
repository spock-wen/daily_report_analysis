/**
 * Wiki Manager - Wiki 读写管理
 * 负责 GitHub 项目和领域 Wiki 的创建、读取、更新
 */

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('./wiki-templates');
const { renderTemplateV2, generateProjectOverview, generateTechStack } = require('./wiki-templates-v2');
const logger = require('../utils/logger');

class WikiManager {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), 'wiki');
    this.projectsDir = path.join(this.baseDir, 'projects');
    this.domainsDir = path.join(this.baseDir, 'domains');

    // 确保目录存在
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.projectsDir, this.domainsDir].forEach(dir => {
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
   * 创建项目 Wiki（优化版 v2）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} data - Wiki 数据
   * @returns {Promise<string>} Wiki 文件路径
   */
  async createProjectWikiV2(owner, repo, data) {
    const { exists, path: wikiPath } = await this.getOrCreateWiki(owner, repo);
    if (exists) {
      logger.warn(`Wiki 已存在：${owner}/${repo}`);
      return wikiPath;
    }

    // 确保核心功能不为空
    let coreFunctions = data.coreFunctions || [];
    if (!coreFunctions.length && data.description) {
      // 从描述生成基本功能
      coreFunctions = [data.description];
    }
    if (!coreFunctions.length) {
      coreFunctions = [`参见 [README](https://github.com/${owner}/${repo})`];
    }

    const content = renderTemplateV2('project_v2', {
      owner,
      repo,
      firstSeen: data.firstSeen || new Date().toISOString().split('T')[0],
      lastSeen: data.lastSeen || data.firstSeen,
      appearances: data.appearances || '1',
      domain: data.domain || 'general',
      language: data.language || 'Unknown',
      stars: data.stars || '0',
      projectStatus: this._getProjectStatus(data.stars),
      projectOverview: generateProjectOverview({
        owner,
        repo,
        description: data.description,
        coreFunctions,
        domain: data.domain,
        stars: data.stars
      }),
      coreFunctions: coreFunctions.map(f => `- ${f}`).join('\n'),
      techStack: generateTechStack({
        language: data.language,
        topics: data.topics || []
      }),
      versionHistory: data.versionHistory || '',
      crossReferences: data.crossReferences || '（待分析）',
      notes: data.notes || '（暂无备注）'
    });

    fs.writeFileSync(wikiPath, content, 'utf-8');
    logger.success(`创建项目 Wiki (v2): ${owner}/${repo}`);
    return wikiPath;
  }

  /**
   * 获取项目状态描述
   * @param {string|number} stars - Star 数
   * @returns {string} 状态描述
   */
  _getProjectStatus(stars) {
    const starsNum = parseInt(String(stars).replace(/,/g, '').replace(/k/, '000') || '0');
    if (starsNum >= 50000) return '⭐ 明星项目';
    if (starsNum >= 20000) return '🌟 热门项目';
    if (starsNum >= 5000) return '💎 优质项目';
    if (starsNum >= 1000) return '📈 成长项目';
    return '🌱 新兴项目';
  }

  /**
   * 追加版本记录到项目 Wiki（优化版）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} versionData - 版本数据
   * @param {boolean} useV2 - 是否使用 v2 模板格式
   * @returns {Promise<void>}
   */
  async appendVersion(owner, repo, versionData, useV2 = true) {
    const wiki = await this.getOrCreateWiki(owner, repo);
    let content = wiki.content || '';

    // 如果没有内容，先创建基本结构（包含分析数据）
    if (!content) {
      if (useV2) {
        await this.createProjectWikiV2(owner, repo, {
          firstSeen: versionData.date,
          lastSeen: versionData.date,
          appearances: versionData.appearances || '1',
          stars: versionData.stars || '0',
          language: versionData.language || 'Unknown',
          domain: versionData.domain || 'general',
          description: versionData.description,
          coreFunctions: versionData.coreFunctions,
          topics: versionData.topics || [],
          versionHistory: this._buildVersionHistoryEntry(versionData)
        });
      } else {
        await this.createProjectWiki(owner, repo, {
          firstSeen: versionData.date,
          lastSeen: versionData.date,
          appearances: versionData.appearances || '1',
          stars: versionData.stars || '0',
          language: versionData.language || 'Unknown',
          domain: versionData.domain || 'General',
          coreFunctions: versionData.coreFunctions,
          useCases: versionData.useCases,
          versionHistory: this._buildVersionHistoryEntry(versionData)
        });
      }
      return;
    }

    // 去重检查：检查是否已存在相同的 date + eventType 组合
    const versionKey = `### ${versionData.date}（${versionData.eventType}）`;
    if (content.includes(versionKey)) {
      logger.debug(`跳过重复版本：${owner}/${repo} - ${versionData.date} ${versionData.eventType}`);
      return;
    }

    // 追加版本历史
    const versionSection = this._buildVersionHistoryEntry(versionData);

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
   * 构建版本历史条目
   * @param {Object} versionData - 版本数据
   * @returns {string} 版本历史 Markdown
   */
  _buildVersionHistoryEntry(versionData) {
    return `
### ${versionData.date}（${versionData.eventType}）
**来源**: ${versionData.source}
**分析**: ${versionData.analysis}
`;
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
      domains: countFiles(this.domainsDir),
      total: countFiles(this.projectsDir) + countFiles(this.domainsDir)
    };
  }

  /**
   * 读取项目最近 N 条版本历史
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {number} limit - 返回条数上限
   * @returns {Promise<Array>} 历史记录数组
   */
  async getRecentHistory(owner, repo, limit = 3) {
    const wiki = await this.getOrCreateWiki(owner, repo);
    if (!wiki.exists || !wiki.content) {
      return [];
    }

    const history = [];
    const seen = new Set(); // 用于去重：key = "date-eventType"

    // 解析版本历史 - 匹配 ### YYYY-MM-DD（事件类型）格式
    const versionRegex = /### (\d{4}-\d{2}-\d{2})（([^)]+)）\s*\*\*来源\*\*:([\s\S]*?)\*\*分析\*\*:(.+?)(?=\n###|\n##|$)/gs;
    let match;

    while ((match = versionRegex.exec(wiki.content)) !== null) {
      const date = match[1];
      const eventType = match[2].trim();
      const analysis = match[4].trim();
      const key = `${date}-${eventType}`;

      // 跳过重复记录
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      history.push({
        date,
        eventType,
        analysis
      });
    }

    // 按日期倒序排序，返回最近 N 条
    history.sort((a, b) => b.date.localeCompare(a.date));
    return history.slice(0, limit);
  }

  /**
   * 更新分析信息（核心功能、适用场景等）
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} analysisData - 分析数据
   * @param {Array} analysisData.coreFunctions - 核心功能列表
   * @param {Array} analysisData.useCases - 适用场景列表
   * @param {Array} analysisData.trends - 趋势分析列表
   * @returns {Promise<void>}
   */
  async updateAnalysisInfo(owner, repo, analysisData) {
    const wiki = await this.getOrCreateWiki(owner, repo);
    if (!wiki.exists || !wiki.content) return;

    let content = wiki.content;

    // 更新核心功能
    if (analysisData.coreFunctions && analysisData.coreFunctions.length > 0) {
      const coreFunctionsMarkdown = analysisData.coreFunctions.map(f => `- ${f}`).join('\n');
      content = content.replace(
        /## 核心功能\n([\s\S]*?)(?=\n## )/,
        `## 核心功能\n${coreFunctionsMarkdown}\n\n`
      );
    }

    fs.writeFileSync(wiki.path, content, 'utf-8');
    logger.debug(`更新分析信息：${owner}/${repo}`);
  }

  /**
   * 为项目 Wiki 添加月度汇总版本
   * @param {string} owner - 仓库所有者
   * @param {string} repo - 仓库名
   * @param {Object} monthlyData - 月度汇总数据
   * @param {string} monthlyData.month - 月份标识 (YYYY-MM)
   * @param {number} monthlyData.appearances - 本月总上榜次数
   * @param {number} monthlyData.dailyAppearances - 日报上榜次数
   * @param {number} monthlyData.weeklyAppearances - 周报上榜次数
   * @param {Object} monthlyData.trendRole - 趋势角色描述
   * @param {string} monthlyData.trendRole.early - 上旬描述
   * @param {string} monthlyData.trendRole.mid - 中旬描述
   * @param {string} monthlyData.trendRole.late - 下旬描述
   * @param {string} monthlyData.reportUrl - 月报 HTML 链接
   * @param {string} [monthlyData.stars] - Star 数 (用于创建新 Wiki)
   * @param {string} [monthlyData.language] - 语言 (用于创建新 Wiki)
   * @param {string} [monthlyData.domain] - 领域 (用于创建新 Wiki)
   * @returns {Promise<void>}
   */
  async appendMonthlySummary(owner, repo, monthlyData) {
    const wiki = await this.getOrCreateWiki(owner, repo);
    let content = wiki.content || '';

    // 如果没有内容，先创建基本 Wiki
    if (!content) {
      await this.createProjectWiki(owner, repo, {
        firstSeen: monthlyData.month,
        lastSeen: monthlyData.month,
        appearances: String(monthlyData.appearances),
        domain: monthlyData.domain || 'general',
        language: monthlyData.language || 'Unknown',
        stars: monthlyData.stars || '0'
      });
      // 重新读取刚创建的内容
      const newWiki = await this.getOrCreateWiki(owner, repo);
      content = newWiki.content || '';
    }

    // 构建月度汇总条目
    const monthlySection = this._buildMonthlySummaryEntry(monthlyData);

    // 去重检查：检查是否已存在相同的月度汇总
    const monthlyKey = `### ${monthlyData.month}（月度汇总）`;
    if (content.includes(monthlyKey)) {
      logger.debug(`跳过重复月度汇总：${owner}/${repo} - ${monthlyData.month}`);
      return;
    }

    // 追加到版本历史部分
    if (content.includes('## 版本历史')) {
      content = content.replace(
        /(## 版本历史\n)/,
        `$1${monthlySection}\n`
      );
    } else {
      // 如果没有版本历史部分，添加到末尾
      content = content + `\n\n## 版本历史\n${monthlySection}`;
    }

    // 更新基本信息中的上榜次数
    if (monthlyData.appearances) {
      content = content.replace(
        /- 上榜次数：\d+/,
        `- 上榜次数：${monthlyData.appearances}`
      );
    }

    fs.writeFileSync(wiki.path, content, 'utf-8');
    logger.info(`已添加月度汇总：${owner}/${repo} - ${monthlyData.month}`);
  }

  /**
   * 构建月度汇总条目
   * @param {Object} monthlyData - 月度数据
   * @returns {string} 月度汇总 Markdown
   */
  _buildMonthlySummaryEntry(monthlyData) {
    const { month, appearances, dailyAppearances, weeklyAppearances, trendRole, reportUrl } = monthlyData;

    return `### ${month}（月度汇总）
**上榜次数**: ${appearances} 次 (日报 ${dailyAppearances} 次 + 周报 ${weeklyAppearances} 次)
**趋势角色**:
- 上旬：${trendRole.early || '暂无描述'}
- 中旬：${trendRole.mid || '暂无描述'}
- 下旬：${trendRole.late || '暂无描述'}

**来源**: [月报 ${month}](${reportUrl})
`;
  }
}

module.exports = WikiManager;
