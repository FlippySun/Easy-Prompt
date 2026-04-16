#!/usr/bin/env bash
# ═══ Easy Prompt — Published Scripts 共享库 ═══
# 2026-04-14 新增
# 变更类型：新增 / 优化
# 功能描述：为 Web / Web-Hub 发布脚本提供共用的日志、配置加载、远端旧产物清理与静态站点同步能力。
# 设计思路：
#   1. 将已验证的 VPS 静态站点发布流程沉淀为共享函数
#   2. 以本地 dist/ 作为单一真相源，避免旧 app.js/style.css 与新 Vite assets 并存
#   3. 在同步前显式清理远端旧产物，同时保留 .user.ini / .well-known 等托管控制文件
# 参数与返回值：
#   - published_repo_root() -> 输出仓库根目录绝对路径
#   - published_load_deploy_config() -> 按需加载 deploy/config.sh，成功返回 0
#   - published_require_commands <cmd...> -> 校验命令存在，缺失时返回非零
#   - published_sync_static_dist <label> <local_dist_dir> <remote_dir> <host> <port> <user> <key> <dry_run>
#     成功时返回 0；失败时返回非零并终止调用脚本
# 影响范围：scripts/published/*.sh、prompt.zhiz.chat、zhiz.chat 静态产物部署
# 潜在风险：会替换远端站点目录中的旧静态资源；已知保留项仅限 .user.ini 与 .well-known

set -euo pipefail

_PUBLISHED_BLUE='\033[0;34m'
_PUBLISHED_GREEN='\033[0;32m'
_PUBLISHED_YELLOW='\033[1;33m'
_PUBLISHED_RED='\033[0;31m'
_PUBLISHED_NC='\033[0m'

published_info() {
  echo -e "${_PUBLISHED_BLUE}[PUBLISH]${_PUBLISHED_NC} $*"
}

published_success() {
  echo -e "${_PUBLISHED_GREEN}[PUBLISH]${_PUBLISHED_NC} $*"
}

published_warn() {
  echo -e "${_PUBLISHED_YELLOW}[PUBLISH]${_PUBLISHED_NC} $*"
}

published_error() {
  echo -e "${_PUBLISHED_RED}[PUBLISH]${_PUBLISHED_NC} $*" >&2
}

published_print_banner() {
  local title="$1"
  echo "╔════════════════════════════════════════════════════════════╗"
  printf '║ %-58s ║\n' "$title"
  echo "╚════════════════════════════════════════════════════════════╝"
}

published_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

published_load_deploy_config() {
  local repo_root
  repo_root="$(published_repo_root)"
  local config_file="${repo_root}/deploy/config.sh"

  if [[ -f "$config_file" ]]; then
    # 2026-04-14 配置复用：优先沿用 deploy/config.sh，避免 published 脚本与 deploy.sh 出现 VPS 参数漂移。
    # shellcheck disable=SC1090
    source "$config_file"
    published_info "已加载部署配置: ${config_file}"
    return 0
  fi

  published_warn "未找到 deploy/config.sh，使用脚本内默认值继续"
  return 0
}

published_require_commands() {
  local missing=()
  local cmd

  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    published_error "缺少必要命令: ${missing[*]}"
    return 1
  fi
}

