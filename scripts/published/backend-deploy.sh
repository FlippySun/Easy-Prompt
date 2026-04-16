#!/usr/bin/env bash
# ═══ Easy Prompt — Backend 发布到 VPS ═══
# 2026-04-14 新增
# 变更类型：新增 / 固化
# 功能描述：将 backend 编译产物按 BACKEND-DEPLOY-GUIDE.md 的日常更新流程发布到 api.zhiz.chat。
# 设计思路：
#   1. 默认采用部署手册 5.2「仅更新代码」路径：本地构建 -> 同步 dist/ -> 远端 pm2 reload，满足高频后端代码发布。
#   2. 提供 --full 切换到部署手册 5.1「完整更新」路径，同步 prisma/ 与包管理文件，并在远端执行 npm ci + prisma generate + migrate deploy。
#   3. 复用 scripts/published/_lib.sh 的 banner、部署配置加载与命令检查能力，保持各端发布脚本入口一致。
# 参数与返回值：
#   --skip-build  跳过本地 backend build
#   --dry-run     仅展示同步与远端执行计划，不实际上传或重载
#   --full        按部署手册 5.1 执行完整更新；默认走 5.2 仅更新代码
#   --code-only   显式指定仅更新代码模式（默认）
#   返回值：0 表示发布成功，非 0 表示发布失败
# 影响范围：/www/wwwroot/api.zhiz.chat/dist、prisma、package*.json、ecosystem.config.js、PM2 easy-prompt-api
# 潜在风险：会替换生产后端编译产物；--full 模式会触发远端依赖安装与数据库迁移，需确保迁移已验证

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

SKIP_BUILD=false
DRY_RUN=false
DEPLOY_MODE="code-only"
SKIP_ENV_GUARD=false

for arg in "$@"; do
  case "$arg" in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --full)
      DEPLOY_MODE="full"
      ;;
    --code-only)
      DEPLOY_MODE="code-only"
      ;;
    --skip-env-guard)
      SKIP_ENV_GUARD=true
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--skip-build] [--dry-run] [--full|--code-only] [--skip-env-guard]"
      echo "  --skip-build  Skip local backend build"
      echo "  --dry-run     Show sync and remote execution plan without mutating production"
      echo "  --full        Run full update flow from BACKEND-DEPLOY-GUIDE.md §5.1"
      echo "  --code-only   Run code-only flow from BACKEND-DEPLOY-GUIDE.md §5.2 (default)"
      echo "  --skip-env-guard  Skip the remote critical env drift check (use only for intentional divergence)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

VPS_HOST="${VPS_HOST:-107.151.137.198}"
VPS_PORT="${VPS_PORT:-22}"
VPS_USER="${VPS_USER:-root}"
VPS_KEY="${VPS_KEY:-$HOME/.ssh/easy-prompt-vps}"
REMOTE_DIR="${VPS_BACKEND_PATH:-/www/wwwroot/api.zhiz.chat}"
HEALTH_URL="${BACKEND_HEALTH_URL:-https://api.zhiz.chat/health}"
SSH_TARGET="${VPS_USER}@${VPS_HOST}"
REMOTE_ENV_FILE="${REMOTE_DIR}/.env"
LOCAL_ENV_EXAMPLE="${BACKEND_DIR}/.env.example"
SSH_CMD=(ssh -i "$VPS_KEY" -p "$VPS_PORT" -o StrictHostKeyChecking=accept-new "$SSH_TARGET")
RSYNC_SSH="ssh -i ${VPS_KEY} -p ${VPS_PORT} -o StrictHostKeyChecking=accept-new"

if [[ ! -f "$VPS_KEY" ]]; then
  published_error "SSH 私钥不存在: ${VPS_KEY}"
  exit 1
fi

# 2026-04-15 新增 — Backend 发布前关键 env 漂移 guard
# 变更类型：新增 / 加固
# 功能描述：在后端发布开始前只读校验远端 `.env` 中的 `OAUTH_ZHIZ_BASE_URL` 是否与仓库示例值一致，提前拦截“代码已更新但运行态配置仍旧值”的事故。
# 设计思路：
#   1. 只检查已发生过生产事故的关键非敏感 URL，避免把发布脚本扩展成全量 env 审计器。
#   2. 在 build/rsync 之前执行，尽量把问题暴露在最早阶段，减少无意义构建与上传。
#   3. 保留 `--skip-env-guard` 作为显式逃生阀，确保 intentional drift 不会被脚本永久锁死。
# 参数与返回值：无新增函数参数；默认检查 `OAUTH_ZHIZ_BASE_URL`，不一致时退出 1。
# 影响范围：scripts/published/backend-deploy.sh 的发布前校验阶段。
# 潜在风险：若 `backend/.env.example` 中该公开 URL 未同步更新，guard 会阻塞发布，需先修正示例文件或显式跳过。
if [[ "$SKIP_ENV_GUARD" == "true" ]]; then
  published_warn "已跳过远端关键 env 漂移检查 (--skip-env-guard)"
