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
