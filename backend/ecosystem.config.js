/**
 * PM2 Ecosystem 配置
 * 2026-04-08 新增 — P2.15
 * 变更类型：新增
 * 设计思路：PM2 进程管理配置，cluster 模式利用多核，
 *   配置 graceful shutdown、内存限制、日志路径。
 *   生产环境使用 `pm2 start ecosystem.config.js --env production`
 * 参数：见下方 apps 配置
 * 影响范围：生产环境进程管理
 * 潜在风险：无已知风险（仅配置文件）
 */

module.exports = {
  apps: [
    {
      // ── 基本信息 ──
      name: 'easy-prompt-api',
      script: 'dist/server.js',
      cwd: __dirname,

      // ── 集群模式（利用多核） ──
      instances: 2,
      exec_mode: 'cluster',

      // ── 环境变量 ──
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // ── 内存限制（超过自动重启） ──
      max_memory_restart: '500M',

      // ── 日志配置 ──
      log_file: './logs/combined.log',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true, // cluster 模式合并日志

      // ── Graceful shutdown ──
      kill_timeout: 5000, // SIGINT 后等待 5s 再 SIGKILL
      listen_timeout: 10000, // 等待 ready 信号的超时
      wait_ready: true, // 等待 process.send('ready') 信号

      // ── 自动重启策略 ──
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s', // 启动 10s 内崩溃算异常重启
      restart_delay: 4000, // 重启间隔 4s

      // ── 文件监听（仅开发环境，生产环境禁用） ──
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git', 'prisma/data'],

      // ── 其他 ──
      source_map_support: true,
    },
  ],
};
