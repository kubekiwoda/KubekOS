/**
 * KubekOS Alt+Tab Window Switcher Modal
 * Allows rapid keyboard-driven window switching across active applications.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDesktopStore } from './desktopStore';
import { useWindowStore } from '@/wm/windowStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';
import { OsIcon } from '@/components/ui/OsIcon';

export const AltTabSwitcher: React.FC = () => {
  const isOpen = useDesktopStore((s) => s.isAltTabOpen);
  const setAltTabOpen = useDesktopStore((s) => s.setAltTabOpen);
  const windows = useWindowStore((s) => s.windows);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const sortedWindows = [...windows].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <AnimatePresence>
      {isOpen && sortedWindows.length > 0 && (
        <div
          onPointerDown={() => setAltTabOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs select-none"
        >
          <motion.div
            data-testid="alt-tab-switcher"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 shadow-2xl p-5 max-w-2xl"
          >
            <div className="text-xs font-mono uppercase text-slate-400 mb-3 text-center">
              Active Windows • Click or press Alt+Tab to cycle
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {sortedWindows.map((win) => (
                <button
                  key={win.id}
                  type="button"
                  onClick={() => {
                    focusWindow(win.id);
                    setAltTabOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center w-32 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    win.isFocused
                      ? `${accent.subtleBgClass} ${accent.borderClass} ring-2 ${accent.ringClass}`
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/80'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl bg-slate-800/90 ${accent.textClass} mb-2`}>
                    <OsIcon name={win.icon} className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium text-white truncate max-w-full">
                    {win.title}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase mt-0.5">
                    {win.mode}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
