#!/usr/bin/env bash
# ═══ Easy Prompt — 全项目测试 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：依次运行所有端的测试（backend + browser + parity + integration）
# 设计思路：按顺序执行各端测试，汇总结果；任一失败不阻断后续
# 参数：
#   --quick  只运行 unit 测试，跳过 integration/e2e
# 影响范围：测试输出
# 潜在风险：integration 测试需 SSH tunnel + 远端服务可用

set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

QUICK=false
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--quick]"
      echo "  --quick  Run only unit tests (skip integration/e2e)"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt — Full Test Suite       ║"
echo "╚══════════════════════════════════════╝"
echo ""

TOTAL_PASS=0
TOTAL_FAIL=0

run_section() {
  local name="$1"
  shift
  echo "━━━ $name ━━━"
  if "$@"; then
    echo "✅ $name PASSED"
    ((TOTAL_PASS++))
  else
    echo "❌ $name FAILED"
    ((TOTAL_FAIL++))
  fi
  echo ""
}

# 1. Backend Unit Tests
run_section "Backend Unit Tests" bash -c "cd '$REPO_ROOT/backend' && npm run test"

# 2. Browser Unit Tests
run_section "Browser Unit Tests" bash -c "cd '$REPO_ROOT/browser' && npm run test:unit"

# 3. Cross-Platform Parity
run_section "Parity Tests" bash -c "cd '$REPO_ROOT' && node tests/test-parity.js"

if ! $QUICK; then
  # 4. Backend Integration
  run_section "Backend Integration" bash -c "cd '$REPO_ROOT' && node tests/test-backend-integration.js"

  # 5. Browser E2E (only if Playwright installed)
  if [ -d "$REPO_ROOT/browser/node_modules/@playwright" ]; then
    run_section "Browser E2E" bash -c "cd '$REPO_ROOT/browser' && npm run test:e2e"
  else
    echo "━━━ Browser E2E ━━━"
    echo "⏭️  Skipped (Playwright not installed)"
    echo ""
  fi
fi

# ── Summary ──
echo "═══════════════════════════════════════"
echo "Results: ${TOTAL_PASS} passed, ${TOTAL_FAIL} failed"
echo "═══════════════════════════════════════"

[ "$TOTAL_FAIL" -eq 0 ] && exit 0 || exit 1
