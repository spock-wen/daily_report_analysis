/**
 * 结构完整性检查
 * 检查 Wiki 文件的基础结构和格式
 */

const fs = require('fs');
const path = require('path');

/**
 * 检查项目 Wiki 文件是否存在
 */
async function checkFileExists(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'file-exists',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    return {
      name: 'file-exists',
      status: 'warning',
      message: 'Wiki projects 目录为空',
      details: [],
      fixCommand: '运行报告生成工作流'
    };
  }

  return {
    name: 'file-exists',
    status: 'pass',
    message: `${files.length} 个 Wiki 文件存在`,
    details: [{ count: files.length }],
    fixCommand: null
  };
}

/**
 * 检查 Markdown 文件是否可正确解析
 */
async function checkMarkdownValid(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'markdown-valid',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const invalidFiles = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // 基本检查：文件不为空且有标题
      if (!content.trim() || !content.startsWith('# ')) {
        invalidFiles.push({
          file: `wiki/projects/${file}`,
          reason: '文件为空或缺少标题'
        });
      }
    } catch (error) {
      invalidFiles.push({
        file: `wiki/projects/${file}`,
        reason: `读取失败：${error.message}`
      });
    }
  }

  if (invalidFiles.length > 0) {
    return {
      name: 'markdown-valid',
      status: 'fail',
      message: `${invalidFiles.length} 个文件无法解析`,
      details: invalidFiles.slice(0, 10), // 只显示前 10 个
      fixCommand: '手动修复或重新生成问题文件'
    };
  }

  return {
    name: 'markdown-valid',
    status: 'pass',
    message: `${files.length} 个文件格式正确`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查必填章节是否存在
 */
async function checkRequiredSections(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'required-sections',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const requiredSections = [
    '## 基本信息',
    '## 核心功能',
    '## 版本历史'
  ];
  const missingSections = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const missing = requiredSections.filter(section => !content.includes(section));
    if (missing.length > 0) {
      missingSections.push({
        file: `wiki/projects/${file}`,
        missing: missing
      });
    }
  }

  if (missingSections.length > 0) {
    return {
      name: 'required-sections',
      status: 'warning',
      message: `${missingSections.length} 个项目缺失必填章节`,
      details: missingSections.slice(0, 10),
      fixCommand: '手动补充缺失章节或重新生成'
    };
  }

  return {
    name: 'required-sections',
    status: 'pass',
    message: `${files.length} 个项目包含所有必填章节`,
    details: [],
    fixCommand: null
  };
}

/**
 * 检查版本历史是否为空
 */
async function checkVersionHistoryNotEmpty(wikiDir) {
  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'version-history-not-empty',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const emptyHistory = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 检查是否有版本历史条目 (### YYYY-MM-DD 格式)
    const hasVersionEntry = /### \d{4}-\d{2}-\d{2}/.test(content);
    if (!hasVersionEntry) {
      emptyHistory.push({
        file: `wiki/projects/${file}`,
        reason: '版本历史章节为空'
      });
    }
  }

  if (emptyHistory.length > 0) {
    return {
      name: 'version-history-not-empty',
      status: 'warning',
      message: `${emptyHistory.length} 个项目版本历史为空`,
      details: emptyHistory.slice(0, 10),
      fixCommand: '检查数据源是否遗漏或重新运行报告生成'
    };
  }

  return {
    name: 'version-history-not-empty',
    status: 'pass',
    message: `${files.length} 个项目都有版本历史记录`,
    details: [],
    fixCommand: null
  };
}

module.exports = {
  checkFileExists,
  checkMarkdownValid,
  checkRequiredSections,
  checkVersionHistoryNotEmpty
};
