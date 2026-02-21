import { createContext, useContext } from 'react';
import type { Prompt } from '../data/prompts';

interface DrawerContextValue {
  openDrawer: (prompt: Prompt) => void;
}

export const DrawerContext = createContext<DrawerContextValue | null>(null);

/** Open the singleton PromptDetailDrawer from anywhere in the component tree */
export function useOpenDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useOpenDrawer must be used inside DrawerProvider');
  return ctx.openDrawer;
}
