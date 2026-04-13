/**
 * Easy Prompt Web — 场景数据加载
 * 2026-04-13 Vite 迁移：从 app.js §4 提取为独立 ESM 模块
 *
 * [类型]     重构（模块化）
 * [描述]     将场景数据加载逻辑提取为独立模块，管理 SCENES / SCENE_NAMES 状态
 * [影响范围] router.js, composer.js, ui/ 中所有引用场景数据的模块
 * [潜在风险] 无已知风险
 */

/* ═══════════════════════════════════════════════════
   §4. Scene Data (loaded from scenes.json)
   ═══════════════════════════════════════════════════ */

export let SCENES = {};
export let SCENE_NAMES = {};

export async function loadScenes() {
  try {
    const resp = await fetch("scenes.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    SCENES = await resp.json();
    SCENE_NAMES = {};
    for (const [id, s] of Object.entries(SCENES)) {
      SCENE_NAMES[id] = s.name;
    }
    window.SCENES = SCENES;
    return true;
  } catch (e) {
    console.error("Failed to load scenes:", e);
    return false;
  }
}
