#!/bin/bash
# Phase2 后端服务部署验证脚本
# 2026-04-08 新增 — 验证 VPS 部署状态
# 用途：检查 Nginx/DNS/SSL/.env/PM2/Cron/Analytics API 是否配置正确

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
BACKEND_DIR="/www/wwwroot/api.zhiz.chat"
BACKEND_PORT=3000
API_DOMAIN="api.zhiz.chat"

echo "========================================"
echo "Phase2 后端服务部署验证"
echo "========================================"
echo ""

# 1. 检查后端目录
echo "[1/8] 检查后端目录..."
if [ -d "$BACKEND_DIR" ]; then
    echo -e "${GREEN}✓${NC} 后端目录存在: $BACKEND_DIR"
else
    echo -e "${RED}✗${NC} 后端目录不存在: $BACKEND_DIR"
    echo "请先部署后端代码到该目录"
    exit 1
fi
echo ""

# 2. 检查 .env.production 配置
echo "[2/8] 检查 .env.production 配置..."
ENV_FILE="$BACKEND_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✓${NC} .env 文件存在"

    # 检查关键配置项
    MISSING=0
    for key in DATABASE_URL JWT_SECRET PROVIDER_ENCRYPTION_KEY; do
        if grep -q "^$key=" "$ENV_FILE"; then
            value=$(grep "^$key=" "$ENV_FILE" | cut -d'=' -f2)
            if [[ "$value" == *"TODO"* ]] || [[ -z "$value" ]]; then
                echo -e "${RED}✗${NC} $key 未配置或仍为 TODO"
                MISSING=1
            else
                echo -e "${GREEN}✓${NC} $key 已配置"
            fi
        else
            echo -e "${RED}✗${NC} $key 未配置"
            MISSING=1
        fi
    done

    if [ $MISSING -eq 0 ]; then
        echo -e "${GREEN}✓${NC} 所有关键配置项已设置"
    else
        echo -e "${RED}✗${NC} 部分配置项缺失，请编辑 $ENV_FILE"
    fi
else
    echo -e "${RED}✗${NC} .env 文件不存在"
    echo "请从 backend/.env.production 复制并配置"
fi
echo ""

# 3. 检查 PM2 进程状态
# 2026-04-08 修复：NVM 环境下 PM2 不在默认 PATH 中，需显式加载
echo "[3/8] 检查 PM2 进程状态..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null
if command -v pm2 &> /dev/null; then
    PM2_ONLINE=$(pm2 list 2>/dev/null | grep "easy-prompt-api" | grep -c "online")
    if [ "$PM2_ONLINE" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} PM2 进程运行中 ($PM2_ONLINE 个实例 online)"
        pm2 list 2>/dev/null | grep "easy-prompt-api"
    else
        echo -e "${RED}✗${NC} PM2 进程未运行"
        echo "请运行: cd $BACKEND_DIR && pm2 start ecosystem.config.js --env production"
    fi
else
    echo -e "${RED}✗${NC} PM2 未安装（已检查 NVM 路径）"
    echo "请运行: npm install -g pm2"
fi
echo ""

# 4. 检查后端服务端口监听
echo "[4/8] 检查后端服务端口监听..."
if netstat -tuln | grep -q ":$BACKEND_PORT "; then
    echo -e "${GREEN}✓${NC} 端口 $BACKEND_PORT 正在监听"
else
    echo -e "${RED}✗${NC} 端口 $BACKEND_PORT 未监听"
    echo "请检查 PM2 进程是否正常启动"
fi
echo ""

# 5. 检查 Nginx 配置（宝塔）
echo "[5/8] 检查 Nginx 配置..."
if command -v nginx &> /dev/null; then
    # 检查配置文件是否存在
    NGINX_CONF="/www/server/panel/vhost/nginx/$API_DOMAIN.conf"
    if [ -f "$NGINX_CONF" ]; then
        echo -e "${GREEN}✓${NC} Nginx 配置文件存在: $NGINX_CONF"

        # 检查配置是否包含反向代理到后端端口
        if grep -q "proxy_pass.*:$BACKEND_PORT" "$NGINX_CONF"; then
            echo -e "${GREEN}✓${NC} 反向代理配置正确 (→ :$BACKEND_PORT)"
        else
            echo -e "${RED}✗${NC} 反向代理配置缺失或错误"
            echo "请检查 proxy_pass 是否指向 127.0.0.1:$BACKEND_PORT"
        fi

        # 检查 SSL 配置
        if grep -q "ssl_certificate" "$NGINX_CONF"; then
            echo -e "${GREEN}✓${NC} SSL 证书已配置"
        else
            echo -e "${YELLOW}⚠${NC} SSL 证书未配置"
        fi

        # 测试 Nginx 配置语法
        if nginx -t &> /dev/null; then
            echo -e "${GREEN}✓${NC} Nginx 配置语法正确"
        else
            echo -e "${RED}✗${NC} Nginx 配置语法错误"
            nginx -t
        fi
    else
        echo -e "${RED}✗${NC} Nginx 配置文件不存在"
        echo "请在宝塔面板中创建 $API_DOMAIN 站点"
    fi
