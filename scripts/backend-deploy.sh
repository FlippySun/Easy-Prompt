#!/usr/bin/env bash
# ═══ Easy Prompt — 后端部署到 VPS ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：将后端编译产物部署到 VPS（rsync + pm2 restart）
# 设计思路：
#   1. 本地 build
#   2. rsync dist/ + prisma/ + package*.json 到 VPS
#   3. 远端 npm ci --omit=dev + prisma migrate deploy + pm2 reload
# 参数：
#   --skip-build   跳过本地构建（已构建时使用）
#   --dry-run      只显示 rsync 文件列表，不实际传输
# 影响范围：VPS /www/wwwroot/api.zhiz.chat/
# 潜在风险：生产环境部署，需确认变更

set -euo pipefail
cd "$(dirname "$0")/../backend"

# ── 配置 ──
VPS_HOST="107.151.137.198"
VPS_USER="root"
VPS_KEY="$HOME/.ssh/easy-prompt-vps"
REMOTE_DIR="/www/wwwroot/api.zhiz.chat"

SKIP_BUILD=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --dry-run) DRY_RUN=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--skip-build] [--dry-run]"
      echo "  --skip-build  Skip local tsc build step"
      echo "  --dry-run     Show rsync plan without executing"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt Backend — Deploy to VPS ║"
echo "╚══════════════════════════════════════╝"
echo "Target: ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}"
echo ""

# ── 1. Build ──
if ! $SKIP_BUILD; then
  echo "📋 Building..."
  npx prisma generate --no-hints
  npx tsc
  echo "✅ Build complete"
  echo ""
fi

# ── 2. Rsync ──
# 2026-04-09 修复：分目录 rsync，避免 --delete 误删 .env/logs/node_modules
SSH_CMD="ssh -i ${VPS_KEY} -o StrictHostKeyChecking=no"
DRY_FLAG=""
if $DRY_RUN; then
  DRY_FLAG="--dry-run"
  echo "📋 Dry run — showing rsync plan..."
fi

echo "📋 Syncing dist/ to VPS..."
rsync -avz --delete $DRY_FLAG \
  -e "$SSH_CMD" \
  dist/ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/dist/"

echo "📋 Syncing prisma/ to VPS..."
rsync -avz --delete $DRY_FLAG \
  -e "$SSH_CMD" \
  prisma/ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/prisma/"

# 2026-04-09 新增：同步 core/scenes.js 到 VPS
# scene-router.service.ts 通过 require('../../../core/scenes.js') 加载场景数据
echo "📋 Syncing core/ to VPS..."
rsync -avz $DRY_FLAG \
  -e "$SSH_CMD" \
  --include='scenes.js' --exclude='*' \
  ../core/ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/core/"

echo "📋 Uploading config files to VPS..."
if ! $DRY_RUN; then
  scp -i "$VPS_KEY" package.json package-lock.json ecosystem.config.js \
    "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"
else
  echo "  (dry-run) would upload: package.json package-lock.json ecosystem.config.js"
fi

if $DRY_RUN; then
  echo ""
  echo "⚠️  Dry run complete. Re-run without --dry-run to deploy."
  exit 0
fi

# ── 3. Remote Commands ──
echo ""
echo "📋 Installing production dependencies on VPS..."
ssh -i "$VPS_KEY" "${VPS_USER}@${VPS_HOST}" "
  cd ${REMOTE_DIR} && \
  export NVM_DIR=\$HOME/.nvm && source \$NVM_DIR/nvm.sh && \
  npm ci --omit=dev && \
  npx prisma generate --no-hints && \
  npx prisma migrate deploy && \
  pm2 reload ecosystem.config.js
"

echo ""
echo "✅ Deploy complete!"
echo ""

# ── 4. Health Check ──
echo "📋 Health check..."
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.zhiz.chat/health || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Health check passed (HTTP $HTTP_STATUS)"
else
  echo "⚠️  Health check returned HTTP $HTTP_STATUS"
fi
