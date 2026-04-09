/**
 * Zod 验证中间件工厂
 * 2026-04-07 新增 — P1.09
 * 设计思路：接受 Zod schema，对 body/query/params 任意组合进行校验
 *   校验失败抛 AppError(VALIDATION_FAILED)，由 errorHandler 统一处理
 * 影响范围：所有需要入参校验的路由
 * 潜在风险：无已知风险
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/errors';

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * 用法示例：
 * ```
 * router.post('/users', validate({ body: createUserSchema }), createUser);
 * ```
 */
export function validate(schemas: ValidateOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: { target: string; issues: unknown[] }[] = [];

    for (const [target, schema] of Object.entries(schemas) as [string, ZodSchema][]) {
      const data = req[target as keyof typeof req];
      const result = schema.safeParse(data);
      if (!result.success) {
        errors.push({
          target,
          issues: (result.error as ZodError).issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
            code: i.code,
          })),
        });
      } else {
        // 2026-04-08 修复 — 用 defineProperty 回写解析后的值
        // 设计思路：Express 5+ 中 req.query 为 getter-only，
        //   Object.assign 无法写入，需通过 defineProperty 覆盖
        // 影响范围：所有使用 validate({ query }) 的路由
        // 潜在风险：无已知风险（仅覆盖当前请求实例的属性描述符）
        Object.defineProperty(req, target, {
          value: result.data,
          writable: true,
          configurable: true,
        });
      }
    }

    if (errors.length > 0) {
      throw new AppError('VALIDATION_FAILED', 'Input validation failed', {
        validationErrors: errors,
      });
    }

    next();
  };
}
