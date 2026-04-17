/**
 * Easy Prompt Web — Skill 数据层
 * 2026-04-13 新增：加载 Skill 数据 + 注入 Web Component CSS
 *
 * [类型]     新增
 * [描述]     加载 mock.json skill 数据，导入 <ep-skill-panel> Web Component，
 *            通过 Vite ?raw 导入 CSS 并注入到 WC 静态属性。
 * [思路]     Vite 打包环境下 document.currentScript 为 null，WC 无法 fetch CSS，
 *            因此在 import 阶段通过 injectCss() 预注入 CSS 文本。
 * [影响范围] web/src/ui/index.js（引用本模块获取 skill 数据）
 * [潜在风险] 无已知风险
 */

// --- 2026-04-13 导入 Web Component（IIFE 自注册 <ep-skill-panel>）---
import "../../shared-ui/skill-panel.js";

// --- 2026-04-13 通过 Vite ?raw 导入 CSS 文本并注入到 WC ---
import skillPanelCss from "../../shared-ui/skill-panel.css?raw";

// --- 2026-04-13 导入 mock.json skill 数据（Vite 原生支持 JSON import）---
import skillsData from "../../core/mock.json";

// --- 2026-04-13 导入 SVG 图标映射 ---
import {
  SKILL_ICON_MAP,
  FOLDER_ICON_SVG,
} from "../../shared-ui/icons/index.js";
import {
  assertSkillProxySuccess,
  loadSkillProxyPayload,
} from "../../core/skill-fetch-client.mjs";
import { BACKEND_API_BASE, getSsoToken, refreshSsoToken } from "./backend.js";

// 2026-04-13 修复：统一解析 CustomElementRegistry，避免共享 skill 组件在
//   不同打包/运行时中裸用 customElements 触发 null.get。
// [参数与返回值] 无参数；返回 CustomElementRegistry|null。
// [影响范围] web/src/skill.js 对 shared-ui/skill-panel.js 的消费路径。
// [潜在风险] 无已知风险。
function getCustomElementRegistry() {
  if (typeof globalThis !== "undefined" && globalThis.customElements) {
    return globalThis.customElements;
  }
  if (typeof window !== "undefined" && window.customElements) {
    return window.customElements;
  }
  if (
    typeof document !== "undefined" &&
    document.defaultView &&
    document.defaultView.customElements
  ) {
    return document.defaultView.customElements;
  }
  return null;
}

// 注入 CSS 到 Web Component 静态属性
const skillRegistry = getCustomElementRegistry();
const EpSkillPanel = skillRegistry ? skillRegistry.get("ep-skill-panel") : null;
if (EpSkillPanel && EpSkillPanel.injectCss) {
  EpSkillPanel.injectCss(skillPanelCss);
}

/**
 * Skill 数据数组
 * Schema: { id, name, description, icon, placeholder, instructions, skillType, sortNum, sys }
 * @type {object[]}
 */
export const SKILLS = Array.isArray(skillsData) ? skillsData : [];

const SKILL_PROXY_URL = `${BACKEND_API_BASE}/api/v1/auth/oauth/zhiz/skills`;
const SKILL_FETCH_TIMEOUT_MS = 15000;
let _skillsCache = SKILLS;
let _skillsLoadPromise = null;
let _skillCacheSource = "mock";

/**
 * 2026-04-16 新增 — Web Skill Proxy 拉取超时信号
 * 变更类型：新增/兼容
 * 功能描述：为 Web 端 skill 数据请求提供可选超时保护，避免后端网络异常时 UI 一直悬挂。
 * 设计思路：优先复用浏览器原生 AbortSignal.timeout；旧环境缺失时退化为无超时但保持功能可用。
 * 参数与返回值：getSkillRequestSignal() 无参数；返回 AbortSignal 或 undefined。
 * 影响范围：web/src/skill.js 的后端 skill 数据拉取。
 * 潜在风险：无已知风险。
 */
