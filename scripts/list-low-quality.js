#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createLlmClient } = require('../src/utils/llm-client');

const WIKI_DIR = path.join(process.cwd(), 'wiki', 'projects');

async function main() {
  const files = fs.readdirSync(WIKI_DIR).filter(f => f.endsWith('.md'));
  const lowQuality = [];
  const llmClient = createLlmClient();

  console.log(`共 ${files.length} 个项目，开始检查...\n`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const content = fs.readFileSync(path.join(WIKI_DIR, file), 'utf-8');

    // 提取核心功能
    const coreFuncMatch = content.match(/## 核心功能\n([\s\S]*?)(?=\n## )/);
    const coreFunctions = coreFuncMatch ? coreFuncMatch[1].trim() : '';

    // 提取最近的版本分析
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
        file,
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

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.score <= 2) {
          lowQuality.push({
            file,
            score: result.score,
            reason: result.reason || '分析质量低'
          });
          console.log(`[${lowQuality.length}] ${file} - 评分：${result.score}`);
        }
      }
    } catch (error) {
      console.warn(`检查失败 (${file}): ${error.message}`);
    }

    // 每 10 个暂停一下
    if ((i + 1) % 10 === 0) {
      console.log(`已检查 ${i + 1}/${files.length}...`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n\n========================================`);
  console.log(`低质量项目列表（共 ${lowQuality.length} 个）：`);
  console.log(`========================================\n`);

  lowQuality.forEach((item, i) => {
    console.log(`${(i+1)}. ${item.file}`);
    console.log(`   评分：${item.score}/5`);
    console.log(`   原因：${item.reason}`);
    console.log();
  });

  const passRate = ((files.length - lowQuality.length) / files.length * 100).toFixed(0);
  console.log(`优质率：${passRate}% (${files.length - lowQuality.length}/${files.length})`);
}

main().catch(console.error);
