/**
 * Wiki Post Processor - Wiki 后处理模块
 * 在日报/周报/月报生成后执行 Wiki 后处理：
 * 1. 生成 Wiki 索引页
 * 2. 更新领域 Wiki 文件
 * 3. 按领域分组项目
 */

const path = require('path');
const WikiManager = require('./wiki-manager');
const WikiIndexGenerator = require('../generator/wiki-index-generator');
const CrossReferenceAnalyzer = require('./cross-reference');
const logger = require('../utils/logger');

class WikiPostProcessor {
  constructor(options = {}) {
    this.wikiManager = new WikiManager(options);
    this.indexGenerator = new WikiIndexGenerator({
      baseDir: this.wikiManager.baseDir,
      outputDir: options.outputDir || path.join(process.cwd(), 'reports')
    });
    this.analyzer = new CrossReferenceAnalyzer();
    this.domainsDir = options.domainsDir || this.wikiManager.domainsDir;
  }

  /**
   * 处理项目列表，生成 Wiki 索引和领域 Wiki
   * @param {Array} projects - 项目数组
   * @param {string} type - 报告类型 (daily/weekly/monthly)
   * @param {Object} monthlyData - 月度数据（仅月报时需要）
   * @param {Function} generateTrendAnalysis - LLM 趋势分析生成函数（可选）
   * @returns {Promise<Object>} 处理结果
   */
  async process(projects, type, monthlyData = null, generateTrendAnalysis = null) {
    try {
      logger.info(`开始 Wiki 后处理 (${type})...`);

      if (!projects || projects.length === 0) {
        logger.info('没有项目需要处理');
        // 即使没有项目，也生成索引页
        await this.indexGenerator.generate();
        return {
          success: true,
          projectsProcessed: 0,
          type
        };
      }

      // 1. 按领域分组项目
      const projectsByDomain = this._groupByDomain(projects);

      // 2. 更新每个领域的 Wiki
      for (const [domain, domainProjects] of Object.entries(projectsByDomain)) {
        if (type === 'monthly' && generateTrendAnalysis) {
          // 月报：生成 LLM 趋势分析文案
          const trendAnalysis = await generateTrendAnalysis(domain, monthlyData);
          await this._updateDomainWikiWithTrend(domain, domainProjects, monthlyData, trendAnalysis);
        } else {
          // 日报/周报：使用原有逻辑
          await this._updateDomainWiki(domain, domainProjects, type);
        }
      }

      // 3. 生成 Wiki 索引页
      await this.indexGenerator.generate();

      logger.success(`Wiki 后处理完成 (${type}) - 处理了 ${projects.length} 个项目`);

      return {
        success: true,
        projectsProcessed: projects.length,
        domainsUpdated: Object.keys(projectsByDomain).length,
        type
      };
    } catch (error) {
      logger.error(`Wiki 后处理失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 更新领域 Wiki 并添加月度趋势分析
   * @param {string} domain - 领域名称
   * @param {Array} projects - 项目数组
   * @param {Object} monthlyData - 月度数据
   * @param {string} trendAnalysis - LLM 生成的趋势分析文案
   * @returns {Promise<void>}
   */
  async _updateDomainWikiWithTrend(domain, projects, monthlyData, trendAnalysis) {
    const domainFilePath = path.join(this.domainsDir, `${domain}.md`);

    // 获取该领域所有项目（包括已有的和新加入的）
    const allDomainProjects = await this._getAllDomainProjects(domain, projects);

    // 生成领域 Wiki 内容（包含月度趋势）
    const content = this._generateDomainWikiContentWithTrend(
      domain,
      allDomainProjects,
      monthlyData,
      trendAnalysis
    );

    // 确保领域目录存在
    if (!require('fs').existsSync(this.domainsDir)) {
      require('fs').mkdirSync(this.domainsDir, { recursive: true });
    }

    require('fs').writeFileSync(domainFilePath, content, 'utf-8');
    logger.debug(`更新领域 Wiki: ${domain} (${allDomainProjects.length} 个项目)`);
  }

  /**
   * 生成领域 Wiki 内容（包含月度趋势分析）
   * @param {string} domain - 领域名称
   * @param {Array} projects - 项目数组
   * @param {Object} monthlyData - 月度数据
   * @param {string} trendAnalysis - LLM 趋势分析文案
   * @returns {string} Wiki 内容
   */
  _generateDomainWikiContentWithTrend(domain, projects, monthlyData, trendAnalysis) {
    const today = new Date().toISOString().split('T')[0];
    const icon = this._getDomainIcon(domain);

    // 计算统计数据
    const totalProjects = projects.length;
    const topProjects = projects.slice(0, 10);

    // 生成项目表格
    const projectTable = topProjects.map((p, index) => {
      const firstSeen = p.firstSeen || today;
      const appearances = p.appearances || 1;
      const stars = p.stars || '0';
      return `| ${index + 1} | [${p.owner}/${p.repo}](../../wiki/projects/${p.owner}_${p.repo}.md) | ${firstSeen} | ${appearances} | ${stars} |`;
    }).join('\n');

    // 生成趋势演变表格
    const trendTable = monthlyData?.periodStats ? `
| 时期 | 项目数 | 主导类型 |
|------|--------|----------|
| 上旬 | ${monthlyData.periodStats.early.projectCount} | ${monthlyData.periodStats.early.topType} |
| 中旬 | ${monthlyData.periodStats.mid.projectCount} | ${monthlyData.periodStats.mid.topType} |
| 下旬 | ${monthlyData.periodStats.late.projectCount} | ${monthlyData.periodStats.late.topType} |
` : '';

    // 生成月度统计
    const monthlyStats = monthlyData?.domainStats ? `
- 新上榜项目：${monthlyData.domainStats.newProjects} 个
- 重复上榜项目：${monthlyData.domainStats.recurringProjects} 个
- 总 Star 增长：+${this._formatNumber(monthlyData.domainStats.totalStarsGrowth || 0)}
` : '';

    return `# ${icon} ${domain} 领域

## 领域概览

- 项目总数：${totalProjects}
- 最近更新：${today}

${domain} 领域收录了与${this._domainDescription(domain)}相关的项目。

## 代表项目（按上榜次数排序）

| 排名 | 项目 | 首次上榜 | 上榜次数 | Stars |
|------|------|----------|----------|-------|
${projectTable}

## 📈 ${monthlyData?.month || '本月'} 月度趋势

**领域热度**: ${trendAnalysis}

**趋势演变**:
${trendTable}

**月度统计**:
${monthlyStats}

## 领域趋势

${this._generateDomainTrend(domain, projects)}

---

*本页面由 WikiPostProcessor 自动生成*
`;
  }

  /**
   * 格式化数字（添加 k 后缀）
   * @param {number} num - 数字
   * @returns {string} 格式化后的字符串
   */
  _formatNumber(num) {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return String(num);
  }

  /**
   * 获取领域图标
   * @param {string} domain - 领域名称
   * @returns {string} 图标 emoji
   */
  _getDomainIcon(domain) {
    const icons = {
      agent: '🤖',
      rag: '🔍',
      llm: '🧠',
      speech: '🎤',
      vision: '👁️',
      browser: '🌐',
      devtool: '🛠️',
      'dev-tool': '🛠️',
      platform: '🎛️',
      infrastructure: '☁️',
      education: '📚',
      game: '🎮',
      physics: '⚛️',
      finance: '💰',
      security: '🔒',
      data: '📊',
      other: '📦'
    };
    return icons[domain.toLowerCase()] || '📦';
  }

  /**
   * 按领域分组项目
   * @param {Array} projects - 项目数组
   * @returns {Object} 按领域分组的对象
   */
  _groupByDomain(projects) {
    const groups = {};
    for (const project of projects) {
      // 标准化 owner/repo - 处理 repo 字段可能已包含 owner 的情况
      let owner = project.owner || project.owner_login;
      let repo = project.repo || project.name;

      // 如果 repo 包含斜杠，说明是 fullName 格式，需要拆分
      if (repo && repo.includes('/')) {
        const parts = repo.split('/');
        if (parts.length === 2) {
          owner = parts[0];
          repo = parts[1];
        }
      }

      // 如果 owner 仍然为空，尝试从 fullName 提取
      if (!owner && project.fullName) {
        const parts = project.fullName.split('/');
        if (parts.length === 2) {
          owner = parts[0];
          repo = parts[1];
        }
      }

      const domain = (project.domain || project.analysis?.type || 'other').toLowerCase();
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push({
        ...project,
        owner,
        repo
      });
    }
    return groups;
  }

  /**
   * 更新领域 Wiki 文件
   * @param {string} domain - 领域名称
   * @param {Array} projects - 该领域的项目数组
   * @param {string} type - 报告类型
   */
  async _updateDomainWiki(domain, projects, type) {
    const domainFilePath = path.join(this.domainsDir, `${domain}.md`);

    // 获取该领域所有项目（包括已有的和新加入的）
    const allDomainProjects = await this._getAllDomainProjects(domain, projects);

    // 生成领域 Wiki 内容
    const content = this._generateDomainWikiContent(domain, allDomainProjects, type);

    // 写入文件
    if (!this.wikiManager.ensureDirectories) {
      // 确保领域目录存在
      if (!require('fs').existsSync(this.domainsDir)) {
        require('fs').mkdirSync(this.domainsDir, { recursive: true });
      }
    }

    require('fs').writeFileSync(domainFilePath, content, 'utf-8');
    logger.debug(`更新领域 Wiki: ${domain} (${allDomainProjects.length} 个项目)`);
  }

  /**
   * 获取领域的所有项目（合并已有项目和新项目）
   * @param {string} domain - 领域名称
   * @param {Array} newProjects - 新项目数组
   * @returns {Array} 合并后的项目数组
   */
  async _getAllDomainProjects(domain, newProjects) {
    const fs = require('fs');
    const domainFilePath = path.join(this.domainsDir, `${domain}.md`);

    // 如果领域 Wiki 已存在，解析已有项目
    if (fs.existsSync(domainFilePath)) {
      const existingContent = fs.readFileSync(domainFilePath, 'utf-8');
      const existingProjects = this._parseDomainWikiProjects(existingContent);

      // 合并新项目（避免重复）
      const newProjectKeys = new Set(newProjects.map(p => `${p.owner}/${p.repo}`.toLowerCase()));
      const mergedProjects = [
        ...existingProjects.filter(p => !newProjectKeys.has(`${p.owner}/${p.repo}`.toLowerCase())),
        ...newProjects
      ];

      // 按上榜次数降序排序
      mergedProjects.sort((a, b) => (b.appearances || 0) - (a.appearances || 0));

      return mergedProjects;
    }

    return newProjects;
  }

  /**
   * 从领域 Wiki 内容中解析项目列表
   * @param {string} content - Wiki 内容
   * @returns {Array} 项目数组
   */
  _parseDomainWikiProjects(content) {
    const projects = [];
    const lines = content.split('\n');

    let inTable = false;
    for (const line of lines) {
      // 检测表格开始
      if (line.includes('| 项目 |') || line.includes('| Project |')) {
        inTable = true;
        continue;
      }

      // 检测表格分隔行
      if (inTable && line.includes('|---')) {
        continue;
      }

      // 解析项目行 - 支持 markdown 链接格式 [owner/repo](path)
      if (inTable && line.includes('|')) {
        // 匹配 [owner/repo](path) 格式
        const linkMatch = line.match(/\[([^\]]+)\/([^\]]+)\]\([^)]+\)/);
        if (linkMatch) {
          // 从行中提取其他字段 (首次上榜 | 上榜次数 | Stars)
          const parts = line.split('|').map(p => p.trim()).filter(p => p);
          // parts[0] = 排名，parts[1] = 项目链接，parts[2] = 首次上榜，parts[3] = 上榜次数，parts[4] = Stars
          const firstSeen = parts[2] || '';
          const appearances = parseInt(parts[3]) || 0;
          const stars = parts[4] || '0';

          projects.push({
            owner: linkMatch[1].trim(),
            repo: linkMatch[2].trim(),
            firstSeen,
            appearances,
            stars
          });
        }
      }

      // 检测表格结束
      if (inTable && line.trim() === '') {
        inTable = false;
      }
    }

    return projects;
  }

  /**
   * 生成领域 Wiki 内容
   * @param {string} domain - 领域名称
   * @param {Array} projects - 项目数组
   * @param {string} type - 报告类型
   * @returns {string} Wiki 内容
   */
  _generateDomainWikiContent(domain, projects, type) {
    const today = new Date().toISOString().split('T')[0];

    // 领域图标映射
    const domainIcons = {
      agent: '🤖',
      rag: '🔍',
      llm: '🧠',
      speech: '🎤',
      vision: '👁️',
      browser: '🌐',
      devtool: '🛠️',
      'dev-tool': '🛠️',
      platform: '🎛️',
      infrastructure: '☁️',
      education: '📚',
      game: '🎮',
      physics: '⚛️',
      finance: '💰',
      security: '🔒',
      data: '📊',
      other: '📦'
    };

    const icon = domainIcons[domain.toLowerCase()] || '📦';

    // 计算统计数据
    const totalProjects = projects.length;
    const topProjects = projects.slice(0, 10); // 取前 10 个代表项目

    // 生成项目表格
    const projectTable = topProjects.map((p, index) => {
      const firstSeen = p.firstSeen || today;
      const appearances = p.appearances || 1;
      const stars = p.stars || '0';
      return `| ${index + 1} | [${p.owner}/${p.repo}](../../wiki/projects/${p.owner}_${p.repo}.md) | ${firstSeen} | ${appearances} | ${stars} |`;
    }).join('\n');

    return `# ${icon} ${domain} 领域

## 领域概览

- 项目总数：${totalProjects}
- 最近更新：${today}
- 报告类型：${type}

${domain} 领域收录了与${this._domainDescription(domain)}相关的项目。

## 代表项目（按上榜次数排序）

| 排名 | 项目 | 首次上榜 | 上榜次数 | Stars |
|------|------|----------|----------|-------|
${projectTable}

## 领域趋势

${this._generateDomainTrend(domain, projects)}

---

*本页面由 WikiPostProcessor 自动生成*
`;
  }

  /**
   * 生成领域描述
   * @param {string} domain - 领域名称
   * @returns {string} 领域描述
   */
  _domainDescription(domain) {
    const descriptions = {
      agent: 'AI Agent、智能体、多智能体协作、自动化',
      rag: 'RAG、检索增强生成、知识库、向量检索',
      llm: '大语言模型、Transformer、基础模型',
      speech: '语音识别、语音合成、音频处理',
      vision: '计算机视觉、图像处理、视频分析',
      browser: '浏览器自动化、网页交互',
      devtool: '开发工具、IDE 插件、代码辅助',
      'dev-tool': '开发工具、IDE 插件、代码辅助',
      platform: 'AI 平台、低代码平台',
      infrastructure: 'AI 基础设施、云服务、部署工具',
      education: 'AI 教育、学习资源、教程',
      game: 'AI 游戏、游戏 AI、互动娱乐',
      physics: '物理模拟、科学计算',
      finance: 'AI 金融、量化交易、风控',
      security: 'AI 安全、隐私保护、威胁检测',
      data: '数据分析、数据可视化、大数据',
      other: '其他 AI 相关技术'
    };
    return descriptions[domain.toLowerCase()] || 'AI 相关技术';
  }

  /**
   * 生成领域趋势分析
   * @param {string} domain - 领域名称
   * @param {Array} projects - 项目数组
   * @returns {string} 趋势分析文本
   */
  _generateDomainTrend(domain, projects) {
    if (projects.length === 0) {
      return '暂无数据';
    }

    // 计算平均上榜次数
    const totalAppearances = projects.reduce((sum, p) => sum + (p.appearances || 1), 0);
    const avgAppearances = (totalAppearances / projects.length).toFixed(1);

    // 计算总 Stars 数（简单处理）- 兼容数字和字符串
    const totalStars = projects.reduce((sum, p) => {
      const starsStr = typeof p.stars === 'number' ? String(p.stars) : (p.stars || '0');
      const stars = parseInt(starsStr.replace(/,/g, ''));
      return sum + stars;
    }, 0);

    // 找出最热门的项目 - 兼容数字和字符串
    const topProject = projects.reduce((max, p) => {
      const pStarsStr = typeof p.stars === 'number' ? String(p.stars) : (p.stars || '0');
      const maxStarsStr = typeof max.stars === 'number' ? String(max.stars) : (max.stars || '0');
      const pStars = parseInt(pStarsStr.replace(/,/g, ''));
      const maxStars = parseInt(maxStarsStr.replace(/,/g, ''));
      return pStars > maxStars ? p : max;
    }, projects[0]);

    return `
- 平均上榜次数：${avgAppearances}
- 总 Stars 数：${totalStars.toLocaleString()}
- 最热项目：[${topProject.owner}/${topProject.repo}](../../wiki/projects/${topProject.owner}_${topProject.repo}.md) (${topProject.stars || '0'} ⭐)
`;
  }
}

module.exports = WikiPostProcessor;
