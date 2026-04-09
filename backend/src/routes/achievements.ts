/**
 * Achievement 路由 — 成就列表、用户已解锁成就、手动触发检测
 * 2026-04-08 新增 — P3.07 Achievement Routes
 * 设计思路：路由层仅做入参校验 + 调用 service + 序列化响应
 *   成就列表为公开接口（optionalAuth），登录用户可看到解锁状态
 *   手动触发检测为登录用户专属（通常由前端在交互后调用）
 * 影响范围：/api/v1/achievements/* 端点
 * 潜在风险：无已知风险
 */

import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middlewares/auth';
import {
  listAchievements,
  getUserUnlockedAchievements,
  checkAndUnlockAchievements,
} from '../services/achievement.service';

const router = Router();

/**
 * GET /api/v1/achievements — 所有成就列表（含当前用户解锁状态）
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const data = await listAchievements(req.user?.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/achievements/me — 当前用户已解锁的成就
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const data = await getUserUnlockedAchievements(req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/achievements/check — 手动触发成就条件检测
 * 返回新解锁的成就 ID 列表
 */
router.post('/check', requireAuth, async (req, res, next) => {
  try {
    const newlyUnlocked = await checkAndUnlockAchievements(req.user!.userId);
    res.json({ success: true, data: { newlyUnlocked } });
  } catch (err) {
    next(err);
  }
});

export default router;
