#!/usr/bin/env bash
# ═══ Easy Prompt — 后端开发服务器 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：启动后端 dev 服务器（含可选 SSH tunnel 自动连接远端 DB）
# 设计思路：先检查 tunnel 状态，未启动则提示启动；然后运行 nodemon
# 参数：
#   --with-tunnel   自动启动 SSH tunnel（默认不启动）
#   --skip-generate 跳过 prisma generate
# 影响范围：本地开发环境
# 潜在风险：无已知风险

set -euo pipefail
cd "$(dirname "$0")/../backend"

WITH_TUNNEL=false
SKIP_GENERATE=false

for arg in "$@"; do
  case "$arg" in
    --with-tunnel) WITH_TUNNEL=true ;;
    --skip-generate) SKIP_GENERATE=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--with-tunnel] [--skip-generate]"
      echo "  --with-tunnel    Auto-start SSH tunnel to VPS DB"
      echo "  --skip-generate  Skip prisma generate step"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Backend — Dev Server    ║"
echo "╚══════════════════════════════════════╝"

# ── 1. SSH Tunnel ──
if $WITH_TUNNEL; then
  echo "📋 Starting SSH tunnel..."
  bash scripts/ssh-tunnel.sh start
else
  if bash scripts/ssh-tunnel.sh status 2>/dev/null | grep -q "running"; then
    echo "✅ SSH tunnel is running"
  else
    echo "⚠️  SSH tunnel not running. Start with: npm run tunnel:start"
    echo "   Or re-run with: $0 --with-tunnel"
  fi
fi

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
