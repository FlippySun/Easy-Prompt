#!/usr/bin/env bash
# ═══ Easy Prompt — 后端测试 ═══
# 2026-04-08 新增 | 2026-04-09 优化：integration/all 模式自动确保 SSH 隧道
# 变更类型：优化
# 功能描述：运行后端各类测试（单元/集成/覆盖率）
# 设计思路：按 --mode 参数选择测试类型；integration/all 通过 _lib.sh 自动拉起隧道
# 参数：
#   --mode unit|integration|coverage|all  测试类型（默认 unit）
#   --watch                               启用 watch 模式（仅 unit）
#   --no-tunnel                           跳过自动 SSH tunnel
# 影响范围：测试输出
# 潜在风险：VPS 不可达时 tunnel 启动失败，integration 测试会报错退出；2026-04-22 起 shared/prod DB backend Vitest 被永久禁止，必须切到 dedicated test DB 才能执行，防止再次触发 destructive test path。

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."

# 2026-04-09 — 引入共享库，获取 ensure_tunnel / --no-tunnel 支持
source "${SCRIPT_DIR}/_lib.sh"

# 2026-04-16 更新 — Backend test runner shared-DB guard（二层防护）
# 2026-04-22 更新 — 共享生产库事故后的永久止血
# 变更类型：修复/安全/测试/运维
# 功能描述：在触发 backend Vitest 前统一检查是否命中 protected/shared DB；命中时永久拒绝，彻底移除 shared/prod DB 的人工解锁入口。
# 设计思路：
#   1. helper/vitest.setup 已有进程内 guard，但 runner 层继续 fail-fast，能在启动测试前给出更直观错误。
#   2. 仅拦截会执行 backend Vitest 的模式；HTTP smoke integration 模式不直接经过本 guard。
#   3. 与 package.json 中新增的 `test:_raw` / `test:coverage:_raw` 配合，避免脚本 wrapper 自递归。
# 参数与返回值：assert_backend_vitest_allowed(mode) 复用 _lib.sh 中的 `assert_shared_db_test_allowed()`；安全时返回 0，不安全时输出原因并返回非零。
# 影响范围：scripts/backend-test.sh 所有走 backend Vitest 的模式（unit/coverage/all）。
# 潜在风险：若当前 DATABASE_URL 仍指向 shared/prod DB，backend Vitest 会立即失败；这是预期安全门。
assert_backend_vitest_allowed() {
  local mode_name="$1"
  assert_shared_db_test_allowed "$mode_name"
}

MODE="unit"
WATCH=false

# 解析 tunnel 标志（--no-tunnel）
parse_tunnel_flag "$@"

for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE="${arg#--mode=}" ;;
    --watch) WATCH=true ;;
    --no-tunnel) ;; # 已由 parse_tunnel_flag 处理
    -h|--help)
      echo "Usage: $(basename "$0") [--mode=unit|integration|coverage|all] [--watch] [--no-tunnel]"
      echo "       Protected/shared DB backend Vitest is permanently blocked."
      echo "       Point DATABASE_URL to an explicit *_test / *_ci / *_spec database before running backend Vitest."
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Backend — Test          ║"
echo "╚══════════════════════════════════════╝"
echo "Mode: $MODE"
echo ""

# 2026-04-09 — integration/all 模式需要远端 DB，自动确保 tunnel
case "$MODE" in
  integration|all)
    require_tunnel
    ;;
esac

run_unit() {
  echo "📋 Running unit tests (vitest)..."
  assert_backend_vitest_allowed "backend test mode=unit" || exit 1
  cd "$REPO_ROOT/backend"
  if $WATCH; then
    npm run test:watch:_raw
  else
    npm run test:_raw
  fi
}

run_integration() {
  echo "📋 Running integration tests..."
  cd "$REPO_ROOT"
  node tests/test-backend-integration.js "$@"
}

run_coverage() {
  echo "📋 Running tests with coverage..."
  assert_shared_db_test_allowed "backend test mode=coverage" || exit 1
  cd "$REPO_ROOT/backend"
  npm run test:coverage:_raw
}

case "$MODE" in
  unit)        run_unit ;;
  integration) run_integration ;;
  coverage)    run_coverage ;;
  all)
    run_unit
    echo ""
    run_integration
    ;;
  *)
    echo "❌ Unknown mode: $MODE"
    echo "   Valid modes: unit, integration, coverage, all"
    exit 1
    ;;
esac
