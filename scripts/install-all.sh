#!/usr/bin/env bash
# ═══ Easy Prompt — 全项目依赖安装 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：安装所有端的 npm 依赖 + prisma generate
# 设计思路：并行安装各端依赖（如有 GNU parallel），否则串行
# 影响范围：各端 node_modules/
# 潜在风险：网络依赖

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt — Install All Deps      ║"
echo "╚══════════════════════════════════════╝"
echo ""

install_one() {
  local name="$1" dir="$2"
  echo "📋 Installing $name dependencies..."
  cd "$dir"
  npm install --loglevel info
  echo "✅ $name done"
  echo ""
}

install_one "Root (VS Code)"  "$REPO_ROOT"
install_one "Backend"         "$REPO_ROOT/backend"
install_one "Browser"         "$REPO_ROOT/browser"
install_one "PromptHub"       "$REPO_ROOT/web-hub"

# Prisma generate
echo "📋 Running prisma generate..."
cd "$REPO_ROOT/backend"
npx prisma generate --no-hints
echo ""

echo "═══════════════════════════════════════"
echo "✅ All dependencies installed"
echo "═══════════════════════════════════════"
