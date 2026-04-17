/**
 * 2026-04-16 新增 — Web / Browser Skill Proxy 鉴权退化回归测试
 * 变更类型：新增/测试
 * 功能描述：验证共享 skill fetch helper 的 Bearer -> 401 刷新一次 -> 重试 -> 匿名 fallback 语义，锁定 Web 与 Browser 两端一致行为。
 * 设计思路：
 *   1. 直接测试 `core/skill-fetch-client.mjs`，避免把 DOM、自定义元素或 chrome.storage 噪音引入当前回归范围。
 *   2. 使用可观察的 `fetchImpl` mock 断言 Authorization 头变化，确保 refresh / anonymous fallback 的顺序符合计划约束。
 *   3. 同时覆盖 refresh 成功、refresh 失败、refresh 后再次 401 三条关键分支，防止未来重构把 skill 鉴权退化链路改坏。
 * 参数与返回值：本测试文件无外部参数；各用例断言 helper 返回结果与请求序列。
 * 影响范围：core/skill-fetch-client.mjs、web/src/skill.js、browser/content/content.js。
 * 潜在风险：无已知风险。
 */

import { describe, expect, it, vi } from "vitest";

import {
  assertSkillProxySuccess,
  loadSkillProxyPayload,
} from "../../core/skill-fetch-client.mjs";

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

describe("skill-fetch-client shared auth fallback", () => {
  it("retries once with refreshed token after an initial 401", async () => {
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
            skills: [{ id: 11, name: "多维思考" }],
          },
        }),
      );
    const refreshMock = vi
      .fn()
      .mockResolvedValue({ accessToken: "fresh-token" });

    const result = await loadSkillProxyPayload({
      requestUrl: "https://api.zhiz.chat/api/v1/auth/oauth/zhiz/skills",
      fetchImpl: fetchMock,
      getAccessToken: () => "expired-token",
      refreshAccessToken: refreshMock,
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Authorization).toBe(
      "Bearer expired-token",
    );
    expect(fetchMock.mock.calls[1]?.[1]?.headers?.Authorization).toBe(
      "Bearer fresh-token",
    );
    expect(assertSkillProxySuccess(result)).toEqual([
      { id: 11, name: "多维思考" },
    ]);
  });

  it("falls back to anonymous request when token refresh fails after 401", async () => {
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
            skills: [{ id: 12, name: "分析解读" }],
          },
        }),
      );
    const refreshError = new Error("refresh failed");
    const onAuthRetryFailure = vi.fn();

    const result = await loadSkillProxyPayload({
      requestUrl: "https://api.zhiz.chat/api/v1/auth/oauth/zhiz/skills",
      fetchImpl: fetchMock,
      getAccessToken: () => "expired-token",
      refreshAccessToken: vi.fn().mockRejectedValue(refreshError),
      onAuthRetryFailure,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Authorization).toBe(
      "Bearer expired-token",
    );
    expect(
      fetchMock.mock.calls[1]?.[1]?.headers?.Authorization,
    ).toBeUndefined();
    expect(onAuthRetryFailure).toHaveBeenCalledWith(refreshError);
    expect(assertSkillProxySuccess(result)).toEqual([
      { id: 12, name: "分析解读" },
    ]);
  });

  it("falls back to anonymous request when refreshed token still gets 401", async () => {
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
        createJsonResponse(
          {
            success: false,
            error: { message: "still unauthorized" },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          data: {
            skills: [{ id: 13, name: "解释说明" }],
          },
        }),
      );

    const result = await loadSkillProxyPayload({
      requestUrl: "https://api.zhiz.chat/api/v1/auth/oauth/zhiz/skills",
      fetchImpl: fetchMock,
      getAccessToken: () => "expired-token",
      refreshAccessToken: vi
        .fn()
        .mockResolvedValue({ accessToken: "fresh-token" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Authorization).toBe(
      "Bearer expired-token",
    );
    expect(fetchMock.mock.calls[1]?.[1]?.headers?.Authorization).toBe(
      "Bearer fresh-token",
    );
    expect(
      fetchMock.mock.calls[2]?.[1]?.headers?.Authorization,
    ).toBeUndefined();
    expect(assertSkillProxySuccess(result)).toEqual([
      { id: 13, name: "解释说明" },
    ]);
  });
});
