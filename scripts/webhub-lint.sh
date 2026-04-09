#!/usr/bin/env bash
# ═══ Easy Prompt — PromptHub (web-hub) 代码检查 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：运行 PromptHub 的 lint + format 检查/修复
# 参数：
#   --fix  自动修复 lint 和格式问题
# 影响范围：web-hub/src/ 代码风格
# 潜在风险：--fix 会修改文件

set -euo pipefail
cd "$(dirname "$0")/../web-hub"

FIX=false
for arg in "$@"; do
  case "$arg" in
    --fix) FIX=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--fix]"
      echo "  --fix  Auto-fix lint & format issues"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt PromptHub — Lint        ║"
echo "╚══════════════════════════════════════╝"

if $FIX; then
  echo "📋 Fixing lint issues..."
  npm run lint:fix
  echo ""
  echo "📋 Formatting..."
  npm run format
else
  echo "📋 Checking lint..."
  npm run lint
  echo ""
  echo "📋 Checking format..."
  npm run format:check
  echo ""
  echo "📋 Type checking..."
  npm run typecheck
fi
