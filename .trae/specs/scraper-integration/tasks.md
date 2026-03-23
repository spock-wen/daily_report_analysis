# Tasks

- [x] Task 1: 项目准备与依赖安装
  - [x] 1.1 安装 node-cron 依赖
  - [x] 1.2 安装 cheerio 依赖（HTML 解析）
  - [x] 1.3 更新 .env.example 添加新配置项

- [x] Task 2: 创建抓取模块基础架构
  - [x] 2.1 创建 src/scraper/ 目录结构
  - [x] 2.2 实现 BaseScraper 基类
  - [x] 2.3 实现 RetryHandler 重试处理器
  - [x] 2.4 实现 HTML 解析器（GitHubTrendingParser）

- [x] Task 3: 实现 GitHub 抓取器
  - [x] 3.1 实现 GitHubScraper 类（核心抓取逻辑）
  - [x] 3.2 实现 DailyScraper 策略类
  - [x] 3.3 实现 WeeklyScraper 策略类
  - [x] 3.4 实现 MonthlyScraper 策略类
  - [x] 3.5 添加数据验证逻辑

- [x] Task 4: 实现定时任务调度器
  - [x] 4.1 创建 ScraperScheduler 类
  - [x] 4.2 配置日报定时任务（每天 8:00）
  - [x] 4.3 配置周报定时任务（周一 8:30）
  - [x] 4.4 配置月报定时任务（每月 1 日 9:00）
  - [x] 4.5 实现任务执行方法

- [x] Task 5: 集成一体化报告生成流程
  - [x] 5.1 实现抓取成功后自动触发分析
  - [x] 5.2 实现数据保存逻辑
  - [x] 5.3 集成 AI 分析模块调用
  - [x] 5.4 集成 HTML 报告生成
  - [x] 5.5 实现首页自动更新
  - [x] 5.6 集成推送通知（成功通知）
  - [x] 5.7 实现完整流程串联（抓取 → AI → HTML → 推送）

- [x] Task 6: 实现推送通知
  - [x] 6.1 实现 sendSuccessNotification 方法（成功通知）
  - [x] 6.2 实现 sendFailureNotification 方法（失败通知）
  - [x] 6.3 集成飞书通知（如果启用）
  - [x] 6.4 集成 WeLink 通知（如果启用）
  - [x] 6.5 添加成功通知模板（包含报告链接）
  - [x] 6.6 添加失败通知模板（包含错误信息）

- [x] Task 7: 日志与错误处理
  - [x] 7.1 添加详细日志记录
  - [x] 7.2 实现错误分类和处理
  - [x] 7.3 添加重试日志
  - [x] 7.4 添加成功/失败日志

- [x] Task 8: 创建启动脚本
  - [x] 8.1 创建 scripts/start-scraper.js（启动定时任务）
  - [x] 8.2 创建 scripts/run-once.js（手动执行一次）
  - [x] 8.3 更新 package.json 添加新命令

- [x] Task 9: 测试与验证
  - [x] 9.1 编写抓取模块单元测试
  - [x] 9.2 编写重试处理器单元测试
  - [x] 9.3 编写定时任务集成测试
  - [x] 9.4 手动测试完整流程
  - [x] 9.5 测试失败场景

- [ ] Task 10: 文档更新
  - [ ] 10.1 更新 README.md 添加抓取功能说明
  - [ ] 10.2 更新 docs/GUIDE.md 添加部署说明
  - [ ] 10.3 更新 docs/CONFIG.md 添加配置说明
  - [ ] 10.4 创建部署示例（systemd 服务配置）

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 5]
- [Task 7] depends on [Task 2]
- [Task 8] depends on [Task 4]
- [Task 9] depends on [Task 8]
- [Task 10] depends on [Task 9]
