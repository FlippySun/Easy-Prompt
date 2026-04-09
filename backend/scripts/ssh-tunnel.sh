#!/usr/bin/env bash
# ═══ Easy Prompt Backend — SSH Tunnel to VPS ═══
# 2026-04-08 新增 — 本地开发环境 SSH 隧穿脚本
# 变更类型：新增
# 设计思路：建立到 VPS (107.151.137.198) 的 SSH 隧道，将远端 PostgreSQL 和 Redis
#   映射到本地端口，供 .env 中 DATABASE_URL 和 REDIS_URL 使用。
#   支持 start/stop/status/restart 四种操作。
#   使用 autossh 或 plain ssh -f -N 模式，带 ServerAliveInterval 防断连。
# 参数：
#   $1 — 操作：start | stop | status | restart（默认 start）
# 影响范围：本地开发环境 DB/Redis 连接
# 潜在风险：VPS 网络不可达时隧道建立失败（脚本会报错退出）
#
# 使用方式：
#   ./scripts/ssh-tunnel.sh start    # 启动隧道
#   ./scripts/ssh-tunnel.sh stop     # 停止隧道
#   ./scripts/ssh-tunnel.sh status   # 检查隧道状态
#   ./scripts/ssh-tunnel.sh restart  # 重启隧道

set -euo pipefail

# ── 配置 ──────────────────────────────────────────
VPS_HOST="107.151.137.198"
VPS_USER="root"
VPS_KEY="$HOME/.ssh/easy-prompt-vps"
VPS_PORT=22

# 本地端口 → 远端端口映射
LOCAL_PG_PORT=15432
REMOTE_PG_PORT=5432
LOCAL_REDIS_PORT=16379
REMOTE_REDIS_PORT=6379

# SSH 参数
SSH_OPTS=(
  -o ServerAliveInterval=60
  -o ServerAliveCountMax=3
  -o ExitOnForwardFailure=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
)

# ── 辅助函数 ──────────────────────────────────────
get_tunnel_pid() {
  pgrep -f "ssh.*-L ${LOCAL_PG_PORT}:127.0.0.1:${REMOTE_PG_PORT}.*${VPS_HOST}" 2>/dev/null || true
}

info()    { echo -e "\033[0;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[0;32m[OK]\033[0m $*"; }
warn()    { echo -e "\033[0;33m[WARN]\033[0m $*"; }
error()   { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; }

# ── 操作 ──────────────────────────────────────────
start_tunnel() {
  local pid
  pid=$(get_tunnel_pid)
  if [[ -n "$pid" ]]; then
    success "SSH tunnel already running (PID: $pid)"
    return 0
  fi

  info "Starting SSH tunnel to ${VPS_HOST}..."
  info "  PostgreSQL: localhost:${LOCAL_PG_PORT} → ${VPS_HOST}:${REMOTE_PG_PORT}"
  info "  Redis:      localhost:${LOCAL_REDIS_PORT} → ${VPS_HOST}:${REMOTE_REDIS_PORT}"

  ssh -f -N \
    -L "${LOCAL_PG_PORT}:127.0.0.1:${REMOTE_PG_PORT}" \
    -L "${LOCAL_REDIS_PORT}:127.0.0.1:${REMOTE_REDIS_PORT}" \
    "${SSH_OPTS[@]}" \
    -i "$VPS_KEY" \
    -p "$VPS_PORT" \
    "${VPS_USER}@${VPS_HOST}"

  sleep 1
  pid=$(get_tunnel_pid)
  if [[ -n "$pid" ]]; then
    success "SSH tunnel started (PID: $pid)"

    # 验证连通性
    if command -v pg_isready &>/dev/null; then
      if pg_isready -h 127.0.0.1 -p "$LOCAL_PG_PORT" -t 5 &>/dev/null; then
        success "PostgreSQL connection verified"
      else
        warn "PostgreSQL not responding on port ${LOCAL_PG_PORT} (tunnel up, DB may not be running)"
      fi
    fi
  else
    error "Failed to start SSH tunnel"
    return 1
  fi
}

stop_tunnel() {
  local pid
  pid=$(get_tunnel_pid)
  if [[ -z "$pid" ]]; then
    warn "No SSH tunnel process found"
    return 0
  fi

  info "Stopping SSH tunnel (PID: $pid)..."
  kill "$pid" 2>/dev/null || true
  sleep 1

  # 确认已停止
  pid=$(get_tunnel_pid)
  if [[ -z "$pid" ]]; then
    success "SSH tunnel stopped"
  else
    warn "Tunnel still running, sending SIGKILL..."
    kill -9 "$pid" 2>/dev/null || true
    success "SSH tunnel force-stopped"
  fi
}

status_tunnel() {
  local pid
  pid=$(get_tunnel_pid)
  if [[ -n "$pid" ]]; then
    success "SSH tunnel is running (PID: $pid)"
    info "  PostgreSQL: localhost:${LOCAL_PG_PORT}"
    info "  Redis:      localhost:${LOCAL_REDIS_PORT}"
    return 0
  else
    warn "SSH tunnel is NOT running"
    info "  Run: ./scripts/ssh-tunnel.sh start"
    return 1
  fi
}

# ── 入口 ──────────────────────────────────────────
ACTION="${1:-start}"

case "$ACTION" in
  start)   start_tunnel ;;
  stop)    stop_tunnel ;;
  status)  status_tunnel ;;
  restart) stop_tunnel; start_tunnel ;;
  *)
    error "Unknown action: $ACTION"
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
