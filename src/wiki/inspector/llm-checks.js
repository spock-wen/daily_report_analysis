/**
 * LLM-based Checks - 基于 LLM 的深度检查
 *
 * 检查项：
 * 1. semantic-duplicate: 语义重复检测
 * 2. analysis-quality: 分析质量评分
 *
 * 使用方式：
 * const llmChecks = require('./llm-checks');
 * const results = await llmChecks.checkSemanticDuplicates(wikiDir, llmClient);
 */

/**
 * 语义重复检测
 * 检测同一项目的不同版本记录是否存在语义重复
 *
 * @param {string} wikiDir - Wiki 目录路径
 * @param {Object} llmClient - LLM 客户端实例
 * @returns {Promise<Object>} 检查结果
 */
async function checkSemanticDuplicates(wikiDir, llmClient) {
  const fs = require('fs');
  const path = require('path');

  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'semantic-duplicate',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const duplicates = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 提取所有版本分析的文本
    const versionRegex = /### (\d{4}-\d{2}-\d{2})（([^)]+)）\s*\*\*来源\*\*:([\s\S]*?)\*\*分析\*\*:(.+?)(?=\n###|\n##|$)/g;
    const versions = [];
    let match;

    while ((match = versionRegex.exec(content)) !== null) {
      versions.push({
        date: match[1],
        eventType: match[2].trim(),
        analysis: match[4].trim()
      });
    }

    // 如果版本数 < 2，跳过（无法比较）
    if (versions.length < 2) {
      continue;
    }

    // 构建 LLM Prompt
    const analysisTexts = versions.map((v, i) =>
      `[${i}] ${v.date} (${v.eventType}): ${v.analysis}`
    ).join('\n\n');

    const prompt = `请分析以下同一项目的多个版本记录，判断是否存在语义重复的内容。

版本记录：
${analysisTexts}

请回答：
1. 哪些版本记录在语义上是重复的？（即使表述不同，但说的是同一件事）
2. 重复的原因是什么？

如果没有重复，请回答"无重复"。

请以 JSON 格式返回：
{
  "hasDuplicates": true/false,
  "duplicates": [
    {
      "version1": {"date": "YYYY-MM-DD", "eventType": "..."},
      "version2": {"date": "YYYY-MM-DD", "eventType": "..."},
      "reason": "重复原因说明"
    }
  ]
}`;

    try {
      const response = await llmClient.generate(prompt, {
        temperature: 0.1,  // 低温度，追求确定性
        maxTokens: 500
      });

      // 尝试解析 JSON 响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.hasDuplicates && result.duplicates.length > 0) {
          duplicates.push({
            file: `wiki/projects/${file}`,
            duplicates: result.duplicates
          });
        }
      }
    } catch (error) {
      // LLM 调用失败，跳过此项目
      console.warn(`LLM 检查失败 (${file}): ${error.message}`);
    }
  }

  if (duplicates.length > 0) {
    return {
      name: 'semantic-duplicate',
      status: 'warning',
      message: `${duplicates.length} 个项目存在语义重复的版本记录`,
      details: duplicates.slice(0, 10),
      fixCommand: '手动合并或删除重复的版本记录'
    };
  }

  return {
    name: 'semantic-duplicate',
    status: 'pass',
    message: `${files.length} 个项目无语义重复`,
    details: [],
    fixCommand: null
  };
}

/**
 * 分析质量评分
 * 评估项目 Wiki 中的分析内容是否有信息量
 *
 * @param {string} wikiDir - Wiki 目录路径
 * @param {Object} llmClient - LLM 客户端实例
 * @returns {Promise<Object>} 检查结果
 */
async function checkAnalysisQuality(wikiDir, llmClient) {
  const fs = require('fs');
  const path = require('path');

  const projectsDir = path.join(wikiDir, 'projects');
  if (!fs.existsSync(projectsDir)) {
    return {
      name: 'analysis-quality',
      status: 'fail',
      message: 'Wiki projects 目录不存在',
      details: [],
      fixCommand: null
    };
  }

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  const lowQuality = [];

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 提取核心功能
    const coreFuncMatch = content.match(/## 核心功能\n([\s\S]*?)(?=\n## )/);
    const coreFunctions = coreFuncMatch ? coreFuncMatch[1].trim() : '';

    // 提取最近的版本分析（最后一个版本）
    // 使用全局正则匹配所有版本，然后取最后一个
    const versionRegex = /### (\d{4}-\d{2}-\d{2})（([^)]+)）[\s\S]*?\*\*分析\*\*:\s*([\s\S]*?)(?=\n###|\n##|$)/g;
    const versions = [];
    let match;
    while ((match = versionRegex.exec(content)) !== null) {
      versions.push({
        date: match[1],
        eventType: match[2],
        analysis: match[3].trim()
      });
    }

    const recentAnalysis = versions.length > 0 ? versions[versions.length - 1].analysis : '';

    // 如果两者都为空，直接标记为低质
    if (!coreFunctions && !recentAnalysis) {
      lowQuality.push({
        file: `wiki/projects/${file}`,
        score: 1,
        reason: '核心功能和分析内容均为空'
      });
      continue;
    }

    const prompt = `请评估以下项目 Wiki 的分析内容质量。

核心功能：
${coreFunctions || '(空)'}

最近分析：
${recentAnalysis || '(空)'}

评分标准：
- 5 分：分析深入、有独到见解、具体描述了项目价值
- 4 分：分析较详细、有一定信息量
- 3 分：分析基本完整、但较模板化
- 2 分：分析过于简略、信息量少
- 1 分：几乎无分析内容、纯模板填充

请以 JSON 格式返回：
{
  "score": 1-5,
  "reason": "评分理由（一句话）"
}`;

    try {
      const response = await llmClient.generate(prompt, {
        temperature: 0.1,
        maxTokens: 200
      });

      // 尝试解析 JSON 响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.score <= 2) {
          lowQuality.push({
            file: `wiki/projects/${file}`,
            score: result.score,
            reason: result.reason || '分析质量低'
          });
        }
      }
    } catch (error) {
      console.warn(`LLM 质量评估失败 (${file}): ${error.message}`);
    }
  }

  const passRate = files.length > 0
    ? ((files.length - lowQuality.length) / files.length * 100).toFixed(0)
    : 100;

  if (lowQuality.length > 0) {
    return {
      name: 'analysis-quality',
      status: 'warning',
      message: `${lowQuality.length} 个项目分析质量较低 (优质率 ${passRate}%)`,
      details: lowQuality.slice(0, 20),
      fixCommand: '重新运行 AI 分析或手动补充有信息量的内容'
    };
  }

  return {
    name: 'analysis-quality',
    status: 'pass',
    message: `${files.length} 个项目分析质量合格`,
    details: [],
    fixCommand: null
  };
}

module.exports = {
  checkSemanticDuplicates,
  checkAnalysisQuality
};
