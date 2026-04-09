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
npx @vscode/vsce package

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