else
    echo -e "${RED}✗${NC} Nginx 未安装"
fi
echo ""

# 6. 检查 DNS 解析
echo "[6/8] 检查 DNS 解析..."
DNS_IP=$(dig +short $API_DOMAIN @8.8.8.8)
if [ -n "$DNS_IP" ]; then
    echo -e "${GREEN}✓${NC} DNS 解析成功: $API_DOMAIN → $DNS_IP"

    # 获取本机公网 IP
    LOCAL_IP=$(curl -s ifconfig.me)
    if [ "$DNS_IP" == "$LOCAL_IP" ]; then
        echo -e "${GREEN}✓${NC} DNS 指向正确（本机 IP: $LOCAL_IP）"
    else
        echo -e "${YELLOW}⚠${NC} DNS IP ($DNS_IP) 与本机 IP ($LOCAL_IP) 不匹配"
    fi
else
    echo -e "${RED}✗${NC} DNS 解析失败"
    echo "请在域名解析商添加 A 记录: $API_DOMAIN → $(curl -s ifconfig.me)"
fi
echo ""

# 7. 检查 HTTPS 访问
echo "[7/8] 检查 HTTPS 访问..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$API_DOMAIN/health --max-time 5 || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✓${NC} HTTPS 访问正常 (HTTP 200)"
else
    echo -e "${RED}✗${NC} HTTPS 访问失败 (HTTP $HTTP_CODE)"
    echo "请检查 Nginx 配置和 SSL 证书"

    # 尝试 HTTP 访问
    HTTP_CODE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://$API_DOMAIN/health --max-time 5 || echo "000")
    if [ "$HTTP_CODE_HTTP" == "200" ]; then
        echo -e "${YELLOW}⚠${NC} HTTP 访问正常，但 HTTPS 失败，可能是 SSL 配置问题"
    fi
fi
echo ""

# 8. 测试 Analytics API（需要 admin token）
echo "[8/8] 测试 Analytics API..."
echo "注意：此测试需要有效的 admin token"
echo "如需测试，请手动运行："
echo "  curl -H 'Authorization: Bearer <YOUR_ADMIN_TOKEN>' https://$API_DOMAIN/api/v1/admin/analytics/summary"
echo ""
echo "或测试公开端点："
HEALTH_RESPONSE=$(curl -s https://$API_DOMAIN/health --max-time 5 || echo '{"error":"failed"}')
if echo "$HEALTH_RESPONSE" | grep -q "status"; then
    echo -e "${GREEN}✓${NC} /health 端点响应正常"
    echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}✗${NC} /health 端点响应异常"
fi
echo ""

# 9. 检查 Cron 任务（通过 Pino 应用日志）
# 2026-04-08 修复：Pino 输出到 app.log.1（pino-roll），非 PM2 的 combined.log
echo "[9/8] 检查 Cron 任务日志..."
APP_LOG="$BACKEND_DIR/logs/app.log.1"
if [ -f "$APP_LOG" ]; then
    echo -e "${GREEN}✓${NC} 应用日志文件存在: app.log.1"

    # 检查最近是否有 cron 任务日志（Pino JSON 格式）
    CRON_COUNT=$(grep -c 'Cron job' "$APP_LOG" 2>/dev/null || echo 0)
    if [ "$CRON_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} 检测到 $CRON_COUNT 条 Cron 任务执行日志"
        grep 'Cron job' "$APP_LOG" | tail -5 | while read line; do
            NAME=$(echo "$line" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
            MSG=$(echo "$line" | grep -o '"msg":"[^"]*"' | cut -d'"' -f4)
            echo "  → $NAME: $MSG"
        done
    else
        echo -e "${YELLOW}⚠${NC} 未检测到 Cron 任务执行日志"
        echo "请检查 CRON_ENABLED 环境变量是否为 true"
    fi
else
    echo -e "${YELLOW}⚠${NC} 应用日志文件不存在 (app.log.1)"
    echo "Pino 日志可能尚未轮转，检查 out.log 或 combined.log"
fi
echo ""

echo "========================================"
echo "验证完成"
echo "========================================"
