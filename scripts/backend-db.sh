#!/usr/bin/env bash
# ═══ Easy Prompt — 数据库管理 ═══
# 2026-04-08 新增 | 2026-04-09 优化：执行前自动确保 SSH 隧道
# 变更类型：优化
# 功能描述：Prisma 数据库常用操作快捷入口，自动确保 SSH tunnel 连接远端 DB
# 设计思路：除 generate（不需要 DB 连接）外，所有操作都通过 _lib.sh ensure_tunnel
# 参数：
#   migrate      运行 dev 迁移（本地开发）
#   migrate-prod 运行 deploy 迁移（生产）
#   seed         执行种子数据
#   studio       打开 Prisma Studio GUI
#   generate     重新生成 Prisma Client（不需要 tunnel）
#   reset        重置数据库（⚠️ 破坏性）
#   --no-tunnel  跳过自动 SSH tunnel
# 影响范围：数据库结构/数据
# 潜在风险：reset 会清空所有数据；VPS 不可达时 tunnel 启动失败

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/../backend"

# 2026-04-09 — 引入共享库，获取 ensure_tunnel / --no-tunnel 支持
source "${SCRIPT_DIR}/_lib.sh"
parse_tunnel_flag "$@"

ACTION="${1:-help}"

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Backend — Database      ║"
echo "╚══════════════════════════════════════╝"

# 2026-04-09 — generate 不需要 DB 连接，其余操作自动确保 tunnel
case "$ACTION" in
  generate|help|-h|--help)
    ;; # 不需要 tunnel
  *)
    require_tunnel
    ;;
esac

case "$ACTION" in
  migrate)
    echo "📋 Running prisma migrate dev..."
    npx prisma migrate dev
    ;;
  migrate-prod)
    echo "📋 Running prisma migrate deploy..."
    npx prisma migrate deploy
    ;;
  seed)
    echo "📋 Running prisma db seed..."
    npx prisma db seed
    ;;
  studio)
    echo "📋 Opening Prisma Studio..."
    npx prisma studio
    ;;
  generate)
    echo "📋 Running prisma generate..."
    npx prisma generate
    ;;
  reset)
    echo "⚠️  This will RESET the database (drop all data + re-migrate + re-seed)"
    read -p "Are you sure? (y/N) " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      npx prisma migrate reset
    else
      echo "Cancelled."
    fi
    ;;
  help|-h|--help)
    echo ""
    echo "Usage: $(basename "$0") <action>"
    echo ""
    echo "Actions:"
    echo "  migrate       Run dev migration (creates new migration)"
    echo "  migrate-prod  Run deploy migration (apply pending)"
    echo "  seed          Execute seed data"
    echo "  studio        Open Prisma Studio GUI"
    echo "  generate      Regenerate Prisma Client"
    echo "  reset         Reset DB (⚠️ destructive)"
    ;;
  *)
    echo "❌ Unknown action: $ACTION"
    echo "   Run with --help for usage"
    exit 1
    ;;
esac
