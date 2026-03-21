# Checklist

## 模块迁移检查

- [ ] `src/crawler/retry.js` 已创建，包含 `fetchWithRetry` 函数
- [ ] `src/crawler/fetcher.js` 已迁移并使用 `fetchWithRetry`
- [ ] `src/crawler/parser.js` 已迁移
- [ ] `src/crawler/github_api.js` 已迁移
- [ ] `src/crawler/crawl.js` 已迁移并重写
- [ ] `src/generator/generator.js` 已迁移
- [ ] `src/generator/analyzer.js` 已迁移
- [ ] `src/generator/translator.js` 已迁移

## 清理检查

- [ ] `src/generator/feishu.js` 已删除
- [ ] `.github/` 目录已删除（如果存在）
- [ ] 没有任何代码引用已删除的文件

## 重试机制检查

- [ ] `src/crawler/retry.js` 实现了固定 5 分钟延迟重试
- [ ] `src/crawler/fetcher.js` 配置了抓取重试（5 分钟延迟，最多 5 次）
- [ ] `src/analyzer/insight-analyzer.js` 配置了 AI 重试（指数退避，最多 3 次）

## 功能检查

- [ ] `src/crawler/crawl.js` 支持 `daily`/`weekly`/`monthly` 参数
- [ ] `src/crawler/crawl.js` 支持 `--no-push` 参数跳过推送
- [ ] 完整流程可执行：抓取 → 解析 → AI 分析 → HTML 生成 → 推送
- [ ] 配置从 `.env` 读取，不依赖 GitHub Secrets

## 命令检查

- [ ] 日报命令 `node src/crawler/crawl.js daily --no-push` 可正常工作
- [ ] 周报命令 `node src/crawler/crawl.js weekly --no-push` 可正常工作
- [ ] 月报命令 `node src/crawler/crawl.js monthly --no-push` 可正常工作
- [ ] 移除 `--no-push` 后推送功能正常

## 配置检查

- [ ] `package.json` 包含所有必要依赖
- [ ] `.env.example` 包含所有必要环境变量示例
- [ ] 飞书通知配置正确
- [ ] WeLink 通知配置正确
- [ ] LLM API 配置正确

## 测试检查

- [ ] `npm install` 可成功执行
- [ ] 测试模块可正常运行（如果有）