function getSkillRequestSignal() {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(SKILL_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

/**
 * 2026-04-16 修复 — Web Skill 鉴权重试失败日志收口
 * 变更类型：修复/兼容/安全
 * 功能描述：在 skill proxy 的 access token 刷新失败时输出最小必要日志，帮助定位为何从已登录态退化到匿名 skill。
 * 设计思路：
 *   1. 仅记录“refresh 失败并将走匿名 fallback”的阶段性信息，不输出 token 或用户敏感数据。
 *   2. 让 401 刷新重试逻辑仍保留在共享 helper 中，Web 端只负责本地诊断与最终 mock/cache 兜底。
 * 参数与返回值：logSkillAuthRetryFailure(error) 无返回值。
 * 影响范围：web/src/skill.js 的 401 -> refresh -> retry -> anonymous fallback 观测。
 * 潜在风险：无已知风险。
 */
function logSkillAuthRetryFailure(error) {
  console.warn(
    "[EP] Skill proxy token refresh failed, fallback to anonymous skills:",
    error,
  );
}

/**
 * 2026-04-16 新增 — Web Slash 首开是否需要补拉真实 Skill
 * 变更类型：新增/兼容/优化
 * 功能描述：为 UI 层提供一个最小判断，决定用户第一次输入 `/` 打开面板时是否应补拉真实 skill 数据。
 * 设计思路：
 *   1. 若当前缓存仍来自 mock/fallback，则允许 slash 首开作为一次恢复性 force refresh 触发点。
 *   2. 一旦最近一次成功拿到真实数据，就不在每次 `/` 打开时重复强刷，避免无意义请求。
 * 参数与返回值：shouldRefreshSkillsOnPanelOpen() 无参数；返回 boolean。
 * 影响范围：web/src/ui/index.js 的 slash 首开条件重拉逻辑。
 * 潜在风险：无已知风险。
 */
export function shouldRefreshSkillsOnPanelOpen() {
  return _skillCacheSource !== "remote";
}

/**
 * 2026-04-16 新增/修复 — Web Skill 数据真实拉取 + mock 兜底
 * 变更类型：新增/修复/兼容/安全
 * 功能描述：优先从 backend Zhiz skill proxy 拉取真实技能列表；若失败则回落到本地 mock，确保 skill 面板始终有可展示数据，并修复初始化阶段因超时信号工厂变量名写错而在 fetch 前直接抛错的问题。
 * 设计思路：
 *   1. 请求统一走 backend `/api/v1/auth/oauth/zhiz/skills`，已登录时先尝试 Bearer；若收到 401 则刷新一次 token 后重试，再匿名退化。
 *   2. 保留本地 mock 作为稳定初始态与网络失败兜底，避免首次渲染期间 panel 为空。
 *   3. 用内存 cache + in-flight promise 去重，避免 init / SSO 回调 / slash 首开补拉同时触发重复请求。
 *   4. skill proxy 的 request signal 必须显式传入 `getSkillRequestSignal`，否则对象字面量会在运行时因未定义变量而短路，表现为“没有网络请求但静默回落 mock”。
 * 参数与返回值：loadSkills({ forceRefresh }) 返回 Promise<object[]>；失败时返回本地 mock skills。
 * 影响范围：web/src/ui/index.js 的 skill 面板初始化、`/` 首开补拉与 SSO 登录态切换刷新。
 * 潜在风险：若后端 route 响应结构变化，会自动回退 mock，但需要同步更新此解析逻辑；当前修复不改变 fallback 策略本身。
 */
export async function loadSkills(options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  if (_skillsLoadPromise) {
    return _skillsLoadPromise;
  }
  if (!forceRefresh && _skillsCache !== SKILLS) {
    return _skillsCache;
  }

  _skillsLoadPromise = (async () => {
    try {
      const result = await loadSkillProxyPayload({
        requestUrl: SKILL_PROXY_URL,
        fetchImpl: fetch,
        getAccessToken: getSsoToken,
        refreshAccessToken: refreshSsoToken,
        getRequestSignal: getSkillRequestSignal,
        onAuthRetryFailure: logSkillAuthRetryFailure,
      });

      _skillsCache = assertSkillProxySuccess(result);
      _skillCacheSource = "remote";
      return _skillsCache;
    } catch (err) {
      console.warn(
        "[EP] Skill proxy fetch failed, fallback to mock skills:",
        err,
      );
      _skillsCache = SKILLS;
      _skillCacheSource = "mock";
      return _skillsCache;
    } finally {
      _skillsLoadPromise = null;
    }
  })();

  return _skillsLoadPromise;
}

/**
 * SkillType 分组名映射
 * @type {Record<string, string>}
 */
export const SKILL_TYPE_MAP = {
  1: "通用",
  2: "写作",
  3: "制图",
  4: "编程",
};

/**
 * Skill 图标映射（icon 名称 → SVG 字符串）
 * @type {Record<string, string>}
 */
export { SKILL_ICON_MAP, FOLDER_ICON_SVG };
