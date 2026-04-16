#!/usr/bin/env bash
# ═══ Easy Prompt — PromptHub 发布到 VPS ═══
# 2026-04-14 新增
# 变更类型：新增 / 优化
# 功能描述：将 PromptHub 的 web-hub/dist 产物发布到 zhiz.chat，并在同步前清理远端旧静态产物。
# 设计思路：
#   1. 与 Web 端共用同一套静态站点发布库，避免两套清理/rsync 逻辑漂移
#   2. 继续复用现有 scripts/webhub-build.sh 作为唯一构建入口，减少重复实现
#   3. 对远端目录执行“清理旧产物 + rsync --delete”双保险，避免历史哈希资源残留
# 参数与返回值：
#   --skip-build  跳过本地构建（适用于已先执行 scripts/webhub-build.sh 的场景）
#   --dry-run     仅展示清理与同步计划，不实际上传
#   返回值：0 表示发布成功，非 0 表示发布失败
# 影响范围：zhiz.chat、/www/wwwroot/zhiz.chat/、deploy/deploy.sh web-hub target
# 潜在风险：会替换远端 PromptHub 站点目录中的旧静态资源；脚本仅保留 .user.ini 与 .well-known

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
WEBHUB_DIR="$PROJECT_DIR/web-hub"

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
      echo "  --skip-build  Skip local PromptHub build step"
      echo "  --dry-run     Show remote cleanup and rsync plan without executing"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

published_print_banner "Easy Prompt PromptHub — Deploy to VPS"
published_load_deploy_config
published_require_commands ssh rsync du

VPS_HOST="${VPS_HOST:-107.151.137.198}"
VPS_PORT="${VPS_PORT:-22}"
VPS_USER="${VPS_USER:-root}"
VPS_KEY="${VPS_KEY:-$HOME/.ssh/easy-prompt-vps}"
REMOTE_DIR="${VPS_WEBHUB_PATH:-/www/wwwroot/zhiz.chat/}"

echo "Target: ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}"
echo ""

if ! $SKIP_BUILD; then
  bash "$PROJECT_DIR/scripts/webhub-build.sh"
  echo ""
fi

published_sync_static_dist "PromptHub" "$WEBHUB_DIR/dist" "$REMOTE_DIR" "$VPS_HOST" "$VPS_PORT" "$VPS_USER" "$VPS_KEY" "$DRY_RUN"
