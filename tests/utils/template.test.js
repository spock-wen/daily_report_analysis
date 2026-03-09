#!/usr/bin/env node
/**
 * Template 工具函数测试
 */

const {
  renderTemplate,
  loadTemplate,
  renderHtmlPage,
  escapeHtml,
  markdownToHtml
} = require('../../src/utils/template');

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
  console.log('\n' + '='.repeat(60));
  console.log('  Template 工具函数测试');
  console.log('='.repeat(60) + '\n');

  try {
    // ==================== renderTemplate 测试 ====================
    console.log('📦 renderTemplate 方法测试：\n');
    
    // 测试 1: 基础变量替换
    const template1 = 'Hello, ${name}!';
    const result1 = renderTemplate(template1, { name: 'World' });
    assert(result1 === 'Hello, World!', '基础变量替换正确');

    // 测试 2: 多个变量替换
    const template2 = '${greeting}, ${name}! Today is ${day}.';
    const result2 = renderTemplate(template2, { 
      greeting: 'Good morning', 
      name: 'Alice', 
      day: 'Monday' 
    });
    assert(result2 === 'Good morning, Alice! Today is Monday.', '多个变量替换正确');

    // 测试 3: 使用函数
    const template3 = 'Upper: ${toUpperCase("hello")}, Length: ${length("test")}';
    const helpers = {
      toUpperCase: (str) => str.toUpperCase(),
      length: (str) => str.length
    };
    const result3 = renderTemplate(template3, {}, helpers);
    assert(result3 === 'Upper: HELLO, Length: 4', '函数调用正确');

    // 测试 4: 混合数据和函数
    const template4 = '${name} has ${count} items, total: ${calculateTotal(count, price)}';
    const data = { name: 'Alice', count: 5, price: 10 };
    const helpers2 = {
      calculateTotal: (count, price) => count * price
    };
    const result4 = renderTemplate(template4, data, helpers2);
    assert(result4 === 'Alice has 5 items, total: 50', '混合数据和函数正确');

    // 测试 5: 空模板
    const result5 = renderTemplate('');
    assert(result5 === '', '空模板返回空字符串');

    // 测试 6: 无变量模板
    const template6 = 'Static content without variables';
    const result6 = renderTemplate(template6, {});
    assert(result6 === 'Static content without variables', '无变量模板正确');

    // 测试 7: 特殊字符处理
    const template7 = 'Price: $${price}, Percent: ${percent}%';
    const result7 = renderTemplate(template7, { price: '100', percent: '50' });
    assert(result7 === 'Price: $100, Percent: 50%', '特殊字符处理正确');

    // 测试 8: 多行模板
    const template8 = 'Line 1: ${line1}\nLine 2: ${line2}\nLine 3: ${line3}';
    const result8 = renderTemplate(template8, { line1: 'A', line2: 'B', line3: 'C' });
    assert(result8.includes('Line 1: A'), '多行模板正确 - 行 1');
    assert(result8.includes('Line 2: B'), '多行模板正确 - 行 2');
    assert(result8.includes('Line 3: C'), '多行模板正确 - 行 3');

    // ==================== renderHtmlPage 测试 ====================
    console.log('\n📦 renderHtmlPage 方法测试：\n');
    
    // 测试 1: 基础页面
    const html1 = renderHtmlPage('Test Page', '<h1>Hello</h1>');
    assert(html1.includes('<!DOCTYPE html>'), '包含 DOCTYPE');
    assert(html1.includes('<title>Test Page</title>'), '包含标题');
    assert(html1.includes('<h1>Hello</h1>'), '包含内容');
    assert(html1.includes('lang="zh-CN"'), '包含中文语言设置');
    assert(html1.includes('charset="UTF-8"'), '包含字符集');

    // 测试 2: 自定义选项
    const html2 = renderHtmlPage('Custom Page', '<div>Content</div>', {
      charset: 'ISO-8859-1',
      viewport: 'width=device-width',
      styles: 'body { margin: 0; }',
      scripts: 'console.log("loaded");'
    });
    assert(html2.includes('charset="ISO-8859-1"'), '自定义字符集正确');
    assert(html2.includes('width=device-width'), '自定义 viewport 正确');
    assert(html2.includes('<style>body { margin: 0; }</style>'), '包含样式');
    assert(html2.includes('<script>console.log("loaded");</script>'), '包含脚本');

    // 测试 3: 无选项
    const html3 = renderHtmlPage('Simple', '<p>Text</p>', {});
    assert(html3.includes('<title>Simple</title>'), '无选项时标题正确');
    assert(html3.includes('<p>Text</p>'), '无选项时内容正确');

    // ==================== escapeHtml 测试 ====================
    console.log('\n📦 escapeHtml 方法测试：\n');
    
    // 测试 1: 特殊字符转义
    assert(escapeHtml('<script>') === '&lt;script&gt;', '尖括号转义正确');
    assert(escapeHtml('A & B') === 'A &amp; B', '和号转义正确');
    assert(escapeHtml('"quote"') === '&quot;quote&quot;', '双引号转义正确');
    assert(escapeHtml("'single'") === '&#39;single&#39;', '单引号转义正确');
    
    // 测试 2: 混合特殊字符
    const mixed = '<div class="test">A & B</div>';
    const escaped = escapeHtml(mixed);
    assert(escaped === '&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;', '混合特殊字符转义正确');
    
    // 测试 3: 无特殊字符
    assert(escapeHtml('Normal text') === 'Normal text', '无特殊字符不变');
    
    // 测试 4: 空字符串
    assert(escapeHtml('') === '', '空字符串转义正确');
    
    // 测试 5: 数字转换
    assert(escapeHtml(123) === '123', '数字转换为字符串');

    // ==================== markdownToHtml 测试 ====================
    console.log('\n📦 markdownToHtml 方法测试：\n');
    
    // 测试 1: 标题
    assert(markdownToHtml('# H1').includes('<h1>H1</h1>'), 'H1 标题正确');
    assert(markdownToHtml('## H2').includes('<h2>H2</h2>'), 'H2 标题正确');
    assert(markdownToHtml('### H3').includes('<h3>H3</h3>'), 'H3 标题正确');
    
    // 测试 2: 粗体和斜体
    assert(markdownToHtml('**bold**').includes('<strong>bold</strong>'), '粗体正确');
    assert(markdownToHtml('*italic*').includes('<em>italic</em>'), '斜体正确');
    
    // 测试 3: 链接
    const linkMd = '[GitHub](https://github.com)';
    const linkHtml = markdownToHtml(linkMd);
    assert(linkHtml.includes('<a href="https://github.com" target="_blank">GitHub</a>'), '链接正确');
    
    // 测试 4: 列表
    const listMd = '- Item 1\n- Item 2\n- Item 3';
    const listHtml = markdownToHtml(listMd);
    assert(listHtml.includes('<li>Item 1</li>'), '无序列表项 1 正确');
    assert(listHtml.includes('<li>Item 2</li>'), '无序列表项 2 正确');
    assert(listHtml.includes('<li>Item 3</li>'), '无序列表项 3 正确');
    
    // 测试 5: 有序列表
    const orderedMd = '1. First\n2. Second\n3. Third';
    const orderedHtml = markdownToHtml(orderedMd);
    assert(orderedHtml.includes('<li>First</li>'), '有序列表项 1 正确');
    assert(orderedHtml.includes('<li>Second</li>'), '有序列表项 2 正确');
    
    // 测试 6: 代码块
    const codeMd = '```\ncode block\n```';
    const codeHtml = markdownToHtml(codeMd);
    assert(codeHtml.includes('<pre><code>'), '代码块包含 pre code 标签');
    assert(codeHtml.includes('code block'), '代码块包含内容');
    
    // 测试 7: 行内代码
    const inlineMd = 'Use `console.log()` function';
    const inlineHtml = markdownToHtml(inlineMd);
    assert(inlineHtml.includes('<code>console.log()</code>'), '行内代码正确');
    
    // 测试 8: 段落
    const paragraphMd = 'Paragraph 1\n\nParagraph 2';
    const paragraphHtml = markdownToHtml(paragraphMd);
    assert(paragraphHtml.includes('<p>Paragraph 1</p>'), '段落 1 正确');
    assert(paragraphHtml.includes('<p>Paragraph 2</p>'), '段落 2 正确');
    
    // 测试 9: 混合 Markdown
    const mixedMd = `# Title

This is **bold** and *italic*.

- List item 1
- List item 2

[Link](https://example.com)

\`\`\`
code
\`\`\``;
    const mixedHtml = markdownToHtml(mixedMd);
    assert(mixedHtml.includes('<h1>Title</h1>'), '混合 - 标题');
    assert(mixedHtml.includes('<strong>bold</strong>'), '混合 - 粗体');
    assert(mixedHtml.includes('<em>italic</em>'), '混合 - 斜体');
    assert(mixedHtml.includes('<li>List item 1</li>'), '混合 - 列表');
    assert(mixedHtml.includes('<a href="https://example.com"'), '混合 - 链接');
    assert(mixedHtml.includes('<pre><code>'), '混合 - 代码块');
    assert(mixedHtml.includes('code'), '混合 - 代码块内容');

    // 测试 10: 空字符串
    assert(markdownToHtml('') === '<p></p>', '空 Markdown 转换正确');

    // ==================== loadTemplate 测试 ====================
    console.log('\n📦 loadTemplate 方法测试：\n');
    
    // 注意：这个测试需要一个实际的模板文件
    // 这里我们测试错误处理
    try {
      await loadTemplate('non-existent-file.html');
      assert(false, '加载不存在的文件应该抛出错误');
    } catch (error) {
      assert(true, '加载不存在的文件抛出错误正确');
    }

  } catch (error) {
    console.log(`  ❌ 测试执行失败：${error.message}`);
    console.log(error.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  测试结果：${passedTests}/${totalTests} 通过`);
  console.log('='.repeat(60) + '\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests();
