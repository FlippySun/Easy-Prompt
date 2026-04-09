/**
 * 服务器启动入口
 * 2026-04-07 新增 — P1.36 应用入口
 * 设计思路：从 config 读取 PORT/HOST，创建 app 并监听
 *   开发环境打印完整启动信息，生产环境仅输出关键日志
 * 影响范围：进程入口
 * 潜在风险：无已知风险
 */

import { config } from './config';
import { createApp } from './app';
import { logger } from './utils/logger';
import { initCronJobs } from './cron';

const app = createApp();

app.listen(config.PORT, config.HOST, () => {
  logger.info(
    {
      port: config.PORT,
      host: config.HOST,
      env: config.NODE_ENV,
    },
    `🚀 Easy Prompt Backend started on http://${config.HOST}:${config.PORT}`,
  );

  // 2026-04-08 新增 — P2.08 启动定时任务
  initCronJobs();
});
