#!/usr/bin/env bash
# ═══ Easy Prompt — 跨端发布门禁（Release Gate） ═══
# 2026-04-17 新增
# 变更类型：新增/测试/构建/文档
# 功能描述：提供 Task 8 的统一跨端 release gate，串联 parity、build、package 与产物 localhost 泄漏检查。
# 设计思路：
#   1. 默认执行离线可跑的关键门禁，避免把依赖远端服务或 shared-DB unlock 的测试强塞进默认发布流程。
#   2. 保持现有脚本职责边界：新脚本只做统一编排，不改 backend/browser/web/web-hub/vscode/intellij 各自已有脚本。
#   3. quick 模式保留高频回归能力：跳过 VS Code 打包与 IntelliJ buildPlugin，仅执行 compileKotlin。
# 参数与返回值：
#   --quick                     运行轻量门禁：跳过 VS Code package，IntelliJ 改为 compileKotlin。
#   --with-backend-integration  额外加入 backend HTTP integration smoke tests。
#   --with-browser-e2e          额外加入 browser Playwright E2E。
#   返回值：存在任一失败 section 时返回非 0；全部 section 通过时返回 0。
# 影响范围：scripts/release-gate.sh、发布前本地回归执行顺序、Task 8 文档口径。
# 潜在风险：full 模式首次执行可能因 IntelliJ/VS Code 打包依赖下载而耗时较长；无已知功能性风险。
# 2026-04-17 修复 — Full gate blocker cleanup
# 变更类型：修复/测试/发布
# 功能描述：修正 browser 工件目录识别，并将 localhost 泄漏门禁收紧到项目约定开发端口，避免第三方 vendor bundle 的裸 `http://localhost` fallback 误报。
# 设计思路：真正需要阻断的是 `localhost:3000/5173/5174` 或 `127.0.0.1:3000/5173/5174` 这类项目开发默认地址，不是任意第三方库内部保留的无端口 localhost 字符串。
# 参数与返回值：新增 `resolve_browser_artifact_dir()` / `run_browser_artifact_gate()`，对外 CLI 参数不变；artifact gate 成功返回 0，失败返回非 0。
# 影响范围：Browser / Web / PromptHub 产物 localhost leak gate 的误报率与发布阻断准确性。
# 潜在风险：若未来浏览器构建产物目录再次变更，需要在 `resolve_browser_artifact_dir()` 中补充新目录；当前无已知风险。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."

QUICK=false
WITH_BACKEND_INTEGRATION=false
WITH_BROWSER_E2E=false

for arg in "$@"; do
  case "$arg" in
    --quick)
      QUICK=true
      ;;
    --with-backend-integration)
      WITH_BACKEND_INTEGRATION=true
      ;;
    --with-browser-e2e)
      WITH_BROWSER_E2E=true
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--quick] [--with-backend-integration] [--with-browser-e2e]"
      echo "  --quick                     Skip VS Code package and use IntelliJ compileKotlin instead of buildPlugin"
      echo "  --with-backend-integration  Include backend HTTP integration smoke tests"
      echo "  --with-browser-e2e          Include browser Playwright E2E tests"
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

TIMEOUT_BIN=""
if command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_BIN="gtimeout"
elif command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN="timeout"
fi

run_with_timeout() {
  local seconds="$1"
  shift
  if [[ -n "$TIMEOUT_BIN" ]]; then
    "$TIMEOUT_BIN" "${seconds}s" "$@"
  else
    "$@"
  fi
}

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0

run_section() {
  local name="$1"
  shift

  echo "━━━ $name ━━━"
  if "$@"; then
    echo "✅ $name PASSED"
    ((TOTAL_PASS++))
  else
    local exit_code=$?
    echo "❌ $name FAILED (exit ${exit_code})"
    ((TOTAL_FAIL++))
  fi
  echo ""
}

skip_section() {
  local name="$1"
  local reason="$2"
  echo "━━━ $name ━━━"
  echo "⏭️  Skipped (${reason})"
  echo ""
  ((TOTAL_SKIP++))
}

scan_dir_for_localhost_leaks() {
  local label="$1"
  local dir="$2"
  local pattern='https?://(localhost|127\.0\.0\.1):(3000|5173|5174)([^0-9]|$)'

  if [[ ! -d "$dir" ]]; then
    echo "❌ Missing artifact directory: $dir"
    return 1
  fi

  if grep -RInE \
    --include='*.js' \
    --include='*.mjs' \
    --include='*.cjs' \
    --include='*.html' \
    --include='*.css' \
    --include='*.json' \
    "$pattern" "$dir"; then
    echo "❌ Found localhost leak(s) in $label"
    return 1
  fi

  echo "✅ No localhost leak found in $label"
}

