/**
 * 2026-04-22 新增 — Browser Zhiz 编辑入口绑定闭环回归测试
 * 变更类型：新增/测试
 * 功能描述：验证 browser/shared/zhiz.js 中的 PromptHub 绑定专区深链构造，以及 link-status 请求的 401 刷新一次重试语义。
 * 设计思路：
 *   1. 通过动态 import 在每个用例内读取模块，确保 env.js 会消费当前 stub 的 WXT_* 环境变量。
 *   2. link-status 仅测试 helper 的鉴权与返回解析，不把 chrome.storage/content script 噪音引入当前单测。
 * 参数与返回值：本测试文件无外部参数；各用例断言 URL 输出与 fetch 请求序列。
 * 影响范围：browser/shared/zhiz.js、browser/content/content.js。
 * 潜在风险：无已知风险。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

describe("browser zhiz link helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("WXT_BACKEND_PUBLIC_BASE_URL", "https://api.zhiz.chat");
    vi.stubEnv("WXT_WEB_PUBLIC_BASE_URL", "https://prompt.zhiz.chat");
    vi.stubEnv("WXT_WEB_HUB_PUBLIC_BASE_URL", "https://zhiz.chat");
    vi.stubEnv("WXT_SSO_HUB_BASE_URL", "https://zhiz.chat");
    vi.stubEnv(
      "WXT_ZHIZ_SKILLS_MANAGER_URL",
      "https://zhiz.me/chat-flow/#/skills/index",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("builds the PromptHub binding deep link with postBindTarget=skills-manager", async () => {
    const { buildZhizBindingProfileUrl } = await import("../shared/zhiz.js");

    expect(buildZhizBindingProfileUrl()).toBe(
      "https://zhiz.chat/profile?connect=zhiz&postBindTarget=skills-manager#zhiz-oauth",
    );
  });

  it("retries zhiz link-status once after 401 and refresh success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            success: false,
            error: { message: "token expired" },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          data: {
            provider: "zhiz",
            linked: true,
            profile: {
              displayName: "Zhiz 昵称",
              avatarUrl: "https://avatar.example/zhiz.png",
            },
          },
        }),
      );
    const refreshMock = vi
      .fn()
      .mockResolvedValue({ accessToken: "fresh-token" });

    const { fetchZhizLinkStatus } = await import("../shared/zhiz.js");
    const result = await fetchZhizLinkStatus({
      requestUrl: "https://api.zhiz.chat/api/v1/auth/oauth/zhiz/link-status",
      fetchImpl: fetchMock,
      getAccessToken: async () => "expired-token",
      refreshAccessToken: refreshMock,
      getRequestSignal: () => undefined,
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Authorization).toBe(
      "Bearer expired-token",
    );
    expect(fetchMock.mock.calls[1]?.[1]?.headers?.Authorization).toBe(
      "Bearer fresh-token",
    );
    expect(result).toEqual({
      provider: "zhiz",
      linked: true,
      profile: {
        displayName: "Zhiz 昵称",
        avatarUrl: "https://avatar.example/zhiz.png",
      },
    });
  });
});
