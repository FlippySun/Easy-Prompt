// ========================== 变更记录 ==========================
// [日期]     2026-04-10
// [类型]     新增功能
// [描述]     SSO Plan v2 B1: Safari/fallback Tab redirect 回调页面脚本
// [思路]     统一 SSO Hub 登录成功后 redirect 回此页面，URL 中携带 code + state 参数。
//           脚本负责：校验 state（CSRF 防护） → 用 code 换 tokens → 存储 → 显示结果。
//           Chrome/Firefox 使用 launchWebAuthFlow 不走此页面；Safari 必须走此路径。
// [参数与返回值] 无外部参数；从 URL search params 读取 code/state
// [影响范围] 仅 auth-callback 页面，不影响其他功能
// [潜在风险] 无已知风险（code 一次性 + 5min 过期 + state 校验）
// ==============================================================

import { Sso } from "../../shared/sso.js";

const $ = (sel) => document.getElementById(sel);

function showState(name) {
  ["state-loading", "state-success", "state-error"].forEach((id) => {
    $(id).classList.toggle("hidden", id !== name);
  });
}

function showError(msg) {
  $("error-msg").textContent = msg;
  showState("state-error");
}

function showSuccess(username) {
  $("success-msg").textContent = username
    ? `欢迎回来，${username}！已成功登录 Easy Prompt`
    : "您已成功登录 Easy Prompt";
  showState("state-success");

  // 3 秒后自动关闭标签页
  setTimeout(() => {
    try {
      window.close();
    } catch {
      /* 某些浏览器不允许脚本关闭非脚本打开的标签 */
    }
  }, 3000);
}

async function handleCallback() {
  try {
    // 1. 从 URL 参数读取 code 和 state
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) {
      showError("未收到授权码，请重新登录");
      return;
    }
    if (!state) {
      showError("缺少 state 参数，请重新登录");
      return;
    }

    // 2. CSRF 校验：比对 state 与本地存储的值（Plan v2 Gap #5）
    const storedState = await Sso.consumeStoredState();
    if (!storedState || storedState !== state) {
      showError("登录验证失败（CSRF），请重新登录");
      return;
    }

    // 3. 用授权码换取 tokens
    // redirectUri 需与 /sso/authorize 时传的 redirect_uri 一致
    // 即当前页面的 URL（不含 query params）
    const redirectUri = window.location.origin + window.location.pathname;

    const tokenData = await Sso.exchangeSsoCode(code, redirectUri);

    // 4. 存储 tokens 到 chrome.storage.local
    await Sso.saveSsoTokens(tokenData);

    // 5. 显示成功
    const username =
      tokenData.user?.displayName || tokenData.user?.username || "";
    showSuccess(username);

    // 清除 URL 中的敏感参数（防止历史记录泄露 code）
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch {
      /* ignore */
    }
  } catch (err) {
    showError(err.message || "登录失败，请重试");
  }
}

// 页面加载后立即执行回调处理
handleCallback();
