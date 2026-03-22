# 合并 daily_report 与 daily_report_analysis Spec

## Why
将两个关联项目（daily_report 抓取端 + daily_report_analysis 分析端）合并为一个统一项目，减少维护成本，简化部署架构。同时添加重试机制提高稳定性。

## What Changes

### 目录结构重组
- 将 `daily_report` 的 `src/crawler/` 迁移到 `daily_report_analysis`
- 将 `daily_report_analysis` 的 `src/analyzer/`、`src/generator/`（HTML）、`src/notifier/`、`src/loader/`、`src/utils/`（logger, path）保留
- 删除 `src/generator/feishu.js`（用 analysis 的 message-sender.js 替代）
- 删除 `.github/` 目录（不需要 GitHub Actions）

### 核心流程整合
- 抓取 → 解析 → AI 分析 → HTML 生成 → 推送，合并为一条完整链路
- 配置统一从 `.env` 读取，不再依赖 GitHub Secrets

### 重试机制
- **抓取阶段**：失败后 5 分钟重试，最多 5 次
- **AI 分析阶段**：指数退避重试，最多 3 次
- 其他阶段不重试，失败即终止

### 命令行参数
- `node src/crawler/crawl.js daily` - 生成日报并推送
- `node src/crawler/crawl.js weekly` - 生成周报并推送
- `node src/crawler/crawl.js monthly` - 生成月报并推送
- `node src/crawler/crawl.js <type> --no-push` - 生成报告但不推送（调试用）

### 移除内容
- `src/generator/feishu.js` - 废弃，使用 notifier/message-sender.js
- `.github/workflows/` - 整个删除

## Impact
- Affected specs：报告生成流程、AI 分析流程、通知推送流程
- Affected code：
  - `src/crawler/crawl.js` - 新增，主流程入口
  - `src/crawler/fetcher.js` - 新增，抓取（带重试）
  - `src/crawler/retry.js` - 新增，重试工具
  - `src/analyzer/insight-analyzer.js` - 添加 AI 分析重试逻辑
  - `src/notifier/message-sender.js` - 统一使用
  - `package.json` - 合并依赖

## ADDED Requirements

### Requirement: 抓取重试机制
系统 SHALL 在 GitHub Trending 抓取失败时自动重试，失败后 5 分钟重试，最多 5 次。

#### Scenario: 抓取成功
- **WHEN** 首次请求成功
- **THEN** 直接返回结果，不触发重试

#### Scenario: 临时性失败（超时/429/5xx）
- **WHEN** 抓取因临时性错误失败
- **THEN** 等待 5 分钟（300 秒）后重试，最多 5 次

#### Scenario: 永久性失败（404/401/400）
- **WHEN** 抓取因永久性错误失败
- **THEN** 立即终止，不重试

### Requirement: AI 分析重试机制
系统 SHALL 在 AI 分析失败时自动重试，采用指数退避策略。

#### Scenario: AI 分析成功
- **WHEN** AI 返回有效洞察
- **THEN** 保存结果并继续

#### Scenario: AI 分析失败
- **WHEN** AI 请求超时或返回错误
- **THEN** 等待 baseDelay * 2^attempt + jitter 后重试，最多 3 次

### Requirement: 统一消息发送器
系统 SHALL 使用 `src/notifier/message-sender.js` 作为唯一的通知发送模块。

#### Scenario: 发送飞书通知
- **WHEN** 配置了飞书环境变量且启用了飞书通知，且未使用 `--no-push`
- **THEN** 使用 MessageSender 发送飞书消息

#### Scenario: 发送 WeLink 通知
- **WHEN** 配置了 WeLink 环境变量且启用了 WeLink 通知，且未使用 `--no-push`
- **THEN** 使用 MessageSender 发送 WeLink 消息

### Requirement: 调试模式（--no-push）
系统 SHALL 支持 `--no-push` 参数，用于调试时跳过推送。

#### Scenario: 使用 --no-push
- **WHEN** 命令行包含 `--no-push` 参数
- **THEN** 生成 HTML 报告但不发送任何推送通知

## MODIFIED Requirements

### Requirement: 主入口流程
原：crawl.js 只负责抓取和生成 JSON
改：crawl.js 负责完整流程：抓取 → 解析 → AI 分析 → HTML 生成 → 推送（可选跳过）

## REMOVED Requirements

### Requirement: GitHub Actions 定时触发
**Reason**: 改用服务器 cron 触发，更简单可靠
**Migration**: 用户在服务器上配置 crontab

### Requirement: GitHub Secrets 配置
**Reason**: 改用本地 .env 文件管理配置
**Migration**: 将 GitHub Secrets 内容迁移到服务器的 .env 文件
