#!/usr/bin/env node
const HTMLGenerator = require('../src/generator/html-generator');
const generator = new HTMLGenerator();

console.log('=== 测试中文引号内项目名称链接转换 ===\n');

const testCases = [
  {
    name: '中文引号包裹项目名',
    text: '如《NousResearch/hermes-agent》和《coleam00/Archon》出现',
    projects: [
      { fullName: 'NousResearch/hermes-agent', url: 'https://github.com/NousResearch/hermes-agent' },
      { fullName: 'coleam00/Archon', url: 'https://github.com/coleam00/Archon' }
    ],
    expectedFormat: '《<a href=' // 期望保留《》
  },
  {
    name: '反引号包裹项目名',
    text: '使用 `BasedHardware/omi` 实现功能',
    projects: [
      { fullName: 'BasedHardware/omi', url: 'https://github.com/BasedHardware/omi' }
    ]
  },
  {
    name: '普通文本中的项目名',
    text: '初期，开发者关注代码增强，如 NousResearch/hermes-agent 和 coleam00/Archon',
    projects: [
      { fullName: 'NousResearch/hermes-agent', url: 'https://github.com/NousResearch/hermes-agent' },
      { fullName: 'coleam00/Archon', url: 'https://github.com/coleam00/Archon' }
    ]
  },
  {
    name: '混合场景',
    text: '从对话到自治是本周最深刻的变革。初期（4.12），开发者关注代码增强，如《NousResearch/hermes-agent》和《coleam00/Archon》，试图通过结构化约束解决大模型生成不确定性。',
    projects: [
      { fullName: 'NousResearch/hermes-agent', url: 'https://github.com/NousResearch/hermes-agent' },
      { fullName: 'coleam00/Archon', url: 'https://github.com/coleam00/Archon' }
    ],
    expectedFormat: '《<a href='
  }
];

let allPassed = true;

for (const testCase of testCases) {
  console.log(`测试：${testCase.name}`);
  console.log(`输入：${testCase.text}`);

  const result = generator.escapeAndLinkify(testCase.text, testCase.projects);
  console.log(`输出：${result}`);

  // 验证是否包含正确的链接
  const hasLinks = result.includes('<a href="https://github.com/');
  const expectedLinks = testCase.projects.length;
  const actualLinks = (result.match(/<a href="https:\/\/github\.com\//g) || []).length;

  if (actualLinks >= expectedLinks) {
    console.log(`✅ 通过 - 生成了 ${actualLinks} 个链接`);
  } else {
    console.log(`❌ 失败 - 期望至少 ${expectedLinks} 个链接，实际 ${actualLinks} 个`);
    allPassed = false;
  }

  console.log('');
}

console.log('=== 测试完成 ===');
if (allPassed) {
  console.log('✅ 所有测试通过！');
  process.exit(0);
} else {
  console.log('❌ 部分测试失败');
  process.exit(1);
}
