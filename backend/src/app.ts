/**
 * Express 应用实例创建与中间件注册
 * 2026-04-07 新增 — P1.36 应用组装
 * 2026-04-08 修复 — 挂载 blacklistGuard 中间件、应用 rateLimiter 到路由、新增 scenes/providers 公开路由
 * 设计思路：将 app 创建与 server 启动分离，便于测试
 *   中间件注册顺序：helmet → cors → cookieParser → bodyParser → requestLogger → fingerprint → blacklistGuard → routes → errorHandler
 * 影响范围：全局 Express 实例
 * 潜在风险：无已知风险
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requestLogger } from './middlewares/requestLogger';
import { fingerprintExtractor } from './middlewares/fingerprint';
import { blacklistGuard } from './middlewares/blacklist';
import { createRateLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import { config, getCorsOrigins } from './config';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import aiRouter from './routes/ai';
import metaRouter from './routes/meta';
import scenesRouter from './routes/scenes';
import blacklistRouter from './routes/blacklist';
import providersRouter from './routes/providers';
import analyticsRouter from './routes/analytics';
// 2026-04-08 新增 — P3 PromptHub 数据层路由
import promptsRouter from './routes/prompts';
// 2026-04-08 新增 — P4.02 Trending 路由
import trendingRouter from './routes/trending';
// 2026-04-08 新增 — P4.05 Admin Prompt 审核路由
import adminPromptsRouter from './routes/admin.routes';
import collectionsRouter from './routes/collections';
import achievementsRouter from './routes/achievements';
import usersRouter from './routes/users';
// 2026-04-09 新增 — P6.01 跨设备历史同步路由
import historyRouter from './routes/history';
// 2026-04-09 新增 — P6.03 OAuth 第三方登录路由
import oauthRouter from './routes/oauth';
// 2026-04-09 新增 — P6.05 Admin Dashboard 统计路由
import dashboardRouter from './routes/dashboard';
import { SSO } from './config/constants';

/**
 * 2026-04-15 修复 — SSO 多端受控源 CORS 统一校验
 * 变更类型：修复/安全/兼容
 * 功能描述：让 backend CORS 与受控 SSO 客户端边界对齐，避免 `*.zhiz.chat`、浏览器扩展回调页等已允许完成 SSO 跳回的客户端，随后在 `/api/v1/auth/sso/token` 预检或换 token 阶段被 CORS 拦截。
 * 设计思路：
 *   1. `development` 环境继续允许任意 Origin，保留本地联调效率；`test/production` 改为精确判断。
 *   2. 先匹配 `CORS_ORIGINS` 的显式配置，再复用 `SSO.ALLOWED_REDIRECT_PATTERNS` 识别受控 Web / Browser / IDE 客户端来源。
 *   3. 对 Origin 做无尾斜杠归一化，再补 `/` 喂给 redirect pattern，兼容 `localhost`、`*.zhiz.chat` 与扩展 scheme 的既有正则写法。
 * 参数与返回值：`isCorsOriginAllowed(origin, configuredOrigins, allowAllOrigins)` 返回布尔值，无副作用。
 * 影响范围：全局 CORS、`/api/v1/auth/*` 跨域访问、Web / Web-Hub / Browser Extension SSO code exchange。
 * 潜在风险：CORS 可访问面与 SSO redirect allowlist 绑定；后续若新增客户端协议，需要同步评估“允许跳回”与“允许跨域调用”是否仍应保持一致。
 */
function normalizeOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

function isConfiguredCorsOrigin(origin: string, configuredOrigins: string[]): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  return configuredOrigins.some(
    (configuredOrigin) => normalizeOrigin(configuredOrigin) === normalizedOrigin,
  );
}

function isSsoClientOrigin(origin: string): boolean {
  const normalizedOrigin = `${normalizeOrigin(origin)}/`;
  return SSO.ALLOWED_REDIRECT_PATTERNS.some((pattern) => pattern.test(normalizedOrigin));
}

function isCorsOriginAllowed(
  origin: string,
  configuredOrigins: string[],
  allowAllOrigins: boolean,
): boolean {
  if (allowAllOrigins) {
    return true;
  }

  return isConfiguredCorsOrigin(origin, configuredOrigins) || isSsoClientOrigin(origin);
}