# 2026-04-15 新增 — Backend 发布前 env 漂移 guard 共享 helper
# 变更类型：新增 / 加固
# 功能描述：提供本地 `.env`/`.env.example` 解析与远端 `.env` 指定键值一致性校验，拦截已知关键环境变量漂移。
# 设计思路：
#   1. 只比较调用方显式声明的 key，避免把示例文件误当作所有生产变量的统一真相源。
#   2. 读取值时统一剥离成对引号，兼容 `.env` 中对 URL/hash-route 的引号写法。
#   3. helper 仅做只读检查并返回非零，由调用脚本决定是否中止，避免共享库隐式修改远端状态。
# 参数与返回值：
#   - published_strip_env_quotes <value> -> stdout 输出去引号后的值。
#   - published_read_env_value <env_file> <env_key> -> stdout 输出解析后的值；缺失时返回非 0。
#   - published_assert_remote_env_key_matches_example <label> <local_env_file> <remote_env_file> <env_key> <host> <port> <user> <ssh_key>
#     一致返回 0；不一致或缺失返回非 0。
# 影响范围：scripts/published/backend-deploy.sh 以及后续其他发布脚本可复用的远端 env 一致性校验。
# 潜在风险：若示例文件中的公开非敏感基准值未及时更新，guard 会阻塞发布，需通过显式跳过开关临时绕过。
published_strip_env_quotes() {
  local value="$1"

  if [[ ${#value} -ge 2 ]]; then
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi

  printf '%s' "$value"
}

published_read_env_value() {
  local env_file="$1"
  local env_key="$2"
  local env_line

  if [[ ! -f "$env_file" ]]; then
    published_error "env 文件不存在: ${env_file}"
    return 1
  fi

  env_line=$(grep -E "^${env_key}=" "$env_file" 2>/dev/null | tail -n 1 || true)
  env_line="${env_line%$'\r'}"
  if [[ -z "$env_line" ]]; then
    published_error "env 文件缺少键: ${env_key} (${env_file})"
    return 1
  fi

  published_strip_env_quotes "${env_line#*=}"
}

published_assert_remote_env_key_matches_example() {
  local label="$1"
  local local_env_file="$2"
  local remote_env_file="$3"
  local env_key="$4"
  local host="$5"
  local port="$6"
  local user="$7"
  local ssh_key="$8"
  local ssh_target="${user}@${host}"
  local expected_value
  local actual_line
  local actual_value

  expected_value="$(published_read_env_value "$local_env_file" "$env_key")" || return 1
  actual_line=$(ssh -i "$ssh_key" -p "$port" -o StrictHostKeyChecking=accept-new "$ssh_target" "grep -E '^${env_key}=' '${remote_env_file}' 2>/dev/null | tail -n 1" 2>/dev/null || true)
  actual_line="${actual_line%$'\r'}"
  if [[ -z "$actual_line" ]]; then
    published_error "${label} 失败：远端 env 缺少键 ${env_key} (${ssh_target}:${remote_env_file})"
    return 1
  fi

  actual_value="$(published_strip_env_quotes "${actual_line#*=}")"
  if [[ "$actual_value" != "$expected_value" ]]; then
    published_error "${label} 失败：${env_key} 漂移，期望 '${expected_value}'，远端实际 '${actual_value}'"
    published_error "如确认这是有意差异，请显式传入 --skip-env-guard 后重试"
    return 1
  fi

  published_success "${label} 通过：${env_key}=${expected_value}"
}

published_sync_static_dist() {
  local label="$1"
  local local_dist_dir="$2"
  local remote_dir="$3"
  local host="$4"
  local port="$5"
  local user="$6"
  local key="$7"
  local dry_run="${8:-false}"

  local normalized_local_dist="${local_dist_dir%/}"
  local normalized_remote_dir="${remote_dir%/}"
  local ssh_target="${user}@${host}"
  local rsync_ssh="ssh -i ${key} -p ${port} -o StrictHostKeyChecking=accept-new"

  if [[ ! -d "$normalized_local_dist" ]]; then
    published_error "${label} dist 目录不存在: ${normalized_local_dist}"
    return 1
  fi

  if [[ ! -f "${normalized_local_dist}/index.html" ]]; then
    published_error "${label} dist 缺少 index.html，疑似尚未完成构建: ${normalized_local_dist}/index.html"
    return 1
  fi

  if [[ ! -f "$key" ]]; then
    published_error "SSH 私钥不存在: ${key}"
    return 1
  fi

  # 2026-04-14 远端清理策略：部署前删除旧静态产物，避免哈希资源与旧入口文件残留；同时保留 .user.ini / .well-known。
  local remote_cleanup_cmd="mkdir -p '${normalized_remote_dir}' && find '${normalized_remote_dir}' -mindepth 1 -maxdepth 1 ! -name '.user.ini' ! -name '.well-known' -exec rm -rf -- {} +"

  if [[ "$dry_run" == "true" ]]; then
    published_warn "Dry run：仅展示远端清理与同步计划，不实际执行"
    echo "ssh -i ${key} -p ${port} -o StrictHostKeyChecking=accept-new ${ssh_target} \"${remote_cleanup_cmd}\""
  else
    published_info "清理远端旧产物: ${ssh_target}:${normalized_remote_dir}/"
    ssh -i "$key" -p "$port" -o StrictHostKeyChecking=accept-new "$ssh_target" "$remote_cleanup_cmd"
  fi

  local rsync_args=(
    -avz
    --delete
    --exclude=.user.ini
    --exclude=.well-known/
    -e "$rsync_ssh"
  )

  if [[ "$dry_run" == "true" ]]; then
    rsync_args+=(--dry-run)
  fi

  published_info "同步 ${label} dist/ -> ${ssh_target}:${normalized_remote_dir}/"
  rsync "${rsync_args[@]}" "${normalized_local_dist}/" "${ssh_target}:${normalized_remote_dir}/"

  if [[ "$dry_run" == "true" ]]; then
    published_warn "Dry run 完成：未对远端文件做实际修改"
    return 0
  fi

  local remote_check
  remote_check=$(ssh -i "$key" -p "$port" -o StrictHostKeyChecking=accept-new "$ssh_target" "test -f '${normalized_remote_dir}/index.html' && echo 'OK' || echo 'MISSING'" 2>/dev/null || echo "UNKNOWN")

  if [[ "$remote_check" == "OK" ]]; then
    published_success "${label} 部署验证通过: ${normalized_remote_dir}/index.html 存在"
  else
    published_warn "${label} 部署验证结果异常: ${remote_check}"
  fi
}
