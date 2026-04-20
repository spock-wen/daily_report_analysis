# alibaba/OpenSandbox

## 基本信息
- 首次上榜：2026-03-05
- 最近上榜：2026-03-05
- 上榜次数：1
- 领域分类：Sandbox, Containerization, AI Infrastructure
- 语言：Python, TypeScript, JavaScript
- GitHub Stars: 10000+（最后更新：2026-04-20）

## 核心功能
- 生产级FastAPI服务，管理容器化沙盒的生命周期
- 可插拔运行时：Docker（生产就绪）和Kubernetes（生产就绪）
- 标准化REST接口：创建、启动、暂停、恢复、删除
- 自动过期机制：可配置TTL和续期
- 访问控制：API Key认证
- 网络模式：主机（共享网络，性能优先）和桥接（隔离网络，内置HTTP路由）
- 资源配额：CPU/内存限制
- 可观测性：统一状态和转换跟踪
- 注册表支持：公共和私有镜像
- 网络策略：统一入口网关和每个沙盒的出口控制
- 强隔离：支持gVisor、Kata Containers、Firecracker microVM
- 多语言SDK：JavaScript/TypeScript、Go等

## 版本历史



### 2026-03-05（日报收录）
**来源**: [日报 2026-03-05](../../reports/daily/github-ai-trending-2026-03-05.html)
**分析**: alibaba/OpenSandbox：统一Docker/K8s沙盒API，为编码/GUI/RL代理提供隔离式代码执行与环境可控性，填补AI infra关键缺口 - 立即试用shannon对自有Web应用执行无提示渗透测试（docker run -it --rm -v $(pwd):/app keygraphhq/shannon scan http://localhost:3000）

## 跨项目关联
（待分析）
