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
# 潜在风险：reset 会清空所有数据；VPS 不可达时 tunnel 启动失败；2026-04-16 Batch B 起 protected/shared DB 下的高风险命令会被阻断或要求显式确认，防止误操作再次冲击正常数据库。

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/../backend"

# 2026-04-09 — 引入共享库，获取 ensure_tunnel / --no-tunnel 支持
source "${SCRIPT_DIR}/_lib.sh"
parse_tunnel_flag "$@"

ACTION="${1:-help}"
DATABASE_NAME="$(get_database_name)"

# 2026-04-16 新增 — Backend DB protected/shared DB guard
# 变更类型：新增/安全/运维
# 功能描述：在保留 shared/prod DB 直连工作流的前提下，把 `migrate dev` 这类不应打到正常数据库的命令直接封死，并为 `seed` / `migrate deploy` / `studio` / `reset` 增加 typed confirmation 或显式 unlock。
# 设计思路：
#   1. `prisma migrate dev` 本质属于开发期命令，不应在 protected/shared DB 上执行，因此直接拒绝。
#   2. `seed` / `migrate deploy` / `studio` 在部分运维场景下可能是合理动作，因此保留能力，但要求操作者输入当前数据库名确认。
#   3. `reset` 额外要求环境变量 unlock + 输入数据库名 + y/N 三层确认，避免再次出现“一条命令抹掉正常数据库”的事故。
# 参数与返回值：assert_protected_db_migrate_dev_blocked() 和 confirm_protected_db_action()/assert_protected_db_reset_allowed() 在危险场景下返回非零并中止脚本。
# 影响范围：scripts/backend-db.sh、backend/package.json `db:*` wrapper、shared/prod DB 手工运维入口。
# 潜在风险：若确需在 protected/shared DB 上做种子、deploy 或打开 Studio，需承担额外交互确认；这是预期安全门。
assert_protected_db_migrate_dev_blocked() {
  local database_name="$1"

  if is_protected_db "$database_name"; then
    _lib_error "Refusing to run 'prisma migrate dev' against protected database '${database_name}'."
    _lib_error "  Use 'migrate-prod' for deliberate deploy-style migrations on the normal database."
    return 1
  fi

  return 0
}

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
    assert_protected_db_migrate_dev_blocked "$DATABASE_NAME" || exit 1
    echo "📋 Running prisma migrate dev..."
    npm run db:migrate:_raw
    ;;
  migrate-prod)
    confirm_protected_db_action "prisma migrate deploy" || exit 1
    echo "📋 Running prisma migrate deploy..."
    npm run db:migrate:prod:_raw
    ;;
  seed)
    confirm_protected_db_action "prisma db seed" || exit 1
    echo "📋 Running prisma db seed..."
    npm run db:seed:_raw
    ;;
  studio)
    confirm_protected_db_action "open Prisma Studio" || exit 1
    echo "📋 Opening Prisma Studio..."
    npm run db:studio:_raw
    ;;
  generate)
    echo "📋 Running prisma generate..."
    npx prisma generate
    ;;
  reset)
    assert_protected_db_reset_allowed "prisma migrate reset" || exit 1
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
    echo ""
    echo "Protected/shared DB safeguards:"
    echo "  - migrate       blocked on protected/shared DB"
    echo "  - migrate-prod  requires typing current DB name on protected/shared DB"
    echo "  - seed/studio   require typing current DB name on protected/shared DB"
    echo "  - reset         additionally requires ALLOW_PROTECTED_DB_RESET=I_ACK_PROTECTED_DB_RESET"
    ;;
  *)
    echo "❌ Unknown action: $ACTION"
    echo "   Run with --help for usage"
    exit 1
    ;;
esac
