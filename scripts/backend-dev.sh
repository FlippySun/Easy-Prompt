#!/usr/bin/env bash
# ═══ Easy Prompt — 后端开发服务器 ═══
# 2026-04-08 新增 | 2026-04-09 优化：默认自动拉起 SSH 隧道
# 变更类型：优化
# 功能描述：启动后端 dev 服务器，自动确保 SSH tunnel 连接远端 DB/Redis
# 设计思路：通过 _lib.sh 的 ensure_tunnel() 幂等拉起隧道，再运行 nodemon
# 参数：
#   --no-tunnel     跳过自动 SSH tunnel（本地 DB 或 CI 环境）
#   --skip-generate 跳过 prisma generate
#   --allow-cron    显式允许本地 dev 进程注册 cron
# 影响范围：本地开发环境
# 潜在风险：VPS 不可达时 tunnel 启动失败，脚本会报错退出；2026-04-16 Batch B 起为避免 shared DB 上重复执行后台副作用任务，本地 dev 默认关闭 cron，只有显式开启时才注册。

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/../backend"

# 2026-04-09 — 引入共享库，获取 ensure_tunnel / --no-tunnel 支持
source "${SCRIPT_DIR}/_lib.sh"

SKIP_GENERATE=false
ALLOW_CRON=false

# 解析 tunnel 标志（--no-tunnel）
parse_tunnel_flag "$@"

for arg in "$@"; do
  case "$arg" in
    --skip-generate) SKIP_GENERATE=true ;;
    --allow-cron) ALLOW_CRON=true ;;
    --no-tunnel) ;; # 已由 parse_tunnel_flag 处理
    -h|--help)
      echo "Usage: $(basename "$0") [--no-tunnel] [--skip-generate] [--allow-cron]"
      echo "  --no-tunnel      Skip auto SSH tunnel (local DB or CI)"
      echo "  --skip-generate  Skip prisma generate step"
      echo "  --allow-cron     Allow local dev process to register cron jobs"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Backend — Dev Server    ║"
echo "╚══════════════════════════════════════╝"

# ── 1. SSH Tunnel（默认自动确保，--no-tunnel 跳过）──
require_tunnel

# ── 1.5 Local Cron Safety ──
# 2026-04-16 新增 — Batch B local cron guard
# 变更类型：新增/安全/运维
# 功能描述：本地 dev 默认导出 `CRON_ENABLED=false`，避免 shared DB 直连工作流下由本地进程重复执行 cleanup/logCompress/dailyStats/scenesSync 等后台副作用任务。
# 设计思路：
#   1. 保留本地直连正常数据库的开发姿势，不阻断 API 调试本身。
#   2. 仅把 cron 注册从“默认开启”改为“显式允许”，减少本地 accidental mutation 面。
#   3. 兼容已有环境变量：若用户显式传入 `CRON_ENABLED`，仍尊重其值；`--allow-cron` 只是提供更直观的 CLI 开关。
# 参数与返回值：无显式参数；通过环境变量导出 `CRON_ENABLED=false/true`。
# 影响范围：scripts/backend-dev.sh、backend/package.json `npm run dev`、本地 nodemon 启动流程。
# 潜在风险：若需要在本地调试 cron，需显式传 `--allow-cron` 或设置 `CRON_ENABLED=true`；这是预期安全门。
if $ALLOW_CRON; then
  export CRON_ENABLED=true
  echo "🔓 Local cron explicitly enabled for this dev session"
elif [[ -z "${CRON_ENABLED:-}" ]]; then
  export CRON_ENABLED=false
  echo "🛡️  Local cron disabled by default for this dev session (pass --allow-cron to enable)"
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
npm run dev:_raw
