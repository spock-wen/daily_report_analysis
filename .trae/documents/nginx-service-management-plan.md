# Nginx 多服务统一管理方案

## 一、现状分析

当前服务器 `root@223.109.200.65` 上 Nginx 部署了多个服务，存在以下问题：
- 服务来源复杂（Docker 容器 + 独立进程）
- 缺乏统一配置管理
- 服务状态监控困难
- 启停操作繁琐
- 配置分散，维护成本高

## 二、解决方案

### 方案一：Docker Compose + Nginx Proxy Manager（推荐）

#### 核心思路
将所有服务容器化，使用 Docker Compose 统一管理，配合 Nginx Proxy Manager 实现反向代理配置可视化管理。

#### 实施步骤

**1. 环境准备**
```bash
# 安装 Docker 和 Docker Compose
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**2. 创建统一项目目录结构**
```bash
mkdir -p /opt/services/{nginx,app1,app2,app3}
mkdir -p /opt/docker-data/{volumes,certs,logs}
```

**3. 创建主 docker-compose.yml**
```yaml
version: '3.8'

services:
  # Nginx Proxy Manager
  nginx-proxy-manager:
    image: 'jc21/nginx-proxy-manager:latest'
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
      - '81:81'  # 管理界面
    volumes:
      - /opt/docker-data/nginx-proxy-manager/data:/data
      - /opt/docker-data/nginx-proxy-manager/letsencrypt:/etc/letsencrypt
      - /opt/docker-data/logs/nginx:/var/log/nginx
    networks:
      - webnet

  # 服务 1: GitHub Daily Report
  github-daily-report:
    image: node:18-alpine
    container_name: github-daily-report
    restart: unless-stopped
    working_dir: /app
    volumes:
      - /root/github_daily_report:/app
      - /opt/docker-data/logs/github-report:/app/logs
    environment:
      - NODE_ENV=production
      - FEISHU_APP_ID=${FEISHU_APP_ID}
      - FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
    command: node generate-html.js
    networks:
      - webnet
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.github-report.rule=Host('report.wenspock.site')"

  # 服务 2: 示例服务
  service2:
    image: your-image:tag
    container_name: service2
    restart: unless-stopped
    ports:
      - '3001:3000'
    networks:
      - webnet

networks:
  webnet:
    driver: bridge

volumes:
  nginx-proxy-manager-data:
  nginx-proxy-manager-letsencrypt:
```

**4. 非 Docker 服务迁移**
```bash
# 识别当前运行的非 Docker 服务
ps aux | grep -E 'node|python|java|go'

# 查看 Nginx 配置
cat /etc/nginx/nginx.conf
ls -la /etc/nginx/conf.d/

# 将服务配置写入 docker-compose.yml
# 测试容器化运行
```

**5. 统一管理脚本**
创建 `/opt/services/manage.sh`：
```bash
#!/bin/bash

SERVICES_DIR="/opt/services"
COMPOSE_FILE="/opt/services/docker-compose.yml"

case "$1" in
  start)
    docker-compose -f $COMPOSE_FILE up -d
    echo "✅ 所有服务已启动"
    ;;
  stop)
    docker-compose -f $COMPOSE_FILE down
    echo "⏹️ 所有服务已停止"
    ;;
  restart)
    docker-compose -f $COMPOSE_FILE restart
    echo "🔄 所有服务已重启"
    ;;
  status)
    docker-compose -f $COMPOSE_FILE ps
    ;;
  logs)
    docker-compose -f $COMPOSE_FILE logs -f $2
    ;;
  *)
    echo "用法：$0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
