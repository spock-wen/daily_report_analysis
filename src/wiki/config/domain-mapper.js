/**
 * DomainMapper - 领域映射模块
 * 负责从 Wiki 领域文件构建领域→超级领域的映射
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

class DomainMapper {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), 'wiki', 'domains');
    this.domainToSuperDomain = new Map();
    this.superDomains = new Map();
    this._initSuperDomains();
  }

  /**
   * 初始化超级领域定义（共 6 个）
   */
  _initSuperDomains() {
    this.superDomains.set('ai-applications', {
      name: 'AI 应用',
      icon: '🤖',
      domains: ['agent', 'ai-agent', 'multi-agent', 'rag', 'memory', 'finance', 'browser', 'android', 'coding-agent', 'llm-applications', 'speech', 'vision', 'scientific', 'trading', 'chatbot', 'orchestration']
    });

    this.superDomains.set('ai-infrastructure', {
      name: 'AI 基础设施',
      icon: '☁️',
      domains: ['llm', 'ml-framework', 'inference', 'performance', 'cloud', 'containerization', 'vertex-ai', 'generative-ai', 'machine-learning', 'education', 'tutorial', 'framework', 'applications', 'model']
    });

    this.superDomains.set('multimodal', {
      name: '多模态',
      icon: '🎨',
      domains: ['vision', 'speech', 'audio', 'multimodal', 'image', 'video', 'tts', 'stt', 'ocr']
    });

    this.superDomains.set('developer-tools', {
      name: '开发者工具',
      icon: '🛠️',
      domains: ['devtool', 'dev-tool', 'developer-tools', 'cli', 'plugins', 'mcp', 'general', 'other', 'security', 'privacy', 'sandbox', 'testing', 'code-analysis', 'debugging']
    });

    this.superDomains.set('data-engineering', {
      name: '数据工程',
      icon: '📊',
      domains: ['data-pipeline', 'etl', 'data-processing', 'context-database', 'knowledge-base', 'retrieval', 'data-extraction', 'pdf', 'document']
    });

    this.superDomains.set('security-privacy', {
      name: '安全与隐私',
      icon: '🔒',
      domains: ['security', 'privacy', 'sandbox', 'osint', 'reconnaissance', 'penetration-testing', 'cybersecurity', 'vulnerability']
    });
  }

  /**
   * 从领域 Wiki 文件构建映射表
   */
  async buildMapping() {
    logger.debug('开始构建领域映射...');

    if (!fs.existsSync(this.baseDir)) {
      logger.warn(`领域目录不存在: ${this.baseDir}`);
      return;
    }

    const files = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const domain = path.basename(file, '.md');
      const superDomain = this._mapToSuperDomain(domain);
      this.domainToSuperDomain.set(domain, superDomain);
    }

    logger.debug(`领域映射构建完成: ${this.domainToSuperDomain.size} 个领域`);
  }

  /**
   * 将子领域映射到超级领域
   * @param {string} domain - 子领域名称
   * @returns {string} 超级领域 key
   */
  _mapToSuperDomain(domain) {
    const lowerDomain = domain.toLowerCase().trim();

    for (const [key, superDomain] of this.superDomains.entries()) {
      if (superDomain.domains.includes(lowerDomain)) {
        return key;
      }
    }

    // 尝试模糊匹配
    for (const [key, superDomain] of this.superDomains.entries()) {
      for (const knownDomain of superDomain.domains) {
        if (lowerDomain.includes(knownDomain) || knownDomain.includes(lowerDomain)) {
          return key;
        }
      }
    }

    // 默认返回 developer-tools（通用工具）
    return 'developer-tools';
  }

  /**
   * 获取子领域对应的超级领域
   * @param {string} domain - 子领域
   * @returns {string|null} 超级领域 key
   */
  getSuperDomain(domain) {
    if (this.domainToSuperDomain.size === 0) {
      // 如果尚未构建映射，先尝试构建
      this._mapToSuperDomain(domain);
    }
    return this.domainToSuperDomain.get(domain) || this._mapToSuperDomain(domain);
  }

  /**
   * 获取多个领域对应的超级领域数组
   * @param {string[]} domains - 领域数组
   * @returns {string[]} 去重后的超级领域数组
   */
  getSuperDomains(domains) {
    if (!domains || !Array.isArray(domains)) return [];

    const superDomainSet = new Set();
    for (const domain of domains) {
      const sd = this.getSuperDomain(domain);
      if (sd) superDomainSet.add(sd);
    }
    return Array.from(superDomainSet);
  }

  /**
   * 获取超级领域详情
   * @param {string} superDomainKey - 超级领域 key
   * @returns {Object|null} 超级领域对象
   */
  getSuperDomainInfo(superDomainKey) {
    return this.superDomains.get(superDomainKey) || null;
  }

  /**
   * 获取所有超级领域列表
   * @returns {Array} 超级领域数组
   */
  getAllSuperDomains() {
    const result = [];
    for (const [key, info] of this.superDomains.entries()) {
      result.push({
        key,
        name: info.name,
        icon: info.icon,
        domains: info.domains
      });
    }
    return result;
  }

  /**
   * 获取指定超级领域下的所有子领域
   * @param {string} superDomainKey - 超级领域 key
   * @returns {string[]} 子领域数组
   */
  getDomainsBySuperDomain(superDomainKey) {
    const superDomain = this.superDomains.get(superDomainKey);
    return superDomain ? superDomain.domains : [];
  }
}

module.exports = DomainMapper;
