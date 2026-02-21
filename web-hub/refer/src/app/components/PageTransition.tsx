/**
 * PageTransition — route-level fade+slide transition.
 * Inspired by: Framer.com, Linear.app, Craft.do
 */
import { useLocation, Outlet, useOutletContext } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';

export function PageTransition() {
  const location = useLocation();
  const ctx = useOutletContext();

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
