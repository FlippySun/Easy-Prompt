#!/usr/bin/env bash
# ═══ Easy Prompt — 后端构建 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：编译 TypeScript → dist/，含 prisma generate + tsc
# 设计思路：先 generate client，再 tsc 编译，最后报告产物大小
# 参数：
#   --clean  先清除 dist/ 再构建
# 影响范围：backend/dist/
# 潜在风险：无已知风险

set -euo pipefail
cd "$(dirname "$0")/../backend"

CLEAN=false
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--clean]"
      echo "  --clean  Remove dist/ before building"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Backend — Build         ║"
echo "╚══════════════════════════════════════╝"

if $CLEAN && [ -d "dist" ]; then
  echo "🗑  Cleaning dist/..."
  rm -rf dist
fi

# ── 1. Prisma Generate ──
echo "📋 Prisma generate..."
npx prisma generate --no-hints

# ── 2. TypeScript Compile ──
echo "📋 Compiling TypeScript..."
npx tsc

# ── 3. Report ──
if [ -d "dist" ]; then
  FILE_COUNT=$(find dist -name '*.js' | wc -l | tr -d ' ')
  SIZE=$(du -sh dist | cut -f1)
  echo ""
  echo "✅ Build complete: ${FILE_COUNT} files, ${SIZE}"
else
  echo "❌ Build failed: dist/ not created"
  exit 1
fi
