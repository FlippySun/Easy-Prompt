/**
 * 邮件发送服务（Zhiz OAuth 邮箱验证码）
 * 2026-04-15 优化 — Zhiz OAuth Superpowers Execute T4（方案 B）
 * 变更类型：优化/安全
 * 功能描述：封装腾讯云 SES API 客户端的创建与验证码模板邮件发送，供 Zhiz password-setup challenge 复用。
 * 设计思路：
 *   1. 将腾讯云 SES SDK 细节隔离在独立 service，避免 OAuth 业务层直接依赖第三方发信实现。
 *   2. 使用单例 SES client 复用凭证、地域和超时配置，保持调用入口稳定且减少重复初始化。
 *   3. SES 未配置或 SDK 调用失败统一映射为 `AUTH_ZHIZ_EMAIL_SEND_FAILED`，避免暴露底层供应商细节给前端。
 * 参数与返回值：`sendZhizPasswordSetupCodeEmail(input)` 接收收件人、验证码和展示名，无返回值。
 * 影响范围：Zhiz OAuth `password-setup/start` 邮件验证码子流程。
 * 潜在风险：SES 模板或凭证配置错误会导致方案 B 无法发信，但不会消费 continuation ticket 或提前修改用户数据。
 */

import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('mail');
const SesClient = tencentcloud.ses.v20201002.Client;
const SES_ENDPOINT = 'ses.tencentcloudapi.com';
const SES_SUBJECT = '【Easy Prompt】Zhiz 登录邮箱验证码';
// 2026-04-15 配置固化 — 当前腾讯云验证码模板仅声明 `verifyCode` 一个动态字段。
// 变更类型：配置/兼容
// 功能描述：将模板数据 key 固定为腾讯云控制台已创建模板的占位符名，避免运行时字段不匹配导致发送失败。
// 设计思路：模板内容当前不消费 displayName，因此仅传验证码字段；若模板升级为多变量，再在此处集中扩展。
// 参数与返回值：该常量仅影响构造给 `Template.TemplateData` 的 JSON 结构，无单独返回值。
// 影响范围：Zhiz OAuth password-setup/start 邮件发送请求。
// 潜在风险：若腾讯云模板占位符改名但代码未同步，发送接口会按模板参数错误失败。
const SES_TEMPLATE_DATA_KEY = 'verifyCode';
const SES_TRIGGER_TYPE = 1;
type SesClientInstance = InstanceType<typeof SesClient>;
let sesClient: SesClientInstance | null = null;

interface TencentCloudSesSendEmailResponse {
  MessageId?: string;
  RequestId?: string;
}

export interface ZhizPasswordSetupCodeEmailInput {
  to: string;
  code: string;
  displayName?: string | null;
}

function assertMailConfig(): void {
  if (
    !config.TENCENTCLOUD_SECRET_ID ||
    !config.TENCENTCLOUD_SECRET_KEY ||
    !config.TENCENTCLOUD_REGION ||
    !config.TENCENTCLOUD_SES_FROM_EMAIL ||
    config.TENCENTCLOUD_SES_TEMPLATE_ID <= 0
  ) {
    throw new AppError(
      'AUTH_ZHIZ_EMAIL_SEND_FAILED',
      'Tencent Cloud SES service is not configured for Zhiz email verification',
    );
  }
}

function getSesClient(): SesClientInstance {
  if (sesClient) {
    return sesClient;
  }

  assertMailConfig();
  sesClient = new SesClient({
    credential: {
      secretId: config.TENCENTCLOUD_SECRET_ID,
      secretKey: config.TENCENTCLOUD_SECRET_KEY,
    },
    region: config.TENCENTCLOUD_REGION,
    profile: {
      signMethod: 'TC3-HMAC-SHA256',
      httpProfile: {
        reqMethod: 'POST',
        reqTimeout: 15,
        endpoint: SES_ENDPOINT,
      },
    },
  });
  return sesClient;
}

function buildZhizVerificationTemplateData(code: string): string {
  return JSON.stringify({
    [SES_TEMPLATE_DATA_KEY]: code,
  });
}

async function sendSesTemplateEmail(
  input: ZhizPasswordSetupCodeEmailInput,
): Promise<TencentCloudSesSendEmailResponse> {
  const client = getSesClient();
  return (await client.SendEmail({
    FromEmailAddress: config.TENCENTCLOUD_SES_FROM_EMAIL,
    Destination: [input.to],
    ReplyToAddresses: config.TENCENTCLOUD_SES_FROM_EMAIL,
    Subject: SES_SUBJECT,
    TriggerType: SES_TRIGGER_TYPE,
    Template: {
      TemplateID: config.TENCENTCLOUD_SES_TEMPLATE_ID,
      TemplateData: buildZhizVerificationTemplateData(input.code),
    },
  })) as TencentCloudSesSendEmailResponse;
}

export async function sendZhizPasswordSetupCodeEmail(
  input: ZhizPasswordSetupCodeEmailInput,
): Promise<void> {
  try {
    const result = await sendSesTemplateEmail(input);
    log.info(
      {
        to: input.to,
        messageId: result.MessageId,
        requestId: result.RequestId,
      },
      'Zhiz password setup verification email sent via Tencent Cloud SES',
    );
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    log.error(
      { err, to: input.to },
      'Failed to send Zhiz password setup verification email via Tencent Cloud SES',
    );
    throw new AppError(
      'AUTH_ZHIZ_EMAIL_SEND_FAILED',
      'Failed to send Zhiz password setup verification email',
    );
  }
}