resolve_browser_artifact_dir() {
  if [[ -d "$REPO_ROOT/browser/dist" ]]; then
    echo "$REPO_ROOT/browser/dist"
    return 0
  fi

  if [[ -d "$REPO_ROOT/browser/.output" ]]; then
    echo "$REPO_ROOT/browser/.output"
    return 0
  fi

  return 1
}

run_browser_artifact_gate() {
  local browser_artifact_dir
  browser_artifact_dir="$(resolve_browser_artifact_dir)" || {
    echo "❌ Missing browser artifact directory (expected browser/dist or browser/.output)"
    return 1
  }

  scan_dir_for_localhost_leaks "browser artifacts" "$browser_artifact_dir"
}

run_parity_tests() {
  node "$REPO_ROOT/tests/test-parity.js"
}

run_backend_build() {
  bash "$REPO_ROOT/scripts/backend-build.sh"
}

run_backend_integration() {
  node "$REPO_ROOT/tests/test-backend-integration.js"
}

run_browser_unit_tests() {
  bash "$REPO_ROOT/scripts/browser-test.sh" --mode=unit
}

run_browser_e2e_tests() {
  bash "$REPO_ROOT/scripts/browser-test.sh" --mode=e2e
}

run_browser_build() {
  if $QUICK; then
    bash "$REPO_ROOT/scripts/browser-build.sh" --browser=chrome
  else
    bash "$REPO_ROOT/scripts/browser-build.sh" --browser=chrome --zip
  fi
}

run_web_build() {
  bash "$REPO_ROOT/scripts/published/web-build.sh"
}

run_webhub_build() {
  bash "$REPO_ROOT/scripts/webhub-build.sh"
}

run_webhub_lint() {
  bash "$REPO_ROOT/scripts/webhub-lint.sh"
}

run_vscode_package() {
  run_with_timeout 600 bash "$REPO_ROOT/scripts/vscode-package.sh"
}

run_intellij_compile() {
  (
    cd "$REPO_ROOT/intellij"
    run_with_timeout 600 ./gradlew compileKotlin --info
  )
}

run_intellij_build() {
  run_with_timeout 1800 bash "$REPO_ROOT/scripts/intellij-build.sh"
}

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt — Release Gate          ║"
echo "╚══════════════════════════════════════╝"
echo "Mode: $(if $QUICK; then echo quick; else echo full; fi)"
if [[ -n "$TIMEOUT_BIN" ]]; then
  echo "Timeout helper: $TIMEOUT_BIN"
else
  echo "Timeout helper: none (commands run without wrapper)"
fi
echo ""

run_section "Cross-Platform Parity" run_parity_tests
run_section "Backend Build" run_backend_build

if $WITH_BACKEND_INTEGRATION; then
  run_section "Backend Integration" run_backend_integration
else
  skip_section "Backend Integration" "use --with-backend-integration to enable"
fi

run_section "Browser Unit Tests" run_browser_unit_tests
if $WITH_BROWSER_E2E; then
  run_section "Browser E2E" run_browser_e2e_tests
else
  skip_section "Browser E2E" "use --with-browser-e2e to enable"
fi
run_section "Browser Build (Chrome)" run_browser_build
run_section "Browser Artifact Localhost Gate" run_browser_artifact_gate

run_section "Web Build" run_web_build
run_section "Web Artifact Localhost Gate" scan_dir_for_localhost_leaks "web/dist" "$REPO_ROOT/web/dist"

run_section "PromptHub Build" run_webhub_build
run_section "PromptHub Lint" run_webhub_lint
run_section "PromptHub Artifact Localhost Gate" scan_dir_for_localhost_leaks "web-hub/dist" "$REPO_ROOT/web-hub/dist"

if $QUICK; then
  skip_section "VS Code Package" "quick mode"
  run_section "IntelliJ compileKotlin" run_intellij_compile
else
  run_section "VS Code Package" run_vscode_package
  run_section "IntelliJ BuildPlugin" run_intellij_build
fi

echo "═══════════════════════════════════════"
echo "Results: ${TOTAL_PASS} passed, ${TOTAL_FAIL} failed, ${TOTAL_SKIP} skipped"
echo "═══════════════════════════════════════"

if [[ "$TOTAL_FAIL" -eq 0 ]]; then
  echo "✅ Release gate passed"
  exit 0
fi

echo "❌ Release gate failed"
exit 1
