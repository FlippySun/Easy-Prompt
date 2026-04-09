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

# ── 日志辅助 ──────────────────────────────────────
_lib_info()    { echo -e "\033[0;34m[TUNNEL]\033[0m $*"; }
_lib_success() { echo -e "\033[0;32m[TUNNEL]\033[0m $*"; }
_lib_warn()    { echo -e "\033[0;33m[TUNNEL]\033[0m $*"; }
_lib_error()   { echo -e "\033[0;31m[TUNNEL]\033[0m $*" >&2; }

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
