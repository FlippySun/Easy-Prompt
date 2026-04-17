/**
 * 2026-04-16 新增 — Skill 真实数据迁移（方案 B）T1 服务层
 * 变更类型：新增/安全/兼容
 * 功能描述：为 Zhiz skill 数据提供服务端代理能力，统一收口 OAuthAccount token 解密、匿名退化与上游响应标准化。
 * 设计思路：
 *   1. 仅在服务端读取并解密 Zhiz OAuth access token，客户端永不接触 provider token。
 *   2. 已登录用户优先走 token 代理；无 token 时直接匿名请求；仅 token 鉴权失败时降级匿名重试一次。
 *   3. 将上游返回保守归一为 skill 数组，避免 route 与前端分散兼容响应结构。
 * 参数与返回值：
 *   - fetchZhizSkills(options): 接收可选 userId，返回 { skills, source, usedToken, fallbackReason }。
 * 影响范围：后续 `/api/v1/auth/oauth/zhiz/skills` 中间层路由、Web/Browser skill 面板真实数据接入。
 * 潜在风险：若上游 skill schema 与当前保守解包规则不一致，将显式抛错而不是静默返回脏数据。
 */

import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';
import { decryptOAuthToken } from '../utils/crypto';

const log = createChildLogger('skill');
const SKILL_REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_AUTH_FAILURE_STATUSES = new Set([401, 403]);

type SkillFetchSource = 'authenticated' | 'anonymous';
type SkillFallbackReason = 'missing_token' | 'upstream_auth_failed' | null;

export interface ZhizSkillRecord extends Record<string, unknown> {
  id?: number | string;
  name?: string;
  description?: string;
  icon?: string;
  placeholder?: string;
  instructions?: string;
  skillType?: number | string;
  sortNum?: number;
}

export interface FetchZhizSkillsOptions {
  userId?: string | null;
}

export interface FetchZhizSkillsResult {
  skills: ZhizSkillRecord[];
  source: SkillFetchSource;
  usedToken: boolean;
  fallbackReason: SkillFallbackReason;
}

interface UpstreamSkillErrorDetails {
  upstreamStatus?: number;
  requestMode?: SkillFetchSource;
}

function getZhizApiBaseUrl(): string {
  return config.OAUTH_ZHIZ_BASE_URL.replace(/\/+$/, '');
}

function getZhizSkillEndpointBaseUrl(): string {
  return `${getZhizApiBaseUrl()}/oauth2/userSkill`;
}

function buildZhizSkillRequestUrl(accessToken?: string): string {
  const url = new URL(getZhizSkillEndpointBaseUrl());
  if (accessToken) {
    url.searchParams.set('access_token', accessToken);
  }
  return url.toString();
}

function getRequestSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(SKILL_REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSkillArray(value: unknown): value is ZhizSkillRecord[] {
  return Array.isArray(value) && value.every((item) => isRecord(item));
}

/**
 * 2026-04-16 新增 — Skill 上游响应保守解包
 * 变更类型：新增/兼容
 * 功能描述：将 Zhiz skill 接口的常见包装结构保守解包为前端所需的数组数据。
 * 设计思路：
 *   1. 优先接受最明确的 `[]` 原始数组响应。
 *   2. 仅兼容 `data / skills / list` 这类低风险包装字段，避免猜测过多未确认 schema。
 *   3. 若无法确定数组载荷则显式失败，避免把对象误当成 skill 列表向前传递。
 * 参数与返回值：extractSkillArray(payload) 接收任意 JSON 载荷，成功时返回 ZhizSkillRecord[]。
 * 影响范围：Zhiz skill 代理统一响应标准化。
 * 潜在风险：若上游未来改为新的深层包装字段，需要同步补充这里的白名单解包规则。
 */
function extractSkillArray(payload: unknown): ZhizSkillRecord[] {
  if (isSkillArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    throw new AppError('AUTH_PROVIDER_ERROR', 'Zhiz skill endpoint returned invalid payload');
  }

  const directCandidates: unknown[] = [payload.data, payload.skills, payload.list];
  for (const candidate of directCandidates) {
    if (isSkillArray(candidate)) {
      return candidate;
    }
  }

  if (isRecord(payload.data)) {
    const nestedCandidates: unknown[] = [payload.data.list, payload.data.skills];
    for (const candidate of nestedCandidates) {
      if (isSkillArray(candidate)) {
        return candidate;
      }
    }
  }

  throw new AppError('AUTH_PROVIDER_ERROR', 'Zhiz skill endpoint returned invalid payload');
}

function getUpstreamErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const candidates = [payload.message, payload.error_description, payload.error, payload.msg];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

async function parseZhizSkillPayload(response: Response, logUrl: string): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch (err) {
    log.error(
      {
        err,
        logUrl,
        status: response.status,
        contentType,
        responsePreview: responseText.slice(0, 200),
      },
      'Zhiz skill endpoint returned a non-JSON response',
    );
    throw new AppError(
      'AUTH_PROVIDER_ERROR',
      `Zhiz skill fetch failed: skill endpoint returned ${contentType || 'non-JSON content'} (status ${response.status})`,
    );
  }
}

