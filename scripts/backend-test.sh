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
# 潜在风险：VPS 不可达时 tunnel 启动失败，integration 测试会报错退出

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."

# 2026-04-09 — 引入共享库，获取 ensure_tunnel / --no-tunnel 支持
source "${SCRIPT_DIR}/_lib.sh"

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
  cd "$REPO_ROOT/backend"
  if $WATCH; then
    npm run test:watch
  else
    npm run test
  fi
}

run_integration() {
  echo "📋 Running integration tests..."
  cd "$REPO_ROOT"
  node tests/test-backend-integration.js "$@"
}

run_coverage() {
  echo "📋 Running tests with coverage..."
  cd "$REPO_ROOT/backend"
  npm run test:coverage
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