export function createApp() {
  const app = express();

  // ── 安全头 ──
  app.use(helmet());

  // ── CORS ──
  // 2026-04-15 修复 — Zhiz/Web/Browser SSO token exchange CORS 边界对齐
  // 变更类型：修复/安全/兼容
  // 功能描述：在保留显式 `CORS_ORIGINS` 配置的同时，允许受控 `*.zhiz.chat`、Browser Extension、VS Code / IntelliJ 回调源完成跨域换 token。
  // 设计思路：开发环境放宽到任意 Origin；测试/生产环境统一走 `isCorsOriginAllowed()` 精确判定，避免再次出现 redirect allowlist 已放行但 CORS 仍拦截的链路分叉。
  // 参数与返回值：`origin` 回调根据请求 Origin 返回 allow / deny；无业务返回值。
  // 影响范围：全局 CORS 策略、SSO `/api/v1/auth/sso/token` 与 `/api/v1/auth/refresh` 的浏览器跨域访问。
  // 潜在风险：若未来某类客户端只应允许 redirect 不应允许跨域 API，需要把其协议从共享判断中拆出。
  const origins = getCorsOrigins();
  const allowAllOrigins = process.env.NODE_ENV === 'development';
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        callback(null, isCorsOriginAllowed(origin, origins, allowAllOrigins));
      },
      credentials: true,
      maxAge: 86400,
    }),
  );

  // ── Cookie 解析 ──
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // ── Body 解析 ──
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── 请求日志 ──
  app.use(requestLogger);

  // ── 指纹提取 ──
  app.use(fingerprintExtractor);

  // ── 黑名单拦截（在路由之前，指纹之后，确保 req.fingerprint 已就绪）──
  // 2026-04-08 修复 — 原 blacklistGuard 仅定义未挂载
  app.use(blacklistGuard);

  // ── 全局限流（滑动窗口，Redis 不可用时降级放行）──
  // 2026-04-08 修复 — 原 createRateLimiter 仅定义未应用
  const globalLimiter = createRateLimiter({
    scope: 'global',
    max: config.RATE_LIMIT_GLOBAL_MAX,
    windowSec: config.RATE_LIMIT_GLOBAL_WINDOW_SEC,
  });
  app.use(globalLimiter);

  // ── 路由级限流器（按场景差异化）──
  const aiLimiter = createRateLimiter({
    scope: 'ai',
    max: config.RATE_LIMIT_AI_MAX,
    windowSec: config.RATE_LIMIT_AI_WINDOW_SEC,
  });
  const loginLimiter = createRateLimiter({
    scope: 'login',
    max: config.RATE_LIMIT_LOGIN_MAX,
    windowSec: config.RATE_LIMIT_LOGIN_WINDOW_SEC,
  });
  // 2026-04-22 修复 — 登录态探测与 SSO code 流程限流拆分
  // 变更类型：fix
  // What：把 `/auth/me` 与 `/auth/sso/*` 从“5 次/60s 登录尝试”配额中拆出，分别使用更贴近真实跳转链路的读态/SSO 配额。
  // Why：正常的跨端复用登录与 code 回跳会自然包含 `me`、`sso/authorize`、`sso/token` 等请求，继续共用 loginLimiter 会误伤正常跳转并产生 429。
  // Params & return：`authStateLimiter` 负责 `/api/v1/auth/me`（60/60s），`ssoFlowLimiter` 负责 `/api/v1/auth/sso/*`（30/60s）；无业务返回值。
  // Impact scope：Web、Web-Hub、Browser 的 SSO 登录/恢复链路与 backend `/api/v1/auth/*` 路由级限流。
  // Risk：提升了已认证读态与 SSO 回跳的吞吐上限，但登录口令暴力防护仍由原 `loginLimiter` 独立承担。
  const authStateLimiter = createRateLimiter({
    scope: 'auth-state',
    max: 60,
    windowSec: 60,
  });
  const ssoFlowLimiter = createRateLimiter({
    scope: 'sso-flow',
    max: 30,
    windowSec: 60,
  });
  // 2026-04-10 新增 — SSO 全端审计 P0-2
  // 变更类型：安全/性能
  // 设计思路：/auth/refresh 使用独立 refreshLimiter（scope 隔离），
  //   防止多客户端自动刷新 token 消耗 loginLimiter 配额导致用户被锁定。
  //   配额 60 req/60s 远高于正常刷新频率（每客户端约 1 次/50min），
  //   但仍可防止恶意刷新攻击。
  // 影响范围：仅 POST /api/v1/auth/refresh
  // 潜在风险：无已知风险
  const refreshLimiter = createRateLimiter({
    scope: 'refresh',
    max: 60,
    windowSec: 60,
  });

  // ── 路由挂载 ──
  app.use('/health', healthRouter);
  // 2026-04-10 修改 — SSO 全端审计 P0-2
  // 按子路径精确挂载 limiter，避免 loginLimiter 覆盖 refresh 端点。
  // Express app.use 是前缀匹配，必须将子路径 limiter 放在 authRouter 之前。
  app.use('/api/v1/auth/refresh', refreshLimiter);
  app.use('/api/v1/auth/register', loginLimiter);
  app.use('/api/v1/auth/login', loginLimiter);
  app.use('/api/v1/auth/me', authStateLimiter);
  app.use('/api/v1/auth/sso', ssoFlowLimiter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/ai', aiLimiter, aiRouter);
  app.use('/api/v1/meta', metaRouter);
  app.use('/api/v1/scenes', scenesRouter);
  app.use('/api/v1/admin/blacklist', blacklistRouter);
  app.use('/api/v1/admin/providers', providersRouter);
  // 2026-04-08 新增 — P2.05 Analytics 管理路由
  app.use('/api/v1/admin/analytics', analyticsRouter);
  // 2026-04-08 新增 — P4.05 Admin Prompt 审核路由
  app.use('/api/v1/admin/prompts', adminPromptsRouter);
  // 2026-04-08 新增 — P4.02 Trending 公开路由
  app.use('/api/v1/trending', trendingRouter);
  // 2026-04-08 新增 — P3 PromptHub 数据层路由
  app.use('/api/v1/prompts', promptsRouter);
  app.use('/api/v1/collections', collectionsRouter);
  app.use('/api/v1/achievements', achievementsRouter);
  app.use('/api/v1/users', usersRouter);
  // 2026-04-09 新增 — P6.01 跨设备历史同步
  app.use('/api/v1/history', historyRouter);
  // 2026-04-09 新增 — P6.03 OAuth 第三方登录
  app.use('/api/v1/auth/oauth', oauthRouter);
  // 2026-04-09 新增 — P6.05 Admin Dashboard 统计
  app.use('/api/v1/admin/dashboard', dashboardRouter);

  // ── 404 兜底 ──
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Route not found',
        httpStatus: 404,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ── 全局错误处理（必须在所有路由之后） ──
  app.use(errorHandler);

  return app;
}
