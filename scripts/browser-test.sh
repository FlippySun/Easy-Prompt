#!/usr/bin/env bash
# ═══ Easy Prompt — 浏览器扩展测试 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：运行浏览器扩展单元测试和 E2E 测试
# 参数：
#   --mode unit|e2e|all（默认 unit）
#   --watch   启用 watch 模式（仅 unit）
# 影响范围：测试输出
# 潜在风险：e2e 需 Playwright 浏览器已安装

set -euo pipefail
cd "$(dirname "$0")/../browser"

MODE="unit"
WATCH=false

for arg in "$@"; do
  case "$arg" in
    --mode=*) MODE="${arg#--mode=}" ;;
    --watch) WATCH=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--mode=unit|e2e|all] [--watch]"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Browser — Test          ║"
echo "╚══════════════════════════════════════╝"
echo "Mode: $MODE"
echo ""

run_unit() {
  echo "📋 Running unit tests (vitest)..."
  if $WATCH; then
    npm run test:unit:watch
  else
    npm run test:unit
  fi
}

run_e2e() {
  echo "📋 Running E2E tests (Playwright)..."
  npm run test:e2e
}

case "$MODE" in
  unit) run_unit ;;
  e2e)  run_e2e ;;
  all)
    run_unit
    echo ""
    run_e2e
    ;;
  *)
    echo "❌ Unknown mode: $MODE"
    exit 1
    ;;
esac
