#!/usr/bin/env bash
# ═══ Easy Prompt — Scripts 共享库 ═══
# 2026-04-09 新增
# 变更类型：新增
# 功能描述：提供各脚本共用的工具函数（SSH 隧道管理、日志输出等）
# 设计思路：
#   抽取 ensure_tunnel() 函数，让所有需要 DB/Redis 连接的脚本
#   在执行前自动检测并拉起 SSH 隧道，避免连接失败。
#   使用 source 方式引入，不独立执行。
# 影响范围：scripts/ 下所有需要远端 DB 连接的脚本
# 潜在风险：VPS 不可达时 tunnel 启动失败，脚本会报错退出

# ── 常量 ──────────────────────────────────────────
# SSH 隧道脚本的相对路径（相对于项目根目录）
_TUNNEL_SCRIPT="backend/scripts/ssh-tunnel.sh"
_PROTECTED_DB_RESET_UNLOCK_ENV="ALLOW_PROTECTED_DB_RESET"
_PROTECTED_DB_RESET_UNLOCK_VALUE="I_ACK_PROTECTED_DB_RESET"

# ── 日志辅助 ──────────────────────────────────────
_lib_info()    { echo -e "\033[0;34m[TUNNEL]\033[0m $*"; }
_lib_success() { echo -e "\033[0;32m[TUNNEL]\033[0m $*"; }
_lib_warn()    { echo -e "\033[0;33m[TUNNEL]\033[0m $*"; }
_lib_error()   { echo -e "\033[0;31m[TUNNEL]\033[0m $*" >&2; }

