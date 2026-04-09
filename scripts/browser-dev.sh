#!/usr/bin/env bash
# ═══ Easy Prompt — 浏览器扩展开发服务器 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：启动浏览器扩展 WXT 开发服务器（支持多浏览器）
# 设计思路：按 --browser 参数选择目标浏览器，默认 Chrome
# 参数：
#   --browser chrome|firefox|safari|edge（默认 chrome）
# 影响范围：browser/ 开发环境
# 潜在风险：无已知风险

set -euo pipefail
cd "$(dirname "$0")/../browser"

BROWSER="chrome"
for arg in "$@"; do
  case "$arg" in
    --browser=*) BROWSER="${arg#--browser=}" ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--browser=chrome|firefox|safari|edge]"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Browser — Dev ($BROWSER) ║"
echo "╚══════════════════════════════════════╝"

# 确保依赖已安装
if [ ! -d "node_modules" ]; then
  echo "📋 Installing dependencies..."
  npm install
fi

case "$BROWSER" in
  chrome)  npm run dev:chrome ;;
  firefox) npm run dev:firefox ;;
  safari)  npm run dev:safari ;;
  edge)    npm run dev:edge ;;
  *)
    echo "❌ Unknown browser: $BROWSER"
    echo "   Valid: chrome, firefox, safari, edge"
    exit 1
    ;;
esac
