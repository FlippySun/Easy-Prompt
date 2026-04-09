#!/usr/bin/env bash
# ═══ Easy Prompt — 后端测试 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：运行后端各类测试（单元/集成/覆盖率）
# 设计思路：按 --mode 参数选择测试类型，默认 unit
# 参数：
#   --mode unit|integration|coverage|all  测试类型（默认 unit）
#   --watch                               启用 watch 模式（仅 unit）
# 影响范围：测试输出
# 潜在风险：integration 需 SSH tunnel 连接远端 DB

set -euo pipefail
REPO_ROOT="$(dirname "$0")/.."

MODE="unit"
WATCH=false

for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE="${arg#--mode=}" ;;
    --watch) WATCH=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--mode=unit|integration|coverage|all] [--watch]"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Backend — Test          ║"
echo "╚══════════════════════════════════════╝"
echo "Mode: $MODE"
echo ""

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
