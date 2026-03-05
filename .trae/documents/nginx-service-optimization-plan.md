# 服务器服务管理优化方案

## 一、现状盘点（2026-03-01）

### 1.1 服务器基本信息
- **服务器 IP**: 223.109.200.65
- **内存**: 3.8GB（已用 3.5GB，剩余 112MB，⚠️ 内存紧张）
- **磁盘**: 59GB（已用 21GB，剩余 36GB，36%）
- **CPU**: 多核（worker_processes auto）

### 1.2 运行中的服务清单

#### Docker 容器（6 个运行中）
| 容器名称 | 镜像 | 端口映射 | 状态 | 备注 |
|--------|------|----------|------|------|
| spockchef-backend | docker_spockchef-backend | 8070→8070 | Up 7 days | 后端服务 |
| spockchef-frontend | docker_spockchef-frontend | 8060→8060 | Up 5 days | 前端服务 |
| spockchef-db | postgres:15-alpine | 5432→5432 | Up 7 days | 数据库 |
| ppt-nginx | nginx:alpine | 8010→8010 | Up 5 days | PPT 前端 |
| ppt-certbot | certbot/certbot | - | Up 2 weeks | SSL 证书管理 |
| portfolio | portfolio_web | 127.0.0.1:3000→3000 | Up 2 weeks | 个人网站 |

**已停止的容器**（6 个，可清理）：
- elated_ptolemy, focused_hermann, crazy_bhaskara, agitated_swirles, gallant_noyce, hardcore_gauss

#### 独立进程服务
| 进程名 | 端口 | 说明 |
|--------|------|------|
| openclaw-gateway | 18789, 18791, 18792 | OpenClaw 网关（独立二进制） |
| ifrit-agent | 1234 | 监控代理 |
| jdog-kunlunmirror | - | 云监控镜像 |

#### Nginx 配置（6 个站点）
| 配置文件 | 域名 | 后端端口 | SSL | 状态 |
|---------|------|----------|-----|------|
| openclaw.conf | openclaw.wenspock.site | 18789 | ✅ | 启用 |
| portfolio.conf | person.wenspock.site | 3000 | ✅ | 启用 |
| ppt.conf | *.wenspock.site (通配符) | 8010 | ✅ | 启用 |
| ppt-server.conf | ppt.wenspock.site | 8010 | ✅ | 启用（重复） |
| report.wenspock.site.conf | report.wenspock.site | 8080 | ✅ | 启用 |
| spockchef.conf.disabled | your-domain.com | 3000 | ❌ | 禁用 |

### 1.3 问题分析

#### 🔴 严重问题
1. **内存严重不足**：3.8GB 内存已用 3.5GB（92%），仅剩 112MB
2. **服务管理分散**：Docker + 独立进程 + Nginx，无统一管理
3. **配置冗余**：ppt.conf 和 ppt-server.conf 都代理到 8010 端口

#### ⚠️ 中等问题
4. **端口暴露过多**：5432 (PostgreSQL) 公网可访问 ⚠️ 安全隐患
5. **无统一监控**：无服务健康检查、无日志聚合、无告警机制

---

## 二、优化方案

### 方案一：轻量级统一管理（推荐，适合当前内存状况）

#### 核心思路
**不增加新组件**，通过优化现有配置实现统一管理，重点解决内存紧张问题。

#### 实施步骤

##### 第一步：清理无用容器（立即执行，释放资源）
```bash
# 清理已停止的容器
docker rm elated_ptolemy focused_hermann crazy_bhaskara agitated_swirles gallant_noyce hardcore_gauss

# 清理未使用的镜像
docker image prune -f
```

**预计释放**: 约 500MB-1GB 磁盘空间，减少 Docker 开销

##### 第二步：限制内存使用（关键）
```bash
# 限制数据库内存
docker update --memory 512m --memory-swap 512m spockchef-db

# 限制后端服务
docker update --memory 256m --memory-swap 256m spockchef-backend
docker update --memory 128m --memory-swap 128m spockchef-frontend

# 限制个人网站
docker update --memory 256m --memory-swap 256m portfolio

# 限制 PPT 服务
docker update --memory 128m --memory-swap 128m ppt-nginx
docker update --memory 64m --memory-swap 64m ppt-certbot
```

##### 第三步：创建统一管理服务
创建 `/usr/local/bin/service-manager`：

