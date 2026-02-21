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
import { AuroraOrbs } from './AuroraOrbs';
import { Toaster } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import { MOCK_PROMPTS, type Prompt } from '../data/prompts';
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

  const handleOpenPrompt = useCallback((prompt: Prompt) => {
    openDrawer(prompt);
  }, [openDrawer]);

  const handleRandomExplore = useCallback(() => {
    const random = MOCK_PROMPTS[Math.floor(Math.random() * MOCK_PROMPTS.length)];
    openDrawer(random);
    unlockAchievementAction('random_explore');
  }, [openDrawer]);

  const onOpenCmdPalette = useCallback(() => {
    setCmdOpen(true);
    unlockAchievementAction('cmd_k');
  }, []);

  const ctx: LayoutContext = { darkMode, search, setSearch, onOpenCmdPalette };

  return (
    <div
      className={`relative flex min-h-screen flex-col font-sans antialiased transition-colors duration-200 ${
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

      <DrawerContext.Provider value={{ openDrawer }}>
        <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1">
          <Sidebar darkMode={darkMode} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
            <AnimatedOutlet ctx={ctx} />
          </main>
        </div>

        <Footer darkMode={darkMode} />
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
