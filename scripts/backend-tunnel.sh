#!/usr/bin/env bash
# ═══ Easy Prompt — SSH Tunnel 管理（代理脚本） ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：代理调用 backend/scripts/ssh-tunnel.sh，方便从项目根目录操作
# 参数：start | stop | status | restart（默认 status）
# 影响范围：本地 SSH 隧道进程
# 潜在风险：无已知风险

set -euo pipefail
cd "$(dirname "$0")/../backend"

ACTION="${1:-status}"

case "$ACTION" in
  start|stop|status|restart)
    bash scripts/ssh-tunnel.sh "$ACTION"
    ;;
  -h|--help)
    echo "Usage: $(basename "$0") [start|stop|status|restart]"
    echo "  Manages SSH tunnel to VPS (PostgreSQL + Redis)"
    ;;
  *)
    echo "❌ Unknown action: $ACTION"
    echo "   Valid actions: start, stop, status, restart"
    exit 1
    ;;
esac