```bash
#!/bin/bash
# 统一服务管理脚本

start_all() {
  echo "🚀 启动所有服务..."
  systemctl start nginx
  systemctl start docker
  
  # 启动 Docker 容器
  docker start spockchef-backend spockchef-frontend spockchef-db portfolio ppt-nginx ppt-certbot
  
  echo "✅ 所有服务已启动"
}

stop_all() {
  echo "⏹️ 停止所有服务..."
  docker stop spockchef-backend spockchef-frontend spockchef-db portfolio ppt-nginx ppt-certbot
  systemctl stop nginx
  echo "✅ 所有服务已停止"
}

restart_all() {
  stop_all
  sleep 2
  start_all
}

status_all() {
  echo "�� 服务状态"
  echo "============"
  
  echo -e "\n🔹 Nginx:"
  systemctl is-active nginx
  
  echo -e "\n🔹 Docker:"
  systemctl is-active docker
  
  echo -e "\n🔹 Docker 容器:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  
  echo -e "\n🔹 内存使用:"
  free -h
}

backup_configs() {
  BACKUP_DIR="/root/backups/$(date +%Y%m%d_%H%M%S)"
  mkdir -p $BACKUP_DIR
  
  echo "💾 备份配置到 $BACKUP_DIR"
  cp -r /etc/nginx $BACKUP_DIR/
  tar -czf $BACKUP_DIR.tar.gz -C /root/backups $(basename $BACKUP_DIR)
  rm -rf $BACKUP_DIR
  echo "✅ 备份完成：$BACKUP_DIR.tar.gz"
}

case "$1" in
  start) start_all ;;
  stop) stop_all ;;
  restart) restart_all ;;
  status) status_all ;;
  backup) backup_configs ;;
  *)
    echo "用法：$0 {start|stop|restart|status|backup}"
    exit 1
    ;;
esac
```

赋予执行权限：
```bash
chmod +x /usr/local/bin/service-manager
```

##### 第四步：添加健康检查
创建 `/usr/local/bin/health-check`：

```bash
#!/bin/bash
# 服务健康检查脚本

LOG_FILE="/var/log/service-health.log"

check_service() {
  local name=$1
  local url=$2
  
  if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
    echo "✅ $(date): $name 正常" >> $LOG_FILE
  else
    echo "❌ $(date): $name 失败" >> $LOG_FILE
  fi
}

echo "=== $(date) ===" >> $LOG_FILE
check_service "nginx" "http://localhost:80"
check_service "openclaw" "http://localhost:18789"
check_service "portfolio" "http://localhost:3000"
check_service "ppt" "http://localhost:8010"
check_service "spockchef" "http://localhost:8060"
```

添加到 crontab（每 5 分钟检查一次）：
```bash
echo "*/5 * * * * /usr/local/bin/health-check" | crontab -
```

#### 方案一优势
- ✅ 无需安装新组件，不增加内存负担
- ✅ 统一管理入口，简化操作
- ✅ 内存限制防止资源耗尽
- ✅ 健康检查及时发现问题
- ✅ 配置备份保证安全

---

## 三、立即行动计划

### 第一阶段：紧急优化（今天执行，1-2 小时）

**优先级：🔴 最高**

1. **清理无用容器**（5 分钟）
```bash
docker rm $(docker ps -a -q --filter "status=exited")
docker image prune -f
```

2. **限制 Docker 容器内存**（10 分钟）
```bash
docker update --memory 512m --memory-swap 512m spockchef-db
docker update --memory 256m --memory-swap 256m spockchef-backend
docker update --memory 128m --memory-swap 128m spockchef-frontend
docker update --memory 256m --memory-swap 256m portfolio
docker update --memory 128m --memory-swap 128m ppt-nginx
```

3. **部署统一管理服务**（15 分钟）
```bash
# 创建 service-manager 脚本（见上文）
chmod +x /usr/local/bin/service-manager

# 测试
service-manager status
```

4. **添加健康检查**（10 分钟）
```bash
# 创建 health-check 脚本（见上文）
chmod +x /usr/local/bin/health-check

# 添加到 crontab
echo "*/5 * * * * /usr/local/bin/health-check" | crontab -
```

5. **备份配置**（5 分钟）
```bash
service-manager backup
```

### 第二阶段：优化加固（本周内）

**优先级：⚠️ 高**

1. **关闭不必要的公网端口** - PostgreSQL 5432 改为仅内网访问
2. **合并冗余 Nginx 配置** - 删除 ppt-server.conf
3. **配置日志轮转** - 防止日志占满磁盘
4. **添加监控告警** - 可选，使用轻量级监控

---

## 四、日常管理命令速查

### 使用 service-manager
```bash
service-manager status      # 查看所有服务状态
service-manager start       # 启动所有服务
service-manager restart     # 重启所有服务
service-manager stop        # 停止所有服务
service-manager backup      # 备份配置
```

### Docker 常用命令
```bash
docker ps -a                # 查看容器状态
docker logs -f <name>       # 查看容器日志
docker restart <name>       # 重启容器
docker stats                # 查看资源使用
```

### Nginx 常用命令
```bash
nginx -t                    # 测试配置
systemctl reload nginx      # 重载配置
tail -f /var/log/nginx/access.log   # 查看访问日志
```

---

## 五、总结

### 当前核心问题
1. ⚠️ **内存严重不足**（剩余 112MB）
2. 🔧 **管理分散**（Docker + 独立进程 + Nginx）
3. �� **缺乏监控**（无健康检查、无告警）

### 推荐方案：轻量级统一管理（方案一）
- ✅ 无需安装新组件
- ✅ 不增加内存负担
- ✅ 快速实施（2-4 小时）
- ✅ 风险低
- ✅ 统一管理入口

### 关键行动
1. **立即**：清理容器、限制内存
2. **今天**：部署 service-manager、health-check
3. **本周**：优化配置、添加日志轮转

---

**文档版本**: v2.0  
**创建时间**: 2026-03-01  
**适用服务器**: root@223.109.200.65  
**内存状态**: ⚠️ 紧张（剩余 112MB）  
**建议优先级**: 🔴 立即执行第一阶段优化
