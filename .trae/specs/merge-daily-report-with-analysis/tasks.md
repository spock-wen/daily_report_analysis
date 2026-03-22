# Tasks

## 阶段一：创建重试模块

- [x] Task 1.1: 创建 `src/crawler/retry.js`
  - 实现 `fetchWithRetry` 函数（固定 5 分钟延迟重试）
  - 定义可重试错误列表（临时性错误）
  - 支持最多 5 次重试

## 阶段二：迁移 crawler 模块到 analysis 项目

- [x] Task 2.1: 迁移 `src/crawler/` 目录
  - 从 daily_report 迁移 `crawler/` 目录
  - 包含：fetcher.js, parser.js, github_api.js, crawl.js, utils.js

- [x] Task 2.2: 迁移 `src/generator/` Markdown 部分
  - 从 daily_report 迁移 `generator.js`, `analyzer.js`

## 阶段三：添加重试逻辑

- [x] Task 3.1: 修改 `src/crawler/fetcher.js`
  - 使用 `fetchWithRetry` 替代原生 fetch
  - 配置抓取重试参数（5 分钟延迟，最多 5 次）

- [x] Task 3.2: 修改 `src/analyzer/insight-analyzer.js`
  - 添加 AI 分析重试逻辑（指数退避，最多 3 次）

## 阶段四：重构主流程

- [x] Task 4.1: 重写 `src/crawler/crawl.js`
  - 整合完整流程：抓取 → 解析 → AI 分析 → HTML 生成 → 推送
  - 支持命令行参数（daily/weekly/monthly）
  - 支持 `--no-push` 参数跳过推送
  - 从 .env 读取所有配置

## 阶段五：清理旧代码

- [x] Task 5.1: 删除 `src/generator/feishu.js`
  - 已确认不存在，无需删除

- [x] Task 5.2: 删除 `.github/` 目录（如果存在）
  - 已确认不存在，无需删除

## 阶段六：更新配置和依赖

- [x] Task 6.1: 更新 `package.json`
  - 添加 `npm run crawl` 命令

- [x] Task 6.2: 确保 `.env.example` 完整
  - 已添加 GITHUB_TOKEN 配置

## 阶段七：测试验证

- [x] Task 7.1: 测试日报生成流程（无推送）
  - `node src/crawler/crawl.js daily --no-push`
  - 抓取、解析、生成 JSON 正常
  - HTML 报告生成正常

- [ ] Task 7.2: 测试周报生成流程（无推送）
  - `node src/crawler/crawl.js weekly --no-push`

- [ ] Task 7.3: 测试月报生成流程（无推送）
  - `node src/crawler/crawl.js monthly --no-push`

- [ ] Task 7.4: 验证推送功能
  - 确认移除 `--no-push` 后推送正常

- [ ] Task 7.5: 验证重试机制
  - 模拟网络错误，确认重试逻辑正确（5 分钟延迟，最多 5 次）

## Task Dependencies

- Task 1.1 完成后才能进行 Task 3.1
- Task 2.x 完成后才能进行 Task 4.1
- Task 3.x 和 Task 4.1 完成后才能进行 Task 7.x