# ── Shared DB Safety Helpers ──────────────────────
# 2026-04-16 新增 — Batch B shared DB hardening
# 2026-04-22 更新 — 共享生产库事故后的永久止血
# 变更类型：修复/安全/运维/测试
# 功能描述：为 shell 脚本统一提供 DATABASE_URL 读取、受保护数据库识别，以及 shared DB 高危命令确认护栏；backend Vitest 永久仅允许显式 test/ci/spec 库。
# 设计思路：
#   1. 保留“本地可直连正常数据库”的工作流，不把 shared/prod DB 连接本身视为非法。
#   2. 根因已经证明是“shared/prod DB 上仍可人为解锁 backend tests”，因此直接取消该后门，只保留 dedicated test DB 执行路径。
#   3. 所有脚本统一复用这里的口径，避免 backend-dev/test/db 各自维护一份数据库识别逻辑。
# 参数与返回值：下方函数根据当前环境或 backend/.env 返回 database url/name、布尔判定或非零退出条件。
# 影响范围：scripts/backend-test.sh、scripts/backend-dev.sh、scripts/backend-db.sh 及其从 backend/package.json 触发的入口。
# 潜在风险：若团队未来新增新的 protected DB 命名约定，需要同步调整这里的显式 test DB 识别规则；shared/prod DB 下的 backend tests 会直接失败。
get_repo_root() {
  (cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
}

get_backend_env_path() {
  printf '%s/backend/.env' "$(get_repo_root)"
}

strip_wrapping_quotes() {
  local value="$1"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" ]]; then
    value="${value#\"}"
    value="${value%\"}"
  elif [[ "$value" == \'*\' ]]; then
    value="${value#\'}"
    value="${value%\'}"
  fi
  printf '%s' "$value"
}

get_database_url() {
  local database_url="${DATABASE_URL:-}"

  if [[ -z "$database_url" ]]; then
    local env_file
    env_file="$(get_backend_env_path)"
    if [[ -f "$env_file" ]]; then
      while IFS= read -r line; do
        case "$line" in
          DATABASE_URL=*)
            database_url="${line#DATABASE_URL=}"
            database_url="$(strip_wrapping_quotes "$database_url")"
            break
            ;;
        esac
      done < "$env_file"
    fi
  fi

  printf '%s' "$database_url"
}

get_database_name() {
  local database_url
  database_url="$(get_database_url)"

  if [[ -z "$database_url" ]]; then
    return 0
  fi

  database_url="${database_url%%\?*}"
  database_url="${database_url%/}"
  printf '%s' "${database_url##*/}"
}

is_explicit_test_db() {
  local database_name="${1:-$(get_database_name)}"
  [[ -n "$database_name" && "$database_name" =~ (^|[_-])(test|ci|spec)([_-]|$) ]]
}

is_protected_db() {
  local database_name="${1:-$(get_database_name)}"
  if [[ -z "$database_name" ]]; then
    return 1
  fi

  if is_explicit_test_db "$database_name"; then
    return 1
  fi

  return 0
}

assert_shared_db_test_allowed() {
  local operation="$1"
  local database_url
  local database_name
  database_url="$(get_database_url)"
  database_name="$(get_database_name)"

  if [[ -z "$database_url" || -z "$database_name" ]]; then
    _lib_error "Refusing to ${operation}: DATABASE_URL is missing or unreadable."
    _lib_error "  Point DATABASE_URL to an explicit *_test / *_ci / *_spec database before running backend Vitest."
    return 1
  fi

  if is_protected_db "$database_name"; then
    _lib_error "Refusing to ${operation} against protected database '${database_name}'."
    _lib_error "  Backend Vitest is permanently disabled on shared/prod DB."
    _lib_error "  Point DATABASE_URL to an explicit *_test / *_ci / *_spec database before running backend tests."
    return 1
  fi

  return 0
}

confirm_protected_db_action() {
  local action="$1"
  local database_name
  local confirmation
  database_name="$(get_database_name)"

  if ! is_protected_db "$database_name"; then
    return 0
  fi

  _lib_warn "Protected database detected: ${database_name}"
  _lib_warn "Action requested: ${action}"
  printf 'Type the database name (%s) to continue: ' "$database_name"
  read -r confirmation

  if [[ "$confirmation" != "$database_name" ]]; then
    _lib_error "Confirmation mismatch. Protected DB action cancelled."
    return 1
  fi

  return 0
}

assert_protected_db_reset_allowed() {
  local operation="$1"
  local database_name
  database_name="$(get_database_name)"

  if ! is_protected_db "$database_name"; then
    return 0
  fi

  if [[ "${ALLOW_PROTECTED_DB_RESET:-}" != "${_PROTECTED_DB_RESET_UNLOCK_VALUE}" ]]; then
    _lib_error "Refusing to ${operation} against protected database '${database_name}'."
    _lib_error "  Export ${_PROTECTED_DB_RESET_UNLOCK_ENV}=${_PROTECTED_DB_RESET_UNLOCK_VALUE} for a deliberate protected DB reset, then re-run."
    return 1
  fi

  confirm_protected_db_action "$operation"
}

# ── ensure_tunnel() ──────────────────────────────────
# 功能：确保 SSH 隧道已启动（幂等）
# 参数：无
# 返回：0 = tunnel 就绪，1 = 启动失败
# 行为：
#   1. 检测 tunnel 进程是否已存在 → 存在则直接返回
#   2. 不存在则自动调用 ssh-tunnel.sh start
#   3. 启动失败时输出错误并返回非零
ensure_tunnel() {
  local repo_root
  # 2026-04-09 — 动态定位项目根目录，兼容从任意 cwd 调用
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  local tunnel_script="${repo_root}/${_TUNNEL_SCRIPT}"

  if [[ ! -f "$tunnel_script" ]]; then
    _lib_error "Tunnel script not found: ${tunnel_script}"
    return 1
  fi

  # 检测隧道是否已在运行（通过 exit code 判断：0=running, 1=not running）
  # 2026-04-09 — 不用 grep "running"，因为 "NOT running" 也会匹配
  if bash "$tunnel_script" status &>/dev/null; then
    _lib_success "SSH tunnel already running"
    return 0
  fi

  # 未运行 → 自动启动
  _lib_info "SSH tunnel not running, starting automatically..."
  if bash "$tunnel_script" start; then
    _lib_success "SSH tunnel started successfully"
    return 0
  else
    _lib_error "Failed to start SSH tunnel. Check VPS connectivity."
    _lib_error "  Manual start: bash ${_TUNNEL_SCRIPT} start"
    return 1
  fi
}

# ── skip_tunnel 标志 ──────────────────────────────────
# 允许脚本通过 --no-tunnel 跳过自动 tunnel（如 CI 环境或本地 DB）
_SKIP_TUNNEL=false

parse_tunnel_flag() {
  for arg in "$@"; do
    case "$arg" in
      --no-tunnel) _SKIP_TUNNEL=true ;;
    esac
  done
}

# 带 skip 判断的 ensure_tunnel 包装
require_tunnel() {
  if $_SKIP_TUNNEL; then
    _lib_warn "Tunnel auto-start skipped (--no-tunnel)"
    return 0
  fi
  ensure_tunnel
}
