#!/usr/bin/env node
/**
 * Phase 1 工具函数测试脚本
 * 测试所有 utils 模块的功能
 */

const path = require('path');

// 项目根目录
const ROOT_DIR = path.join(__dirname, '..');

// 设置环境变量（用于测试）
process.env.LOG_LEVEL = '0'; // DEBUG 级别
process.env.LLM_API_KEY = 'test-key';
process.env.LLM_BASE_URL = 'https://api.example.com';

console.log('='.repeat(60));
console.log('  Phase 1 工具函数测试');
console.log('='.repeat(60));
console.log();

// 测试计数器
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

/**
 * 测试断言函数
 */
function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${testName}`);
    failedTests++;
  }
}

// ========================================
// 测试 1: 路径配置模块
// ========================================
console.log('📍 测试：路径配置模块 (src/utils/path.js)');
console.log('-'.repeat(60));

try {
  const pathUtils = require(path.join(ROOT_DIR, 'src/utils/path'));
  
  // 测试基础路径
  assert(pathUtils.ROOT_DIR.includes('daily_repory_analysis'), 'ROOT_DIR 正确');
  assert(pathUtils.DATA_DIR.endsWith('data'), 'DATA_DIR 正确');
  assert(pathUtils.BRIEFS_DIR.endsWith('briefs'), 'BRIEFS_DIR 正确');
  assert(pathUtils.REPORTS_DIR.endsWith('reports'), 'REPORTS_DIR 正确');
  
  // 测试日报路径
  const dailyBriefPath = pathUtils.getDailyBriefPath('2026-03-08');
  assert(dailyBriefPath.includes('2026-03-08'), '日报数据路径生成正确');
  assert(dailyBriefPath.includes('briefs') && dailyBriefPath.includes('daily'), '日报数据路径目录正确');
  
  const dailyReportPath = pathUtils.getDailyReportPath('2026-03-08');
  assert(dailyReportPath.includes('reports') && dailyReportPath.includes('daily'), '日报 HTML 路径目录正确');
  
  // 测试周报路径
  const weeklyBriefPath = pathUtils.getWeeklyBriefPath('2026-W10');
  assert(weeklyBriefPath.includes('2026-W10'), '周报数据路径生成正确');
  
  // 测试月报路径
  const monthlyBriefPath = pathUtils.getMonthlyBriefPath('2026-03');
  assert(monthlyBriefPath.includes('2026-03'), '月报数据路径生成正确');
  
  console.log();
} catch (error) {
  console.log(`  ❌ 路径模块测试失败：${error.message}`);
  console.log();
}

// ========================================
// 测试 2: 日志工具模块
// ========================================
console.log('📝 测试：日志工具模块 (src/utils/logger.js)');
console.log('-'.repeat(60));

try {
  const logger = require(path.join(ROOT_DIR, 'src/utils/logger'));
  
  // 测试日志方法存在
  assert(typeof logger.debug === 'function', 'logger.debug 方法存在');
  assert(typeof logger.info === 'function', 'logger.info 方法存在');
  assert(typeof logger.warn === 'function', 'logger.warn 方法存在');
  assert(typeof logger.error === 'function', 'logger.error 方法存在');
  assert(typeof logger.success === 'function', 'logger.success 方法存在');
  assert(typeof logger.divider === 'function', 'logger.divider 方法存在');
  assert(typeof logger.title === 'function', 'logger.title 方法存在');
  
  // 实际测试日志输出
  console.log();
  console.log('  测试日志输出:');
  logger.title('测试标题');
  logger.info('这是一条信息', { key: 'value' });
  logger.success('操作成功');
  logger.warn('这是一条警告');
  logger.error('这是一个错误', { error: 'test error' });
  logger.debug('这是一条调试信息');
  console.log();
  
} catch (error) {
  console.log(`  ❌ 日志模块测试失败：${error.message}`);
  console.log();
}

// ========================================
// 测试 3: 文件系统工具模块
// ========================================
console.log('📂 测试：文件系统工具模块 (src/utils/fs.js)');
console.log('-'.repeat(60));

(async () => {
  try {
    const fsUtils = require(path.join(ROOT_DIR, 'src/utils/fs'));
    
    // 测试方法存在
    assert(typeof fsUtils.ensureDir === 'function', 'fsUtils.ensureDir 方法存在');
    assert(typeof fsUtils.readJson === 'function', 'fsUtils.readJson 方法存在');
    assert(typeof fsUtils.writeJson === 'function', 'fsUtils.writeJson 方法存在');
    assert(typeof fsUtils.fileExists === 'function', 'fsUtils.fileExists 方法存在');
    assert(typeof fsUtils.readFile === 'function', 'fsUtils.readFile 方法存在');
    assert(typeof fsUtils.writeFile === 'function', 'fsUtils.writeFile 方法存在');
    
    // 实际测试文件操作
    const testDir = './tests/tmp';
    const testFile = `${testDir}/test.json`;
    
    // 测试创建目录
    await fsUtils.ensureDir(testDir);
    const dirExists = await fsUtils.fileExists(testDir);
    assert(dirExists, '创建目录成功');
    
    // 测试写入 JSON
    const testData = { name: 'test', value: 123 };
    await fsUtils.writeJson(testFile, testData);
    const fileExists = await fsUtils.fileExists(testFile);
    assert(fileExists, '写入 JSON 文件成功');
    
    // 测试读取 JSON
    const readData = await fsUtils.readJson(testFile);
    assert(readData.name === 'test', '读取 JSON 数据正确');
    assert(readData.value === 123, '读取 JSON 值正确');
    
    // 测试读取文件
    const content = await fsUtils.readFile(testFile, 'utf8');
    assert(typeof content === 'string', '读取文件内容成功');
    
    // 清理测试文件
    await fsUtils.deleteFile(testFile);
    const fileDeleted = !(await fsUtils.fileExists(testFile));
    assert(fileDeleted, '删除文件成功');
    
    console.log();
    
  } catch (error) {
    console.log(`  ❌ 文件系统模块测试失败：${error.message}`);
    console.log();
  }
  
  // ========================================
  // 测试 4: 模板渲染工具模块
  // ========================================
  console.log('🎨 测试：模板渲染工具模块 (src/utils/template.js)');
console.log('-'.repeat(60));
  
  try {
    const templateUtils = require(path.join(ROOT_DIR, 'src/utils/template'));
    
    // 测试方法存在
    assert(typeof templateUtils.renderTemplate === 'function', 'renderTemplate 方法存在');
    assert(typeof templateUtils.renderHtmlPage === 'function', 'renderHtmlPage 方法存在');
    assert(typeof templateUtils.escapeHtml === 'function', 'escapeHtml 方法存在');
    assert(typeof templateUtils.markdownToHtml === 'function', 'markdownToHtml 方法存在');
    
    // 测试模板渲染
    const template = 'Hello, ${name}! You have ${count} messages.';
    const data = { name: 'Alice', count: 5 };
    const result = templateUtils.renderTemplate(template, data);
    assert(result.includes('Alice'), '模板变量替换正确');
    assert(result.includes('5'), '模板数字替换正确');
    
    // 测试 HTML 页面渲染
    const htmlPage = templateUtils.renderHtmlPage('测试页面', '<h1>内容</h1>');
    assert(htmlPage.includes('<!DOCTYPE html>'), 'HTML DOCTYPE 正确');
    assert(htmlPage.includes('测试页面'), '页面标题正确');
    assert(htmlPage.includes('<h1>内容</h1>'), '页面内容正确');
    
    // 测试 HTML 转义
    const escaped = templateUtils.escapeHtml('<script>alert("XSS")</script>');
    assert(escaped.includes('&lt;'), 'HTML 转义正确');
    assert(!escaped.includes('<script>'), '危险标签已转义');
    
    // 测试 Markdown 转换
    const markdown = '# 标题\n**粗体**\n[链接](https://example.com)';
    const html = templateUtils.markdownToHtml(markdown);
    assert(html.includes('<h1>'), 'Markdown 标题转换正确');
    assert(html.includes('<strong>'), 'Markdown 粗体转换正确');
    assert(html.includes('<a href='), 'Markdown 链接转换正确');
    
    console.log();
    
  } catch (error) {
    console.log(`  ❌ 模板渲染模块测试失败：${error.message}`);
    console.log();
  }
  
  // ========================================
  // 测试 5: LLM 工具模块（仅测试配置）
  // ========================================
  console.log('🤖 测试：LLM 工具模块 (src/utils/llm.js)');
console.log('-'.repeat(60));
  
  try {
    const llmUtils = require(path.join(ROOT_DIR, 'src/utils/llm'));
    
    // 测试方法存在
    assert(typeof llmUtils.callLLM === 'function', 'callLLM 方法存在');
    assert(typeof llmUtils.parseAIResponse === 'function', 'parseAIResponse 方法存在');
    
    // 测试配置
    assert(llmUtils.config !== undefined, 'LLM 配置存在');
    assert(typeof llmUtils.config.apiKey === 'string', 'API Key 配置存在');
    assert(typeof llmUtils.config.baseUrl === 'string', 'Base URL 配置存在');
    assert(typeof llmUtils.config.model === 'string', 'Model 配置存在');
    
    // 测试解析 AI 响应
    const jsonResponse = '{"name": "test", "value": 123}';
    const parsed = llmUtils.parseAIResponse(jsonResponse);
    assert(parsed.name === 'test', 'JSON 响应解析正确');
    
    const textResponse = '这是一段普通文本';
    const parsedText = llmUtils.parseAIResponse(textResponse);
    assert(parsedText.raw === textResponse, '文本响应解析正确');
    
    console.log();
    console.log('  ⚠️  注意：callLLM 方法需要真实的 API 密钥，未进行实际调用测试');
    console.log();
    
  } catch (error) {
    console.log(`  ❌ LLM 模块测试失败：${error.message}`);
    console.log();
  }
  
  // ========================================
  // 测试结果汇总
  // ========================================
  console.log('='.repeat(60));
  console.log('  测试结果汇总');
  console.log('='.repeat(60));
  console.log(`  总测试数：${totalTests}`);
  console.log(`  ✅ 通过：${passedTests}`);
  console.log(`  ❌ 失败：${failedTests}`);
  console.log(`  通过率：${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log();
  
  if (failedTests === 0) {
    console.log('🎉 所有测试通过！Phase 1 代码质量良好！');
    process.exit(0);
  } else {
    console.log('⚠️  有测试失败，请检查相关模块');
    process.exit(1);
  }
})();
