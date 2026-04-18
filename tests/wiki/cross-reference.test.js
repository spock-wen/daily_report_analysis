#!/usr/bin/env node
/**
 * CrossReferenceAnalyzer 模块测试
 */

const path = require('path');
const CrossReferenceAnalyzer = require('../../src/wiki/cross-reference');

// 测试计数器
let totalTests = 0;
let passedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${testName}`);
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('  CrossReferenceAnalyzer 模块测试');
  console.log('============================================================\n');

  const analyzer = new CrossReferenceAnalyzer();

  try {
    // ==================== extractCitationsFromBibTeX 测试 ====================
    console.log('📦 extractCitationsFromBibTeX 测试：\n');

    const bibtex1 = `@article{smith2024llm,
  title={LLM Optimization},
  author={Smith, John},
  journal={arXiv preprint arXiv:2401.12345},
  year={2024}
}`;

    const citations1 = analyzer.extractCitationsFromBibTeX(bibtex1);
    assert(citations1.includes('2401.12345'), '提取单个 arXiv ID');

    const bibtex2 = `@article{smith2024llm,
  title={LLM Optimization},
  author={Smith, John},
  journal={arXiv preprint arXiv:2401.12345},
  year={2024},
  note={See also arXiv:2402.05678}
}`;

    const citations2 = analyzer.extractCitationsFromBibTeX(bibtex2);
    assert(citations2.length === 2, '提取多个 arXiv ID');
    assert(citations2.includes('2401.12345'), '包含第一个 ID');
    assert(citations2.includes('2402.05678'), '包含第二个 ID');

    const emptyCitations = analyzer.extractCitationsFromBibTeX('');
    assert(emptyCitations.length === 0, '空 BibTeX 返回空数组');

    // ==================== findSimilarProjects 测试 ====================
    console.log('\n📦 findSimilarProjects 测试：\n');

    const currentProject = {
      repo: 'owner/agent-tool',
      description: 'An AI agent framework for workflow automation',
      domain: 'agent',
      language: 'Python'
    };

    const allWikis = [
      {
        owner: 'owner2',
        repo: 'agent-framework',
        content: '# owner2/agent-framework\n\n## 基本信息\n- 领域分类：agent\n- 语言：Python\n\n核心功能：agent framework for automation'
      },
      {
        owner: 'owner3',
        repo: 'database-tool',
        content: '# owner3/database-tool\n\n## 基本信息\n- 领域分类：database\n- 语言：Java'
      },
      {
        owner: 'owner4',
        repo: 'another-agent',
        content: '# owner4/another-agent\n\n## 基本信息\n- 领域分类：agent\n- 语言：JavaScript\n\n核心功能：agent workflow builder'
      }
    ];

    const similar = analyzer.findSimilarProjects(currentProject, allWikis);
    assert(similar.length > 0, '找到相似项目');
    assert(similar[0].owner === 'owner2' || similar[0].owner === 'owner4', '第一个结果是 agent 领域项目');

    // 测试空输入
    const emptySimilar = analyzer.findSimilarProjects(currentProject, []);
    assert(emptySimilar.length === 0, '空 Wiki 列表返回空数组');

    // ==================== getProjectsByDomain 测试 ====================
    console.log('\n📦 getProjectsByDomain 测试：\n');

    const agentProjects = analyzer.getProjectsByDomain('agent', allWikis);
    assert(agentProjects.length === 2, '找到 2 个 agent 领域项目');

    const emptyDomainProjects = analyzer.getProjectsByDomain('nonexistent', allWikis);
    assert(emptyDomainProjects.length === 0, '不存在的领域返回空数组');

    // ==================== _extractField 测试 ====================
    console.log('\n📦 _extractField 测试：\n');

    const wikiContent = `# Test Project

## 基本信息
- 领域分类：agent
- 语言：Python
- 上榜次数：5
`;

    const domain = analyzer._extractField(wikiContent, '领域分类');
    assert(domain === 'agent', '提取领域分类正确');

    const language = analyzer._extractField(wikiContent, '语言');
    assert(language === 'Python', '提取语言正确');

    const appearances = analyzer._extractField(wikiContent, '上榜次数');
    assert(appearances === '5', '提取上榜次数正确');

    const notExist = analyzer._extractField(wikiContent, '不存在的字段');
    assert(notExist === null, '不存在的字段返回 null');

    // ==================== _extractKeywords 测试 ====================
    console.log('\n📦 _extractKeywords 测试：\n');

    const text = 'This is an AI agent using RAG and LLM for vector retrieval and workflow automation';
    const keywords = analyzer._extractKeywords(text);
    assert(keywords.length > 0, '提取到关键词');
    assert(keywords.includes('agent'), '包含 agent 关键词');
    assert(keywords.includes('rag'), '包含 rag 关键词');
    assert(keywords.includes('llm'), '包含 llm 关键词');

  } catch (error) {
    console.error(`\n❌ 测试执行失败：${error.message}`);
    console.error(error.stack);
  }

  console.log('\n============================================================');
  console.log(`  测试结果：${passedTests}/${totalTests} 通过`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
