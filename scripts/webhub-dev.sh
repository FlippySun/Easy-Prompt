#!/usr/bin/env bash
# ═══ Easy Prompt — PromptHub (web-hub) 开发服务器 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：启动 PromptHub (React/Vite) 开发服务器
# 影响范围：web-hub/ 开发环境
# 潜在风险：无已知风险

set -euo pipefail
cd "$(dirname "$0")/../web-hub"

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt PromptHub — Dev Server  ║"
echo "╚══════════════════════════════════════╝"

# 确保依赖已安装
if [ ! -d "node_modules" ]; then
  echo "📋 Installing dependencies..."
  npm install
fi

echo "📋 Starting Vite dev server..."
echo "   Press Ctrl+C to stop"
echo ""
npm run dev
