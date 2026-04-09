#!/usr/bin/env bash
# ═══ Easy Prompt — 后端开发服务器 ═══
# 2026-04-08 新增 | 2026-04-09 优化：默认自动拉起 SSH 隧道
# 变更类型：优化
# 功能描述：启动后端 dev 服务器，自动确保 SSH tunnel 连接远端 DB/Redis
# 设计思路：通过 _lib.sh 的 ensure_tunnel() 幂等拉起隧道，再运行 nodemon
# 参数：
#   --no-tunnel     跳过自动 SSH tunnel（本地 DB 或 CI 环境）
#   --skip-generate 跳过 prisma generate
# 影响范围：本地开发环境
# 潜在风险：VPS 不可达时 tunnel 启动失败，脚本会报错退出

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/../backend"

# 2026-04-09 — 引入共享库，获取 ensure_tunnel / --no-tunnel 支持
source "${SCRIPT_DIR}/_lib.sh"

SKIP_GENERATE=false

# 解析 tunnel 标志（--no-tunnel）
parse_tunnel_flag "$@"

for arg in "$@"; do
  case "$arg" in
    --skip-generate) SKIP_GENERATE=true ;;
    --no-tunnel) ;; # 已由 parse_tunnel_flag 处理
    -h|--help)
      echo "Usage: $(basename "$0") [--no-tunnel] [--skip-generate]"
      echo "  --no-tunnel      Skip auto SSH tunnel (local DB or CI)"
      echo "  --skip-generate  Skip prisma generate step"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Backend — Dev Server    ║"
echo "╚══════════════════════════════════════╝"

# ── 1. SSH Tunnel（默认自动确保，--no-tunnel 跳过）──
require_tunnel

# ── 2. Prisma Generate ──
if ! $SKIP_GENERATE; then
  echo ""
  echo "📋 Running prisma generate..."
  npx prisma generate --no-hints 2>/dev/null || true
fi

# ── 3. Dev Server ──
echo ""
echo "📋 Starting dev server (nodemon)..."
echo "   Press Ctrl+C to stop"
echo ""
npm run dev
