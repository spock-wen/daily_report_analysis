const BaseScraper = require('./base-scraper');
const GitHubTrendingParser = require('./parsers/github-trending-parser');
const logger = require('../utils/logger');

/**
 * GitHubScraper - GitHub Trending 抓取器
 * 继承 BaseScraper，实现 GitHub Trending 页面的抓取逻辑
 * 
 * 支持类型：
 * - daily: 每日趋势
 * - weekly: 每周趋势
 * - monthly: 每月趋势
 */
class GitHubScraper extends BaseScraper {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.type - 抓取类型 (daily/weekly/monthly)
   * @param {string} options.language - 筛选的编程语言（可选）
   * @param {string} options.name - 抓取器名称（可选，默认 'GitHubScraper'）
   */
  constructor(options = {}) {
    const type = options.type || 'daily';
    const language = options.language || '';
    const url = GitHubScraper.buildURL(type, language);
    
    super({
      name: options.name || 'GitHubScraper',
      url: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: options.timeout || 30000
    });

    this.type = type;
    this.language = language;
    this.parser = new GitHubTrendingParser({
      language: language,
      since: type
    });
  }

  /**
   * 构建 GitHub Trending URL
   * @param {string} type - 类型 (daily/weekly/monthly)
   * @param {string} language - 编程语言（可选）
   * @returns {string} GitHub Trending URL
   */
  static buildURL(type, language = '') {
    const validTypes = ['daily', 'weekly', 'monthly'];
    const since = validTypes.includes(type) ? type : 'daily';
    
    let url = `https://github.com/trending?since=${since}`;
    
    if (language && typeof language === 'string') {
      // URL 编码语言名称，处理空格和特殊字符
      const encodedLanguage = encodeURIComponent(language.trim());
      url += `&spoken_language_code=&language=${encodedLanguage}`;
    }
    
    return url;
  }

  /**
   * 获取当前类型
   * @returns {string} 类型 (daily/weekly/monthly)
   */
  getType() {
    return this.type;
  }

  /**
   * 获取当前语言筛选
   * @returns {string} 语言名称
   */
  getLanguage() {
    return this.language;
  }

  /**
   * 解析 HTML 内容（实现 BaseScraper 的抽象方法）
   * 使用 GitHubTrendingParser 进行解析
   * @param {string} html - HTML 内容
   * @returns {Promise<Object>} 解析后的数据
   */
  async parseHTML(html) {
    logger.info(`[${this.name}] 使用 GitHubTrendingParser 解析 HTML...`);
    
    try {
      // 使用解析器解析 HTML
      const repositories = this.parser.parse(html);
      
      // 标准化输出格式
      const data = this.parser.standardize(repositories);
      
      // 添加验证信息
      data.validated = this.validate(data);
      
      return data;
    } catch (error) {
      logger.error(`[${this.name}] 解析失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 数据验证逻辑
   * @param {Object} data - 要验证的数据
   * @returns {Object} 验证结果
   */
  validate(data) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      checks: {
        dataNotEmpty: false,
        repositoryCount: false,
        requiredFields: false,
        dataStructure: false
      }
    };

    try {
      // 1. 验证数据不为空
      if (!data || typeof data !== 'object') {
        validation.isValid = false;
        validation.errors.push('数据为空或格式不正确');
        validation.checks.dataNotEmpty = false;
        return validation;
      }
      validation.checks.dataNotEmpty = true;

      // 2. 验证项目数量 > 0
      const count = data.count || (data.repositories ? data.repositories.length : 0);
      if (!count || count <= 0) {
        validation.isValid = false;
        validation.errors.push('抓取的项目数量为 0');
        validation.checks.repositoryCount = false;
        return validation;
      }
      validation.checks.repositoryCount = true;

      // 3. 验证必要字段存在
      const requiredFields = ['success', 'count', 'scrapedAt', 'source', 'period', 'repositories'];
      const missingFields = [];
      
      for (const field of requiredFields) {
        if (!(field in data)) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        validation.isValid = false;
        validation.errors.push(`缺少必要字段：${missingFields.join(', ')}`);
        validation.checks.requiredFields = false;
        return validation;
      }
      validation.checks.requiredFields = true;

      // 4. 验证数据结构
      if (!Array.isArray(data.repositories)) {
        validation.isValid = false;
        validation.errors.push('repositories 字段不是数组');
        validation.checks.dataStructure = false;
        return validation;
      }
      validation.checks.dataStructure = true;

      // 5. 验证每个仓库的必要字段
      const repoRequiredFields = ['fullName', 'name', 'owner', 'stars', 'url'];
      data.repositories.forEach((repo, index) => {
        const repoMissingFields = [];
        
        for (const field of repoRequiredFields) {
          if (!(field in repo)) {
            repoMissingFields.push(field);
          }
        }

        if (repoMissingFields.length > 0) {
          validation.warnings.push(`仓库 #${index + 1} (${repo.fullName || 'unknown'}) 缺少字段：${repoMissingFields.join(', ')}`);
        }

        // 验证仓库名称格式
        if (repo.fullName && !repo.fullName.includes('/')) {
          validation.warnings.push(`仓库 #${index + 1} 的 fullName 格式不正确：${repo.fullName}`);
        }

        // 验证星数
        if (typeof repo.stars !== 'number' || repo.stars < 0) {
          validation.warnings.push(`仓库 #${index + 1} 的星数无效：${repo.stars}`);
        }
      });

      // 6. 添加验证总结
      if (validation.errors.length > 0) {
        validation.isValid = false;
      }

      if (validation.warnings.length > 0) {
        logger.warn(`[${this.name}] 数据验证发现 ${validation.warnings.length} 个警告`);
      }

      logger.info(`[${this.name}] 数据验证完成`, {
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        repositoryCount: count
      });

    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`验证过程出错：${error.message}`);
      logger.error(`[${this.name}] 数据验证失败：${error.message}`);
    }

    return validation;
  }

  /**
   * 获取抓取器信息
   * @returns {Object} 抓取器信息
   */
  getInfo() {
    return {
      name: this.name,
      type: this.type,
      language: this.language,
      url: this.url,
      timeout: this.timeout
    };
  }
}

module.exports = GitHubScraper;
