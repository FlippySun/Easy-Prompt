import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';

// 路由级代码分割 — 按需加载页面组件
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Trending = lazy(() => import('./pages/Trending').then((m) => ({ default: m.Trending })));
const Favorites = lazy(() => import('./pages/Favorites').then((m) => ({ default: m.Favorites })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const Collections = lazy(() => import('./pages/Collections').then((m) => ({ default: m.Collections })));
const TagFilter = lazy(() => import('./pages/TagFilter').then((m) => ({ default: m.TagFilter })));
const Galaxy = lazy(() => import('./pages/Galaxy').then((m) => ({ default: m.Galaxy })));
const CollectionDetail = lazy(() => import('./pages/CollectionDetail'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const CallbackPage = lazy(() => import('./pages/auth/CallbackPage').then((m) => ({ default: m.CallbackPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ZhizCompletePage = lazy(() =>
  import('./pages/auth/ZhizCompletePage').then((m) => ({ default: m.ZhizCompletePage })),
);

/**
 * 2026-04-16 新增 — 腾讯云 SES 邮件模板公开预览路由
 * 变更类型：新增/前端/路由
 * 功能描述：新增公开访问的 Zhiz 登录验证码邮件模板预览页懒加载入口，供邮件视觉验收与腾讯云 HTML 模板交付自检使用。
 * 设计思路：采用独立 public route，避免将纯预览能力耦合到 `/admin/*` 权限体系，同时继续复用现有路由级懒加载策略控制首屏体积。
 * 参数与返回值：无新增路由参数；访问固定路径 `/preview/email/zhiz-verification` 时返回预览页面组件。
 * 影响范围：Web-Hub 路由表、邮件模板验收入口、公开可访问测试页面。
 * 潜在风险：公开路由可被直接访问，但页面仅展示静态模板与本地预览，不暴露敏感业务数据。
 */
const EmailTemplatePreviewPage = lazy(() =>
  import('./pages/EmailTemplatePreviewPage').then((m) => ({ default: m.EmailTemplatePreviewPage })),
);

/**
 * 2026-04-21 新增 — Zhiz AI 邮件模板独立预览路由
 * 变更类型：新增/前端/路由
 * 功能描述：复制现有验证码邮件预览能力到新的公开路径 `/preview/email/zhiz-ai-verification`，用于后续独立迭代 AI 版投递页。
 * 设计思路：保持旧路由不变，同时通过独立页面组件与独立 HTML 模板资产建立安全隔离，降低后续改版互相影响的风险。
 * 参数与返回值：无新增路由参数；访问固定路径 `/preview/email/zhiz-ai-verification` 时返回 AI 版预览页面组件。
 * 影响范围：Web-Hub 路由表、AI 版邮件模板验收入口、后续新投递页改版流程。
 * 潜在风险：短期内新旧页面存在少量重复代码，但这是为了换取独立迭代边界；当前无已知核心业务风险。
 */
const ZhizAiEmailTemplatePreviewPage = lazy(() =>
  import('./pages/ZhizAiEmailTemplatePreviewPage').then((m) => ({ default: m.ZhizAiEmailTemplatePreviewPage })),
);

// 2026-04-09 新增 — P6.05~P6.08 Admin 页面（lazy load）
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard').then((m) => ({ default: m.Dashboard })));
const AdminProviders = lazy(() => import('./pages/admin/Providers').then((m) => ({ default: m.Providers })));
const AdminBlacklist = lazy(() => import('./pages/admin/Blacklist').then((m) => ({ default: m.Blacklist })));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics').then((m) => ({ default: m.Analytics })));
// 2026-04-09 新增 — P4.05 Prompt 审核管理页面
const AdminPromptReview = lazy(() => import('./pages/admin/PromptReview').then((m) => ({ default: m.PromptReview })));
// 2026-04-10 新增 — 增强日志管理（方案 B：列表 + 独立详情页）
const AdminEnhanceLogs = lazy(() => import('./pages/admin/EnhanceLogs').then((m) => ({ default: m.EnhanceLogs })));
const AdminLogDetail = lazy(() => import('./pages/admin/LogDetail').then((m) => ({ default: m.LogDetail })));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="mb-4 text-5xl">🚀</div>
      <h2 className="mb-2 text-xl font-bold">即将推出</h2>
      <p className="text-gray-400">该功能正在开发中，敬请期待...</p>
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  // 2026-04-09 新增 — P6.05~P6.08 Admin 路由组
  {
    path: '/admin',
    element: (
      <SuspenseWrapper>
        <AdminLayout />
      </SuspenseWrapper>
    ),
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <AdminDashboard />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'prompts',
        element: (
          <SuspenseWrapper>
            <AdminPromptReview />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'providers',
        element: (
          <SuspenseWrapper>
            <AdminProviders />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'blacklist',
        element: (
          <SuspenseWrapper>
            <AdminBlacklist />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'analytics',
        element: (
          <SuspenseWrapper>
            <AdminAnalytics />
          </SuspenseWrapper>
        ),
      },
      // 2026-04-10 新增 — 增强日志管理路由
      {
        path: 'logs',
        element: (
          <SuspenseWrapper>
            <AdminEnhanceLogs />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'logs/:id',
        element: (
          <SuspenseWrapper>
            <AdminLogDetail />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  {
    path: '/galaxy',
    element: (
      <SuspenseWrapper>
        <Galaxy />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/auth/login',
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/auth/callback',
    element: (
      <SuspenseWrapper>
        <CallbackPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/auth/zhiz/complete',
    element: (
      <SuspenseWrapper>
        <ZhizCompletePage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/preview/email/zhiz-verification',
    element: (
      <SuspenseWrapper>
        <EmailTemplatePreviewPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/preview/email/zhiz-ai-verification',
    element: (
      <SuspenseWrapper>
        <ZhizAiEmailTemplatePreviewPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/auth/register',
    element: (
      <SuspenseWrapper>
        <RegisterPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/',
    Component: Layout,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <Home />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'category/:categoryId',
        element: (
          <SuspenseWrapper>
            <Home />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'tag/:tagName',
        element: (
          <SuspenseWrapper>
            <TagFilter />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'trending',
        element: (
          <SuspenseWrapper>
            <Trending />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'favorites',
        element: (
          <SuspenseWrapper>
            <Favorites />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'collections',
        element: (
          <SuspenseWrapper>
            <Collections />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'collection/:collectionId',
        element: (
          <SuspenseWrapper>
            <CollectionDetail />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'profile',
        element: (
          <SuspenseWrapper>
            <Profile />
          </SuspenseWrapper>
        ),
      },
      { path: '*', Component: ComingSoon },
    ],
  },
]);