```

#### 优势
- ✅ 统一管理界面（Nginx Proxy Manager Web UI）
- ✅ 一键启停所有服务
- ✅ 自动 SSL 证书管理
- ✅ 服务隔离，互不干扰
- ✅ 易于备份和迁移
- ✅ 资源使用清晰可见

---

### 方案二：Supervisor + Nginx 配置中心

#### 核心思路
使用 Supervisor 管理所有进程（包括 Docker 容器），配合集中式 Nginx 配置管理。

#### 实施步骤

**1. 安装 Supervisor**
```bash
sudo apt-get install supervisor  # Ubuntu/Debian
sudo yum install supervisor      # CentOS/RHEL
```

**2. 创建统一配置目录**
```bash
mkdir -p /etc/supervisor/conf.d
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled
```

**3. Supervisor 配置示例**
`/etc/supervisor/conf.d/github-report.conf`:
```ini
[program:github-daily-report]
command=node /root/github_daily_report/generate-html.js
directory=/root/github_daily_report
autostart=true
autorestart=true
stderr_logfile=/var/log/github-report/err.log
stdout_logfile=/var/log/github-report/out.log
user=root
environment=NODE_ENV="production",FEISHU_APP_ID="xxx"
```

**4. Nginx 配置中心**
`/etc/nginx/sites-available/report.wenspock.site`:
```nginx
server {
    listen 80;
    server_name report.wenspock.site;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**5. 管理脚本**
`/usr/local/bin/service-manager`:
```bash
#!/bin/bash

case "$1" in
  start)
    sudo supervisorctl start all
    sudo nginx -t && sudo systemctl reload nginx
    ;;
  stop)
    sudo supervisorctl stop all
    sudo systemctl stop nginx
    ;;
  restart)
    sudo supervisorctl restart all
    sudo nginx -t && sudo systemctl reload nginx
    ;;
  status)
    sudo supervisorctl status
    sudo systemctl status nginx
    ;;
  *)
    echo "用法：$0 {start|stop|restart|status}"
    ;;
esac
```

#### 优势
- ✅ 适合混合部署（Docker + 原生进程）
- ✅ 进程自动重启
- ✅ 日志集中管理
- ✅ 配置结构化

---

### 方案三：Systemd + Nginx Include

#### 核心思路
使用 Systemd 管理所有服务，配合 Nginx 的 include 指令实现配置模块化。

#### 实施步骤

**1. 创建 Systemd 服务文件**
`/etc/systemd/system/github-daily-report.service`:
```ini
[Unit]
Description=GitHub Daily Report Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/github_daily_report
ExecStart=/usr/bin/node generate-html.js
Environment=NODE_ENV=production
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**2. Nginx 模块化配置**
`/etc/nginx/nginx.conf`:
```nginx
http {
    # ... 其他配置
    
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

**3. 服务注册脚本**
`/usr/local/bin/register-service`:
```bash
#!/bin/bash
# 自动注册服务到 Nginx 和 Systemd
```

#### 优势
- ✅ 系统级服务管理
- ✅ 开机自启动
- ✅ 与系统深度集成
- ✅ 资源控制精确

---

## 三、推荐方案对比

| 特性 | Docker Compose | Supervisor | Systemd |
|------|---------------|------------|---------|
| 易用性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 隔离性 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| 迁移性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 监控能力 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 学习成本 | 低 | 中 | 中 |
| 适合场景 | 新项目/可容器化 | 混合部署 | 系统级服务 |

## 四、实施建议

### 阶段一：信息收集（1-2 天）
1. 盘点所有运行中的服务
   ```bash
   # 查看 Nginx 配置
   nginx -T > /tmp/nginx-full-config.txt
   
   # 查看运行的服务
   ps aux --sort=-%mem | head -20
   
   # 查看端口占用
   netstat -tlnp
   
   # 查看 Docker 容器
   docker ps -a
   ```

2. 记录每个服务的信息：
   - 服务名称
   - 访问域名/端口
   - 启动方式
   - 配置文件位置
   - 日志位置
   - 依赖关系

### 阶段二：方案选择（1 天）
- 如果服务都可以容器化 → **方案一（Docker Compose）**
- 如果有部分服务无法容器化 → **方案二（Supervisor）**
- 如果需要系统级管理 → **方案三（Systemd）**

### 阶段三：迁移实施（3-7 天）
1. 搭建管理框架
2. 逐个服务迁移测试
3. 配置监控和日志
4. 备份原配置
5. 切换流量

### 阶段四：优化完善（持续）
1. 添加监控告警（Prometheus + Grafana）
2. 配置日志聚合（ELK Stack）
3. 自动化部署（CI/CD）
4. 定期备份配置

## 五、附加管理工具

### 1. 服务状态监控面板
```bash
# 安装 Portainer（Docker 管理）
docker run -d -p 9000:9000 --name portainer \
  --restart always -v /var/run/docker.sock:/var/run/docker.sock \
  portainer/portainer-ce
```

### 2. 日志聚合
```bash
# 使用 Docker 日志驱动
# 或使用 Loki + Promtail 轻量级日志系统
```

### 3. 自动化备份脚本
```bash
#!/bin/bash
# /opt/scripts/backup-services.sh
BACKUP_DIR="/opt/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 备份 Nginx 配置
cp -r /etc/nginx $BACKUP_DIR/

# 备份 Docker 配置
docker-compose config > $BACKUP_DIR/docker-compose.yml

# 备份 Supervisor 配置
cp -r /etc/supervisor $BACKUP_DIR/

# 压缩
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
```

## 六、总结

**推荐方案：Docker Compose + Nginx Proxy Manager**

理由：
1. 管理简单，Web 界面操作
2. 服务隔离，安全性高
3. 易于扩展和迁移
4. 社区活跃，文档完善
5. 适合长期维护

**实施路线图：**
```
Day 1-2:  信息收集 + 环境评估
Day 3:    搭建 Docker + Docker Compose
Day 4-5:  迁移服务到 Docker
Day 6:    配置 Nginx Proxy Manager
Day 7:    测试 + 文档编写
Day 8+:   监控优化 + 自动化
```

## 七、下一步行动

1. **立即执行**：
   ```bash
   # 1. 盘点现有服务
   ssh root@223.109.200.65 "nginx -T && docker ps && ps aux" > current_services.txt
   
   # 2. 备份当前配置
   scp root@223.109.200.65:/etc/nginx ./nginx-backup
   
   # 3. 评估可容器化的服务
   ```

2. **选择方案**：根据服务特性选择合适的管理方案

3. **开始迁移**：按阶段逐步迁移，确保业务不中断

---

**文档版本**: v1.0  
**创建时间**: 2026-03-01  
**适用服务器**: root@223.109.200.65
