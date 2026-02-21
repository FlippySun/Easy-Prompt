import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Trending } from "./pages/Trending";
import { Favorites } from "./pages/Favorites";
import { Profile } from "./pages/Profile";
import { Collections } from "./pages/Collections";
import { TagFilter } from "./pages/TagFilter";
import { Galaxy } from "./pages/Galaxy";

function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="mb-4 text-5xl">🚀</div>
      <h2 className="mb-2 text-xl font-bold">即将推出</h2>
      <p className="text-gray-400">该功能正在开发中，敬请期待...</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/galaxy",
    Component: Galaxy,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "category/:categoryId", Component: Home },
      { path: "tag/:tagName", Component: TagFilter },
      { path: "trending", Component: Trending },
      { path: "favorites", Component: Favorites },
      { path: "collections", Component: Collections },
      { path: "profile", Component: Profile },
      { path: "*", Component: ComingSoon },
    ],
  },
]);