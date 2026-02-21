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
  {
    path: '/galaxy',
    element: (
      <SuspenseWrapper>
        <Galaxy />
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
