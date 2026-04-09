import { Outlet, useOutletContext, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { FloatingActions } from './FloatingActions';
import { CommandPalette } from './CommandPalette';
import { CustomCursor } from './CustomCursor';
import { ParticleBurstRenderer } from './ParticleBurst';
import { PromptDetailDrawer } from './PromptDetailDrawer';
import { ScrollProgress } from './ScrollProgress';
import { CrossProductGuide } from './CrossProductGuide';
import { AuroraOrbs } from './AuroraOrbs';
import { Toaster } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import { type Prompt } from '../data/prompts';
import { usePrompts } from '../hooks/usePrompts';
import { useMeta } from '../hooks/useMeta';
import { PromptDataContext } from '../hooks/usePromptData';
import { unlockAchievementAction, recordViewAction } from '../hooks/usePromptStore';
import { DrawerContext } from '../hooks/useDrawerContext';

interface LayoutContext {
  darkMode: boolean;
  search: string;
  setSearch: (v: string) => void;
  onOpenCmdPalette: () => void;
}

export function useLayoutContext() {
  return useOutletContext<LayoutContext>();
}

function AnimatedOutlet({ ctx }: { ctx: LayoutContext }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <Outlet context={ctx} />
      </motion.div>
    </AnimatePresence>
  );
}

export function Layout() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('prompthub_dark_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [search, setSearch] = useState('');
  const [cmdOpen, setCmdOpen] = useState(false);

  // Singleton drawer state — one drawer for the entire app
  const [drawerPrompt, setDrawerPrompt] = useState<Prompt | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback((prompt: Prompt) => {
    setDrawerPrompt(prompt);
    setDrawerOpen(true);
    recordViewAction(prompt.id);
  }, []);

  // Persist dark mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('prompthub_dark_mode', String(darkMode));
    } catch {
      // localStorage unavailable (e.g. incognito)
    }
  }, [darkMode]);

  // Cmd+K global listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        unlockAchievementAction('cmd_k');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Detect cross-product referral: ?from=web → unlock prompt_crafter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'web') {
      unlockAchievementAction('eco_explorer');
      unlockAchievementAction('prompt_crafter');
      // Clean up URL param without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('from');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  // 2026-04-09 — P5 迁移：全局加载 Prompt 数据，通过 Context 共享给所有子组件
  const { prompts: globalPrompts } = usePrompts({ pageSize: 200 });

  // 2026-04-10 — P5 修复：预热分类/模型元数据缓存（API 优先 + static fallback）
  useMeta();

  const handleOpenPrompt = useCallback(
    (prompt: Prompt) => {
      openDrawer(prompt);
    },
    [openDrawer],
  );

  // 2026-04-09 — P5 迁移：随机探索改用 Context 中的全局数据
  const handleRandomExplore = useCallback(() => {
    if (globalPrompts.length === 0) return;
    const random = globalPrompts[Math.floor(Math.random() * globalPrompts.length)];
    openDrawer(random);
    unlockAchievementAction('random_explore');
  }, [openDrawer, globalPrompts]);

  const onOpenCmdPalette = useCallback(() => {
    setCmdOpen(true);
    unlockAchievementAction('cmd_k');
  }, []);

  const ctx: LayoutContext = { darkMode, search, setSearch, onOpenCmdPalette };

  return (
    <div
      className={`relative flex h-screen flex-col overflow-hidden font-sans antialiased transition-colors duration-200 ${
        darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-[#f5f6fa] text-gray-900'
      }`}
    >
      {/* ── Global ambient background (Vercel / Linear) ── */}
      <AuroraOrbs darkMode={darkMode} />

      {/* ── Scroll progress bar (Linear / GitHub) ── */}
      <ScrollProgress />

      <Navbar
        darkMode={darkMode}
        onToggleDark={() => {
          setDarkMode(!darkMode);
          unlockAchievementAction('dark_mode');
        }}
        searchValue={search}
        onSearchChange={setSearch}
        onOpenCmdPalette={onOpenCmdPalette}
      />

      <PromptDataContext.Provider value={globalPrompts}>
        <DrawerContext.Provider value={{ openDrawer }}>
          <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 overflow-hidden">
            <Sidebar darkMode={darkMode} />
            <main id="main-scroll-container" className="custom-scrollbar min-w-0 flex-1 flex flex-col overflow-y-auto">
              <CrossProductGuide darkMode={darkMode} />
              <div className="flex-1 px-4 py-6 sm:px-6">
                <AnimatedOutlet ctx={ctx} />
              </div>
              <Footer darkMode={darkMode} />
            </main>
          </div>

          <FloatingActions darkMode={darkMode} />

          {/* Command Palette */}
          <CommandPalette
            open={cmdOpen}
            onClose={() => setCmdOpen(false)}
            darkMode={darkMode}
            onToggleDark={() => {
              setDarkMode(!darkMode);
              unlockAchievementAction('dark_mode');
            }}
            onOpenPrompt={handleOpenPrompt}
            onRandomExplore={handleRandomExplore}
          />
        </DrawerContext.Provider>
      </PromptDataContext.Provider>

      {/* Singleton PromptDetailDrawer — one instance for entire app */}
      {drawerPrompt && (
        <PromptDetailDrawer
          prompt={drawerPrompt}
          darkMode={darkMode}
          externalOpen={drawerOpen}
          onExternalOpenChange={(o) => {
            setDrawerOpen(o);
            if (!o) setDrawerPrompt(null);
          }}
        />
      )}

      <Toaster
        position="bottom-left"
        toastOptions={{
          style: {
            background: darkMode ? '#1f2937' : '#fff',
            color: darkMode ? '#f3f4f6' : '#111827',
            border: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
          },
        }}
      />

      <CustomCursor darkMode={darkMode} />
      <ParticleBurstRenderer />
    </div>
  );
}