function isUpstreamAuthFailure(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return false;
  }

  const details = error.details as UpstreamSkillErrorDetails | undefined;
  return typeof details?.upstreamStatus === 'number'
    ? TOKEN_AUTH_FAILURE_STATUSES.has(details.upstreamStatus)
    : false;
}

async function resolveZhizAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.oAuthAccount.findFirst({
    where: {
      userId,
      provider: 'zhiz',
    },
    select: {
      accessToken: true,
    },
  });

  if (!account?.accessToken) {
    return null;
  }

  try {
    return decryptOAuthToken(account.accessToken);
  } catch (err) {
    log.error({ err, userId }, 'Zhiz OAuth token decryption failed during skill fetch');
    throw new AppError('AUTH_ZHIZ_TOKEN_DECRYPT_FAILED', 'Failed to decrypt Zhiz OAuth token');
  }
}

async function requestZhizSkills(
  requestMode: SkillFetchSource,
  accessToken?: string,
): Promise<ZhizSkillRecord[]> {
  const logUrl = getZhizSkillEndpointBaseUrl();
  const requestUrl = buildZhizSkillRequestUrl(accessToken);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'GET',
      signal: getRequestSignal(),
    });
  } catch (err) {
    const message =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
        ? 'Zhiz skill fetch failed: upstream request timed out'
        : 'Zhiz skill fetch failed: upstream request failed';
    log.error({ err, logUrl, requestMode }, 'Zhiz skill upstream request failed');
    throw new AppError('AUTH_PROVIDER_ERROR', message, { requestMode });
  }

  const payload = await parseZhizSkillPayload(response, logUrl);
  if (!response.ok) {
    throw new AppError(
      'AUTH_PROVIDER_ERROR',
      `Zhiz skill fetch failed: ${getUpstreamErrorMessage(payload) || `upstream returned status ${response.status}`}`,
      {
        upstreamStatus: response.status,
        requestMode,
      },
    );
  }

  return extractSkillArray(payload);
}

export async function fetchZhizSkills(
  options: FetchZhizSkillsOptions = {},
): Promise<FetchZhizSkillsResult> {
  const normalizedUserId = typeof options.userId === 'string' ? options.userId.trim() : '';

  if (!normalizedUserId) {
    const skills = await requestZhizSkills('anonymous');
    return {
      skills,
      source: 'anonymous',
      usedToken: false,
      fallbackReason: null,
    };
  }

  const accessToken = await resolveZhizAccessToken(normalizedUserId);
  if (!accessToken) {
    const skills = await requestZhizSkills('anonymous');
    return {
      skills,
      source: 'anonymous',
      usedToken: false,
      fallbackReason: 'missing_token',
    };
  }

  try {
    const skills = await requestZhizSkills('authenticated', accessToken);
    return {
      skills,
      source: 'authenticated',
      usedToken: true,
      fallbackReason: null,
    };
  } catch (err) {
    if (!isUpstreamAuthFailure(err)) {
      throw err;
    }

    log.warn(
      {
        userId: normalizedUserId,
        upstreamStatus: (err as AppError).details?.upstreamStatus,
      },
      'Zhiz skill authenticated fetch failed; retrying anonymously once',
    );

    const skills = await requestZhizSkills('anonymous');
    return {
      skills,
      source: 'anonymous',
      usedToken: false,
      fallbackReason: 'upstream_auth_failed',
    };
  }
}
