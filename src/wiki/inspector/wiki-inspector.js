/**
 * Wiki Inspector - Wiki 健康检查主类
 *
 * 统一入口：执行所有检查项，聚合结果，生成报告
 */

const fs = require('fs');
const path = require('path');

// 导入检查模块
const structureChecks = require('./checks/structure-check');
const qualityChecks = require('./checks/quality-check');
const relationChecks = require('./checks/relation-check');

// 导入 Reporter
const cliReporter = require('./reporters/cli-reporter');
const jsonReporter = require('./reporters/json-reporter');

class WikiInspector {
  constructor(options = {}) {
    this.wikiDir = options.baseDir || path.join(process.cwd(), 'wiki');
    this.checks = [];
    this.categoryResults = {
      structure: [],
      quality: [],
      relation: []
    };

    // 注册默认检查项
    this._registerDefaultChecks();
  }

  /**
   * 注册默认检查项
   */
  _registerDefaultChecks() {
    // 结构完整性检查
    this.registerCheck('structure', 'file-exists', structureChecks.checkFileExists);
    this.registerCheck('structure', 'markdown-valid', structureChecks.checkMarkdownValid);
    this.registerCheck('structure', 'required-sections', structureChecks.checkRequiredSections);
    this.registerCheck('structure', 'version-history-not-empty', structureChecks.checkVersionHistoryNotEmpty);

    // 数据质量检查
    this.registerCheck('quality', 'stars-format', qualityChecks.checkStarsFormat);
    this.registerCheck('quality', 'domain-valid', qualityChecks.checkDomainValid);
    this.registerCheck('quality', 'date-format', qualityChecks.checkDateFormat);
    this.registerCheck('quality', 'no-duplicate-versions', qualityChecks.checkNoDuplicateVersions);
    this.registerCheck('quality', 'core-functions-not-empty', qualityChecks.checkCoreFunctionsNotEmpty);
    this.registerCheck('quality', 'stars-up-to-date', qualityChecks.checkStarsUpToDate);

    // 关联性检查
    this.registerCheck('relation', 'domain-projects-count', relationChecks.checkDomainProjectsCount);
    this.registerCheck('relation', 'orphan-projects', relationChecks.checkOrphanProjects);
    this.registerCheck('relation', 'cross-reference-valid', relationChecks.checkCrossReferenceValid);
    this.registerCheck('relation', 'domain-wiki-exists', relationChecks.checkDomainWikiExists);
    this.registerCheck('relation', 'basic-info-completeness', relationChecks.checkBasicInfoCompleteness);
  }

  /**
   * 注册检查项
   * @param {string} category - 类别 (structure/quality/relation)
   * @param {string} name - 检查项名称
   * @param {Function} checkFn - 检查函数
   */
  registerCheck(category, name, checkFn) {
    this.checks.push({ category, name, checkFn });
  }

  /**
   * 执行所有检查
   * @returns {Promise<Object>} 检查结果
   */
  async inspect() {
    const results = [];
    const categoryResults = {
      structure: [],
      quality: [],
      relation: []
    };

    // 执行所有检查
    for (const check of this.checks) {
      try {
        const result = await check.checkFn(this.wikiDir);
        result.category = check.category;
        results.push(result);
        categoryResults[check.category].push(result);
      } catch (error) {
        results.push({
          name: check.name,
          category: check.category,
          status: 'fail',
          message: `检查执行失败：${error.message}`,
          details: [],
          fixCommand: null
        });
      }
    }

    this.categoryResults = categoryResults;

    // 聚合结果
    return this._aggregate(results);
  }

  /**
   * 执行指定类别的检查
   * @param {string} category - 类别
   * @returns {Promise<Object>} 检查结果
   */
  async inspectCategory(category) {
    const results = [];
    const categoryResults = { structure: [], quality: [], relation: [] };

    const categoryChecks = this.checks.filter(c => c.category === category);

    for (const check of categoryChecks) {
      try {
        const result = await check.checkFn(this.wikiDir);
        result.category = category;
        results.push(result);
        categoryResults[category].push(result);
      } catch (error) {
        results.push({
          name: check.name,
          category: category,
          status: 'fail',
          message: `检查执行失败：${error.message}`,
          details: [],
          fixCommand: null
        });
      }
    }

    return this._aggregate(results);
  }

  /**
   * 执行单个检查项
   * @param {string} checkName - 检查项名称
   * @returns {Promise<Object>} 检查结果
   */
  async inspectCheck(checkName) {
    const check = this.checks.find(c => c.name === checkName);
    if (!check) {
      return {
        name: checkName,
        status: 'fail',
        message: `未知的检查项：${checkName}`,
        details: [],
        fixCommand: null
      };
    }

    return await check.checkFn(this.wikiDir);
  }

  /**
   * 聚合检查结果
   */
  _aggregate(results) {
    const timestamp = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const passedChecks = results.filter(r => r.status === 'pass').length;
    const warningChecks = results.filter(r => r.status === 'warning').length;
    const failedChecks = results.filter(r => r.status === 'fail').length;

    // 计算健康度分数
    const healthScore = this._calculateHealthScore(results);

    // 统计项目总数
    const projectsDir = path.join(this.wikiDir, 'projects');
    let totalProjects = 0;
    if (fs.existsSync(projectsDir)) {
      totalProjects = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md')).length;
    }

    return {
      timestamp,
      summary: {
        totalProjects,
        healthScore,
        passedChecks,
        warningChecks,
        failedChecks
      },
      results,
      categoryResults: this.categoryResults
    };
  }

  /**
   * 计算健康度分数
   */
  _calculateHealthScore(results) {
    let totalScore = 0;
    let maxScore = 0;

    for (const result of results) {
      const weight = 1;
      maxScore += weight;

      switch (result.status) {
        case 'pass':
          totalScore += weight;
          break;
        case 'warning':
          totalScore += weight * 0.5;
          break;
        case 'fail':
          totalScore += 0;
          break;
      }
    }

    return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  }

  /**
   * 生成 CLI 格式报告
   * @param {Object} inspectResult - 检查结果
   * @returns {string} CLI 报告文本
   */
  static toCLI(inspectResult) {
    return cliReporter.generateReport(inspectResult);
  }

  /**
   * 生成简要 CLI 报告
   * @param {Object} inspectResult - 检查结果
   * @returns {string} 简要报告文本
   */
  static toBriefCLI(inspectResult) {
    return cliReporter.generateBriefReport(inspectResult);
  }

  /**
   * 生成 JSON 格式报告
   * @param {Object} inspectResult - 检查结果
   * @returns {string} JSON 报告文本
   */
  static toJSON(inspectResult) {
    return jsonReporter.generateReport(inspectResult);
  }

  /**
   * 生成 CI/CD 格式报告
   * @param {Object} inspectResult - 检查结果
   * @returns {string} CI/CD 报告 JSON
   */
  static toCiCdJSON(inspectResult) {
    return jsonReporter.generateCiCdReport(inspectResult);
  }

  /**
   * 获取健康度评级
   * @param {number} score - 健康度分数
   * @returns {string} 评级
   */
  static getHealthRating(score) {
    return cliReporter.getHealthRating(score);
  }
}

module.exports = WikiInspector;
