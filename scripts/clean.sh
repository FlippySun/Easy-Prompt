#!/usr/bin/env bash
# ═══ Easy Prompt — 清理构建产物 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：清理各端的构建产物和缓存
# 参数：
#   --all          清理所有端（默认只清理构建产物）
#   --node-modules 同时清理 node_modules（慎用）
# 影响范围：各端 build/dist 目录
# 潜在风险：--node-modules 需要重新 npm install

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

CLEAN_MODULES=false

for arg in "$@"; do
  case "$arg" in
    --node-modules) CLEAN_MODULES=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--node-modules]"
      echo "  --node-modules  Also remove node_modules (requires re-install)"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt — Clean                 ║"
echo "╚══════════════════════════════════════╝"

clean_dir() {
  local label="$1" dir="$2"
  if [ -d "$dir" ]; then
    local size
    size=$(du -sh "$dir" 2>/dev/null | cut -f1)
    rm -rf "$dir"
    echo "  🗑  $label ($size)"
  fi
}

echo ""
echo "📋 Cleaning build artifacts..."

# Backend
clean_dir "backend/dist"       "$REPO_ROOT/backend/dist"

# Browser
clean_dir "browser/.output"    "$REPO_ROOT/browser/.output"
clean_dir "browser/.wxt"       "$REPO_ROOT/browser/.wxt"
clean_dir "browser/dist"       "$REPO_ROOT/browser/dist"

# PromptHub
clean_dir "web-hub/dist"       "$REPO_ROOT/web-hub/dist"

# IntelliJ
clean_dir "intellij/build"     "$REPO_ROOT/intellij/build"

# VS Code
echo "  🗑  *.vsix files"
rm -f "$REPO_ROOT"/*.vsix

# OS junk
find "$REPO_ROOT" -name ".DS_Store" -delete 2>/dev/null || true

if $CLEAN_MODULES; then
  echo ""
  echo "📋 Cleaning node_modules..."
  clean_dir "root/node_modules"      "$REPO_ROOT/node_modules"
  clean_dir "backend/node_modules"   "$REPO_ROOT/backend/node_modules"
  clean_dir "browser/node_modules"   "$REPO_ROOT/browser/node_modules"
  clean_dir "web-hub/node_modules"   "$REPO_ROOT/web-hub/node_modules"
fi

echo ""
echo "✅ Clean complete"
