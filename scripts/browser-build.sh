#!/usr/bin/env bash
# ═══ Easy Prompt — 浏览器扩展构建 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：构建浏览器扩展（单个或全部浏览器）+ 可选打包 zip
# 设计思路：支持单浏览器或 --all 全量构建，--zip 额外打包
# 参数：
#   --browser chrome|firefox|safari|edge|all（默认 chrome）
#   --zip     构建后自动打包 zip
# 影响范围：browser/.output/
# 潜在风险：无已知风险

set -euo pipefail
cd "$(dirname "$0")/../browser"

BROWSER="chrome"
ZIP=false

for arg in "$@"; do
  case "$arg" in
    --browser=*) BROWSER="${arg#--browser=}" ;;
    --zip) ZIP=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--browser=chrome|firefox|safari|edge|all] [--zip]"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Browser — Build         ║"
echo "╚══════════════════════════════════════╝"

# 确保依赖已安装
if [ ! -d "node_modules" ]; then
  echo "📋 Installing dependencies..."
  npm install
fi

build_one() {
  local b=$1
  echo "📋 Building for $b..."
  case "$b" in
    chrome)  npm run build:chrome ;;
    firefox) npm run build:firefox ;;
    safari)  npm run build:safari ;;
    edge)    npm run build:edge ;;
  esac
  if $ZIP; then
    echo "📦 Zipping $b..."
    case "$b" in
      chrome)  npm run zip:chrome ;;
      firefox) npm run zip:firefox ;;
      safari)  npm run zip:safari ;;
      edge)    npm run zip:edge ;;
    esac
  fi
}

if [ "$BROWSER" = "all" ]; then
  for b in chrome firefox safari edge; do
    build_one "$b"
    echo ""
  done
  echo "✅ All browsers built"
else
  build_one "$BROWSER"
  echo ""
  echo "✅ Build complete for $BROWSER"
fi
