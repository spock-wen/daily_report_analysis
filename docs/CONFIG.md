# 配置说明

## 环境变量配置

本项目使用 `.env` 文件管理敏感配置和运行时变量。

### 快速开始

1. 复制示例文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入实际配置值

### 配置项说明

#### 通知服务配置

**飞书通知**（可选）
```env
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
FEISHU_RECEIVE_ID=your-open-id
FEISHU_RECEIVE_ID_TYPE=open_id
FEISHU_ENABLED=true  # 设置为 false 禁用飞书通知
```

**WeLink 通知**（可选）
```env
WELINK_WEBHOOK_URLS=https://your-webhook-url
WELINK_ENABLED=false  # 设置为 true 启用 WeLink 通知
```

> 💡 **提示**：多个 WeLink webhook URL 用逗号分隔

#### LLM 配置（必需）

```env
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.example.com/v1
LLM_MODEL=qwen-plus
LLM_TEMPERATURE=0.7      # AI 生成多样性 (0.0-1.0)
LLM_MAX_TOKENS=3000      # 最大输出 token 数
LLM_TIMEOUT=60000        # 请求超时时间 (毫秒)
```

#### 报告配置

```env
REPORT_BASE_URL=https://report.wenspock.site  # 报告访问地址
```

#### 服务器配置（可选）

```env
SERVER_USER=root
SERVER_IP=your-server-ip
SERVER_PATH=/srv/www/daily-report
```

## 配置文件结构

`config/config.json` 包含非敏感的配置项，使用 `${环境变量}` 语法引用环境变量：

```json
{
  "notifier": {
    "feishu": {
      "enabled": "${FEISHU_ENABLED}",
      "appId": "${FEISHU_APP_ID}"
    }
  }
}
```

## 配置优先级

1. 环境变量（`.env` 文件或系统环境变量）
2. `config.json` 中的默认值
3. 代码中的硬编码默认值

## 使用配置工具

在代码中使用统一的配置工具：

```javascript
const { getConfig, getEnv, getEnvBool, getEnvNumber } = require('./src/utils/config');

// 获取配置对象
const config = getConfig();

// 获取环境变量
const apiKey = getEnv('LLM_API_KEY');

// 获取布尔值
const feishuEnabled = getEnvBool('FEISHU_ENABLED', true);

// 获取数字
const timeout = getEnvNumber('LLM_TIMEOUT', 60000);
```

## 安全提示

- ✅ `.env` 文件已在 `.gitignore` 中，不会被提交
- ✅ 敏感信息（密钥、密码）必须放在 `.env` 中
- ✅ `config.json` 可以安全提交到 Git
- ⚠️ 不要将 `.env` 文件分享给他人
- ⚠️ 生产环境使用独立的环境变量配置

## 环境切换

可以通过创建不同的 `.env` 文件来切换环境：

```bash
.env.development    # 开发环境配置
.env.production     # 生产环境配置
.env.test          # 测试环境配置
```

使用时复制对应的配置：
```bash
cp .env.production .env
```
