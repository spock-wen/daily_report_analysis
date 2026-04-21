# KeygraphHQ/shannon

## 基本信息
- 首次上榜：2026-03-05
- 最近上榜：2026-03-06
- 上榜次数：2
- 领域分类：security, cybersecurity, penetration-testing, ai
- 语言：TypeScript
- GitHub Stars: 38485（最后更新：2026-04-18）

## 核心功能
- 全自主 AI 渗透测试工具，能够分析源代码、识别攻击向量并执行真实漏洞利用
- 在 XBOW 基准测试中实现 96.15% 的零提示、源码感知 Web 漏洞发现率
- 结合静态代码审查和动态利用，涵盖四个阶段：侦察、并行漏洞分析、并行利用和报告
- 针对注入、XSS、SSRF 和身份验证/授权问题等漏洞类型
- 每个发现都通过可重现的概念验证进行验证
- 支持作为 Docker 容器运行，可通过 `docker run -it --rm -v $(pwd):/app keygraphhq/shannon scan http://localhost:3000` 执行无提示渗透测试
- 提供 npx CLI，支持零安装使用
- 采用临时 Docker 工作器架构，每次扫描在独立容器中运行
- 支持多提供商 LLM 支持
- 提供 CI/CD 工作流，包括生产发布、beta 发布通道和回滚工作流
- 支持 Windows、Linux 权限和 ARM64 构建

## 版本历史



### 2026-03-05（日报收录）
**来源**: [日报 2026-03-05](../../reports/daily/github-ai-trending-2026-03-05.html)
**分析**: KeygraphHQ/shannon：首个在XBOW基准中实现96.15%零提示、源码感知Web漏洞发现率的自主AI黑客 - 立即试用shannon对自有Web应用执行无提示渗透测试（docker run -it --rm -v $(pwd):/app keygraphhq/shannon scan http://localhost:3000）


### 2026-03-06（日报收录）
**来源**: [日报 2026-03-06](../../reports/daily/github-ai-trending-2026-03-06.html)
**分析**: KeygraphHQ/shannon：首个无提示、源码感知的AI红队探测器，XBOW基准96.15%漏洞检出率，填补LLM应用层渗透测试空白 - 立即试用microsoft/mcp-for-beginners中的Python MCP Server示例，用curl调用其/mcp/tools/list端点，理解上下文路由机制

## 跨项目关联
- **moeru-ai/airi**：建议试用其对自有Web应用执行无提示渗透测试
- **microsoft/mcp-for-beginners**：建议试用其中的Python MCP Server示例，理解上下文路由机制
