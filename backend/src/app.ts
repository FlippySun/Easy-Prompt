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

export function createApp() {
  const app = express();

  // ── 安全头 ──
  app.use(helmet());

  // ── CORS ──
  // 2026-04-10 安全修复 — SSO Plan v2 C3.7
  // 变更类型：安全
  // 设计思路：生产环境下 CORS_ORIGINS 为空时拒绝跨域（不回退到 '*'），
  //   开发环境允许 '*' 方便本地调试
  // 影响范围：全局 CORS 策略
  // 潜在风险：若生产环境 CORS_ORIGINS 未配置会阻断所有跨域请求（fail-safe）
  const origins = getCorsOrigins();
  const isProd = process.env.NODE_ENV === 'production';
  app.use(
    cors({
      origin: origins.length > 0 ? origins : isProd ? false : '*',
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
  app.use('/api/v1/auth/me', loginLimiter);
  app.use('/api/v1/auth/sso', loginLimiter);
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
