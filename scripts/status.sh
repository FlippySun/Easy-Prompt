#!/usr/bin/env bash
# ═══ Easy Prompt — 项目状态总览 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：显示项目各端版本、依赖状态、隧道状态、VPS 健康等
# 影响范围：只读，无副作用
# 潜在风险：无已知风险

set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt — Project Status        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Versions ──
echo "📦 Versions"
VSCODE_VER=$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo "?")
BACKEND_VER=$(node -p "require('$REPO_ROOT/backend/package.json').version" 2>/dev/null || echo "?")
WEBHUB_VER=$(node -p "require('$REPO_ROOT/web-hub/package.json').version" 2>/dev/null || echo "?")
INTELLIJ_VER=$(grep 'version = ' "$REPO_ROOT/intellij/build.gradle.kts" 2>/dev/null | head -1 | sed 's/.*"\(.*\)"/\1/' || echo "?")
echo "  VS Code Extension : $VSCODE_VER"
echo "  Backend            : $BACKEND_VER"
echo "  PromptHub (web-hub): $WEBHUB_VER"
echo "  IntelliJ Plugin    : $INTELLIJ_VER"
echo ""

# ── Node.js ──
echo "🔧 Environment"
echo "  Node.js : $(node -v 2>/dev/null || echo 'not found')"
echo "  npm     : $(npm -v 2>/dev/null || echo 'not found')"
echo "  Java    : $(java -version 2>&1 | head -1 | awk -F '"' '{print $2}' || echo 'not found')"
echo ""

# ── Dependencies ──
echo "📋 Dependencies"
check_deps() {
  local name="$1" dir="$2"
  if [ -d "$dir/node_modules" ]; then
    echo "  $name: ✅ installed"
  else
    echo "  $name: ❌ not installed"
  fi
}
check_deps "Root"       "$REPO_ROOT"
check_deps "Backend"    "$REPO_ROOT/backend"
check_deps "Browser"    "$REPO_ROOT/browser"
check_deps "PromptHub"  "$REPO_ROOT/web-hub"
echo ""

# ── SSH Tunnel ──
echo "🔗 SSH Tunnel"
if bash "$REPO_ROOT/backend/scripts/ssh-tunnel.sh" status 2>/dev/null | grep -q "running"; then
  echo "  Status: ✅ running"
else
  echo "  Status: ❌ not running"
fi
echo ""

# ── VPS Health ──
echo "🌐 VPS Backend"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://api.zhiz.chat/health 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "  Health: ✅ OK (HTTP $HTTP_STATUS)"
else
  echo "  Health: ⚠️  HTTP $HTTP_STATUS"
fi
echo ""

# ── Git ──
echo "📝 Git"
BRANCH=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo "?")
DIRTY=$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
LAST_COMMIT=$(git -C "$REPO_ROOT" log -1 --format="%h %s" 2>/dev/null || echo "?")
echo "  Branch : $BRANCH"
echo "  Dirty  : $DIRTY file(s)"
echo "  Latest : $LAST_COMMIT"
