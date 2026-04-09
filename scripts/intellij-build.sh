#!/usr/bin/env bash
# ═══ Easy Prompt — IntelliJ 插件构建 ═══
# 2026-04-08 新增
# 变更类型：新增
# 功能描述：构建 IntelliJ IDEA 插件（Gradle buildPlugin）
# 参数：
#   --run    构建后启动 IDE sandbox 调试
#   --clean  先清除 build/ 再构建
# 影响范围：intellij/build/
# 潜在风险：无已知风险（需要 JDK 21+）

set -euo pipefail
cd "$(dirname "$0")/../intellij"

RUN_IDE=false
CLEAN=false

for arg in "$@"; do
  case "$arg" in
    --run) RUN_IDE=true ;;
    --clean) CLEAN=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--run] [--clean]"
      echo "  --run    Launch IDE sandbox after build"
      echo "  --clean  Clean build/ before building"
      exit 0
      ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║  Easy Prompt IntelliJ — Build        ║"
echo "╚══════════════════════════════════════╝"

# 检查 Java
if ! command -v java &>/dev/null; then
  echo "❌ Java not found. IntelliJ plugin requires JDK 21+"
  exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | awk -F '"' '{print $2}' | cut -d. -f1)
echo "Java version: $JAVA_VERSION"

if $CLEAN; then
  echo "🗑  Cleaning build/..."
  ./gradlew clean
fi

echo "📋 Building plugin..."
./gradlew buildPlugin

# 查找产物
PLUGIN_ZIP=$(find build/distributions -name "*.zip" 2>/dev/null | head -1)
if [ -n "$PLUGIN_ZIP" ]; then
  SIZE=$(du -sh "$PLUGIN_ZIP" | cut -f1)
  echo ""
  echo "✅ Plugin built: $PLUGIN_ZIP ($SIZE)"
else
  echo "⚠️  Build completed but no zip found in build/distributions/"
fi

if $RUN_IDE; then
  echo ""
  echo "📋 Launching IDE sandbox..."
  ./gradlew runIde
fi
