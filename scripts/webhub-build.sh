#!/usr/bin/env bash
# ═══ Easy Prompt — PromptHub (web-hub) 构建 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：构建 PromptHub 生产产物（typecheck + vite build）
# 参数：
#   --preview  构建后启动预览服务器
# 影响范围：web-hub/dist/
# 潜在风险：无已知风险

set -euo pipefail
cd "$(dirname "$0")/../web-hub"

PREVIEW=false
for arg in "$@"; do
  case "$arg" in
    --preview) PREVIEW=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--preview]"
      echo "  --preview  Start preview server after build"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt PromptHub — Build       ║"
echo "╚══════════════════════════════════════╝"

if [ ! -d "node_modules" ]; then
  echo "📋 Installing dependencies..."
  npm install
fi

echo "📋 Building (typecheck + vite build)..."
npm run build

if [ -d "dist" ]; then
  SIZE=$(du -sh dist | cut -f1)
  echo ""
  echo "✅ Build complete: ${SIZE}"
fi

if $PREVIEW; then
  echo ""
  echo "📋 Starting preview server..."
  npm run preview
fi
