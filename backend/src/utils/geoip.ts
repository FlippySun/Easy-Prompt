/**
 * GeoIP 地理定位服务
 * 2026-04-08 新增 — P2.06（占位）
 * 2026-04-08 实现 — P2.06（geoip-lite 集成）
 * 变更类型：修改
 * 设计思路：使用 geoip-lite（MaxMind GeoLite2 免费数据库）将 IP 解析为
 *   country / region / city。geoip-lite 在首次 require 时加载 ~60MB 内存数据库，
 *   后续查询为纯内存 O(1) 操作，无网络延迟。
 *   Prisma schema 已预留 country / region 字段（AiRequestLog 表）。
 * 参数：ip — IPv4 或 IPv6 地址
 * 返回：GeoResult | null（内网/loopback/未知 IP 返回 null）
 * 影响范围：ai-gateway.service.ts recordLog 填充 country/region
 * 潜在风险：geoip-lite 首次加载增加 ~60MB 内存 + ~200ms 启动延迟
 */

import geoip from 'geoip-lite';

export interface GeoResult {
  /** ISO 3166-1 alpha-2 国家码（如 CN, US） */
  country: string;
  /** 地区/省份 */
  region: string | null;
  /** 城市 */
  city: string | null;
}

/**
 * 根据 IP 地址查询地理位置
 * 使用 geoip-lite 内存数据库，查询延迟 <1ms
 * 内网/loopback/未知 IP 返回 null
 */
export function lookupGeo(ip: string): GeoResult | null {
  if (!ip) return null;

  const geo = geoip.lookup(ip);
  if (!geo) return null;

  return {
    country: geo.country,
    region: geo.region || null,
    city: geo.city || null,
  };
}