else
  published_info "执行远端关键 env 漂移检查..."
  published_assert_remote_env_key_matches_example \
    "Backend env guard" \
    "$LOCAL_ENV_EXAMPLE" \
    "$REMOTE_ENV_FILE" \
    "OAUTH_ZHIZ_BASE_URL" \
    "$VPS_HOST" \
    "$VPS_PORT" \
    "$VPS_USER" \
    "$VPS_KEY"
fi

echo "Mode: ${DEPLOY_MODE}"
echo "Target: ${SSH_TARGET}:${REMOTE_DIR}"
echo ""

if ! $SKIP_BUILD; then
  published_info "构建 backend/dist ..."
  (
    cd "$BACKEND_DIR"
    npm run build
  )
  echo ""
fi

if [[ ! -d "$BACKEND_DIR/dist" ]]; then
  published_error "backend/dist 不存在: ${BACKEND_DIR}/dist"
  exit 1
fi

if [[ ! -f "$BACKEND_DIR/dist/server.js" ]]; then
  published_error "backend/dist 缺少 server.js，疑似构建未完成: ${BACKEND_DIR}/dist/server.js"
  exit 1
fi

DIST_SIZE="$(du -sh "$BACKEND_DIR/dist" | cut -f1)"
published_info "backend/dist 大小: ${DIST_SIZE}"

REMOTE_PREPARE_CMD="mkdir -p '${REMOTE_DIR}' '${REMOTE_DIR}/dist'"
if [[ "$DEPLOY_MODE" == "full" ]]; then
  REMOTE_PREPARE_CMD="mkdir -p '${REMOTE_DIR}' '${REMOTE_DIR}/dist' '${REMOTE_DIR}/prisma'"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  published_warn "Dry run：仅展示远端准备命令，不实际执行"
  printf '%q ' "${SSH_CMD[@]}"
  printf '%q\n' "$REMOTE_PREPARE_CMD"
else
  published_info "准备远端目录: ${SSH_TARGET}:${REMOTE_DIR}"
  "${SSH_CMD[@]}" "$REMOTE_PREPARE_CMD"
fi

RSYNC_ARGS=(
  -avz
  --delete
  -e "$RSYNC_SSH"
)
if [[ "$DRY_RUN" == "true" ]]; then
  RSYNC_ARGS+=(--dry-run)
fi

published_info "同步 backend dist/ -> ${SSH_TARGET}:${REMOTE_DIR}/dist/"
rsync "${RSYNC_ARGS[@]}" "$BACKEND_DIR/dist/" "${SSH_TARGET}:${REMOTE_DIR}/dist/"

if [[ "$DEPLOY_MODE" == "full" ]]; then
  published_info "同步 backend prisma/ -> ${SSH_TARGET}:${REMOTE_DIR}/prisma/"
  rsync "${RSYNC_ARGS[@]}" "$BACKEND_DIR/prisma/" "${SSH_TARGET}:${REMOTE_DIR}/prisma/"

  FILE_SYNC_ARGS=(
    -avz
    -e "$RSYNC_SSH"
  )
  if [[ "$DRY_RUN" == "true" ]]; then
    FILE_SYNC_ARGS+=(--dry-run)
  fi

  published_info "同步 package.json / package-lock.json / ecosystem.config.js"
  rsync "${FILE_SYNC_ARGS[@]}" \
    "$BACKEND_DIR/package.json" \
    "$BACKEND_DIR/package-lock.json" \
    "$BACKEND_DIR/ecosystem.config.js" \
    "${SSH_TARGET}:${REMOTE_DIR}/"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  if [[ "$DEPLOY_MODE" == "full" ]]; then
    published_warn "Dry run 完成：已展示 5.1 完整更新计划，未执行远端 npm/prisma/pm2"
  else
    published_warn "Dry run 完成：已展示 5.2 仅更新代码计划，未执行远端 pm2 reload"
  fi
  exit 0
fi

REMOTE_CODE_ONLY_CMD='export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && pm2 reload easy-prompt-api'
REMOTE_FULL_CMD="export NVM_DIR=\$HOME/.nvm && . \$NVM_DIR/nvm.sh && cd '${REMOTE_DIR}' && npm ci --omit=dev && npx prisma generate --no-hints && npx prisma migrate deploy && pm2 reload easy-prompt-api"

if [[ "$DEPLOY_MODE" == "full" ]]; then
  published_info "执行远端完整更新：npm ci + prisma generate + migrate deploy + pm2 reload"
  "${SSH_CMD[@]}" "$REMOTE_FULL_CMD"
else
  published_info "执行远端 PM2 graceful reload"
  "${SSH_CMD[@]}" "$REMOTE_CODE_ONLY_CMD"
fi

echo ""
published_info "健康检查: ${HEALTH_URL}"
HTTP_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")"
if [[ "$HTTP_STATUS" == "200" ]]; then
  published_success "Backend 部署验证通过：${HEALTH_URL} -> HTTP ${HTTP_STATUS}"
else
  published_warn "Backend 健康检查异常：${HEALTH_URL} -> HTTP ${HTTP_STATUS}"
fi
