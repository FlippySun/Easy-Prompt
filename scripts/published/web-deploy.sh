#!/usr/bin/env bash
# ═══ Easy Prompt — Web 发布到 VPS ═══
# 2026-04-14 新增
# 变更类型：新增 / 修复
# 功能描述：将 Web 端 Vite dist 产物发布到 prompt.zhiz.chat，并在上传前清理远端旧静态产物。
# 设计思路：
#   1. 优先复用 deploy/config.sh 的 VPS 配置，避免多套配置漂移
#   2. 以 web/dist/ 为唯一发布来源，彻底摆脱旧 index.html/style.css/app.js 直传模式
#   3. 发布前先清理远端旧产物，再使用 rsync --delete 精确同步，避免历史哈希资源残留
# 参数与返回值：
#   --skip-build  跳过本地构建（适用于已先执行 web-build.sh 的场景）
#   --dry-run     仅展示清理与同步计划，不实际上传
#   返回值：0 表示发布成功，非 0 表示发布失败
# 影响范围：prompt.zhiz.chat、/www/wwwroot/prompt.zhiz.chat/、deploy/deploy.sh web target
# 潜在风险：会替换远端 Web 站点目录中的旧静态资源；脚本仅保留 .user.ini 与 .well-known

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WEB_DIR="$PROJECT_DIR/web"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

SKIP_BUILD=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--skip-build] [--dry-run]"
      echo "  --skip-build  Skip local Vite build step"
      echo "  --dry-run     Show remote cleanup and rsync plan without executing"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

published_print_banner "Easy Prompt Web — Deploy to VPS"
published_load_deploy_config
published_require_commands npm ssh rsync du

VPS_HOST="${VPS_HOST:-107.151.137.198}"
VPS_PORT="${VPS_PORT:-22}"
VPS_USER="${VPS_USER:-root}"
VPS_KEY="${VPS_KEY:-$HOME/.ssh/easy-prompt-vps}"
REMOTE_DIR="${VPS_WEB_PATH:-/www/wwwroot/prompt.zhiz.chat/}"

echo "Target: ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}"
echo ""

if ! $SKIP_BUILD; then
  bash "$SCRIPT_DIR/web-build.sh"
  echo ""
fi

published_sync_static_dist "Web" "$WEB_DIR/dist" "$REMOTE_DIR" "$VPS_HOST" "$VPS_PORT" "$VPS_USER" "$VPS_KEY" "$DRY_RUN"
