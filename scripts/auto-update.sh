#!/bin/bash

# GitHub Trending 日报系统 - 自动更新脚本
# 每天凌晨 5 点执行，拉取最新代码并重启服务

set -e

LOG_FILE="/var/log/daily-report-update.log"
PROJECT_DIR="/srv/www/daily-report"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== 开始自动更新 ==="

cd "$PROJECT_DIR"

# 1. 检查 Git 状态
log "检查 Git 状态..."
git status > /dev/null 2>&1 || {
    log "❌ 错误：不在 Git 仓库中"
    exit 1
}

# 2. 保存当前提交哈希
OLD_COMMIT=$(git rev-parse HEAD)
log "当前版本：$OLD_COMMIT"

# 3. 拉取最新代码
log "拉取最新代码..."
git fetch origin main

# 4. 检查是否有更新
NEW_COMMIT=$(git rev-parse origin/main)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    log "✅ 已是最新版本，无需更新"
    exit 0
fi

log "发现新版本：$NEW_COMMIT"

# 5. 显示变更日志
log "变更内容："
git log --oneline HEAD..origin/main | while read line; do
    log "  - $line"
done

# 6. 合并代码（使用 --ff-only 避免合并冲突）
log "合并代码..."
git merge origin/main --ff-only || {
    log "⚠️  合并失败（可能有本地修改），跳过更新"
    exit 1
}

log "✅ 代码更新成功"

# 7. 安装依赖（如果 package.json 有变化）
if git diff HEAD~1 HEAD --name-only | grep -q "package.json"; then
    log "检测到 package.json 变化，安装依赖..."
    npm install --production
    log "✅ 依赖安装完成"
fi

# 8. 验证配置
log "验证配置..."
if [ ! -f ".env" ]; then
    log "⚠️  警告：.env 文件不存在"
else
    log "✅ .env 文件存在"
fi

# 9. 检查关键文件
if [ ! -f "scripts/generate-daily.js" ]; then
    log "❌ 错误：关键文件缺失，更新可能不完整"
    exit 1
fi

log "✅ 关键文件检查通过"

# 10. 发送通知（可选）
log "发送更新通知..."
if command -v curl &> /dev/null && [ -n "$FEISHU_WEBHOOK_URL" ]; then
    curl -s -X POST "$FEISHU_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"msg_type\": \"text\",
            \"content\": {
                \"text\": \"🔄 日报系统自动更新完成\n\n版本：${OLD_COMMIT:0:7} → ${NEW_COMMIT:0:7}\n时间：$(date '+%Y-%m-%d %H:%M:%S')\"
            }
        }" || log "⚠️  通知发送失败"
fi

log "=== 自动更新完成 ==="

exit 0
