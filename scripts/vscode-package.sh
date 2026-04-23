#!/usr/bin/env bash
# ═══ Easy Prompt — VS Code 扩展打包 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：打包 VS Code 扩展为 .vsix 文件，可选安装到本地 VS Code
# 参数：
#   --install  打包后自动安装到本地 VS Code
# 影响范围：项目根目录 *.vsix
# 潜在风险：无已知风险

set -euo pipefail
cd "$(dirname "$0")/.."

INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--install]"
      echo "  --install  Install .vsix to local VS Code after packaging"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt VS Code — Package       ║"
echo "╚══════════════════════════════════════╝"

# 获取版本
VERSION=$(node -p "require('./package.json').version")
echo "Version: $VERSION"
echo ""

echo "📋 Packaging VS Code extension..."
# 2026-04-23 修复 — 非交互发布链路自动确认 npx 安装
# 变更类型：修复/发布/配置
# 功能描述：在本地 gate 与发布脚本中显式使用 `npx --yes`，避免首轮安装 `@vscode/vsce` 时卡在交互确认提示。
# 设计思路：VS Code 打包脚本应可在无人值守环境运行；把自动确认固化在脚本内，比依赖外层 shell 管道或人工输入更稳。
# 参数与返回值：保留原 CLI 形态，仅把 `npx @vscode/vsce package` 替换为 `npx --yes @vscode/vsce package --allow-missing-repository`。
# 影响范围：scripts/vscode-package.sh、release-gate VS Code package 阶段、本地/CI 非交互打包。
# 潜在风险：首次执行会自动下载 `@vscode/vsce`；这是预期行为，无已知额外风险。
npx --yes @vscode/vsce package --allow-missing-repository

VSIX_FILE=$(ls -t easy-prompt-*.vsix 2>/dev/null | head -1)
if [ -n "$VSIX_FILE" ]; then
  SIZE=$(du -sh "$VSIX_FILE" | cut -f1)
  echo ""
  echo "✅ Package created: $VSIX_FILE ($SIZE)"
else
  echo "❌ No .vsix file found after packaging"
  exit 1
fi

if $INSTALL; then
  echo ""
  echo "📋 Installing to VS Code..."
  code --install-extension "$VSIX_FILE"
  echo "✅ Installed"
fi
