#!/usr/bin/env bash
# ═══ Easy Prompt — Web (Vite) 构建 ═══
# 2026-04-14 新增
# 变更类型：新增 / 修复
# 功能描述：构建 Web 端 Vite 生产产物，统一输出到 web/dist/ 供发布脚本与 deploy.sh 复用。
# 设计思路：
#   1. 让 web/dist/ 成为 Web 发布的唯一产物来源
#   2. 在首次构建时自动补齐依赖，减少手工准备成本
#   3. 保留可选 preview 能力，方便本地快速验收构建结果
# 参数与返回值：
#   --preview  构建后启动 Vite preview
#   返回值：0 表示构建成功，非 0 表示构建失败
# 影响范围：web/dist/、deploy/deploy.sh web target、scripts/published/web-deploy.sh
# 潜在风险：首次执行可能因安装依赖而耗时较长；构建会覆盖已有 web/dist/ 产物

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WEB_DIR="$PROJECT_DIR/web"
PREVIEW=false

for arg in "$@"; do
  case "$arg" in
    --preview)
      PREVIEW=true
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--preview]"
      echo "  --preview  Start Vite preview after a successful build"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Web — Build (Vite)     ║"
echo "╚══════════════════════════════════════╝"

echo "Target: ${WEB_DIR}/dist"
echo ""

cd "$WEB_DIR"

if [[ ! -d "node_modules" || ! -x "node_modules/.bin/vite" ]]; then
  # 2026-04-14 依赖校验：兼容 node_modules 目录存在但依赖未完整安装的场景，避免空目录导致 vite build 直接失败。
  echo "📋 Installing web dependencies..."
  npm install --loglevel info
  echo ""
fi

echo "📋 Building web/dist via Vite..."
npm run build

echo ""
if [[ -d "dist" ]]; then
  DIST_SIZE=$(du -sh dist | cut -f1)
  echo "✅ Build complete: ${DIST_SIZE}"
fi

if $PREVIEW; then
  echo ""
  echo "📋 Starting Vite preview..."
  npm run preview
fi
