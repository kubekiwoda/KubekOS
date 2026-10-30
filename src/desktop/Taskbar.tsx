/**
 * KubekOS Floating Obsidian Dock (Taskbar)
 * Features proximity-based spring magnification, glowing active process indicators,
 * animated launch bounce feedback, and instant Start Menu access.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Sparkles } from 'lucide-react';
import { useDesktopStore } from './desktopStore';
import { useWindowStore } from '@/wm/windowStore';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS, DESIGN_TOKENS, getMotionPreset } from '@/theme/tokens';
import { OsIcon } from '@/components/ui/OsIcon';

export const Taskbar: React.FC = () => {
  const toggleStartMenu = useDesktopStore((s) => s.toggleStartMenu);
  const isStartMenuOpen = useDesktopStore((s) => s.isStartMenuOpen);
  const activeWorkspace = useDesktopStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useDesktopStore((s) => s.setActiveWorkspace);

  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const toggleMinimizeOrFocus = useWindowStore((s) => s.toggleMinimizeOrFocus);

  const manifests = useAppRegistryStore((s) => s.manifests);
  const preferences = useKernelStore((s) => s.preferences);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null);

  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;
  const motionPreset = getMotionPreset(
    preferences.motionQuality,
    preferences.reducedMotion
  );

  const dockAppIds = useMemo(() => {
    const set = new Set<string>(preferences.pinnedAppIds);
    for (const w of windows) {
      set.add(w.appId);
    }
    return Array.from(set);
  }, [preferences.pinnedAppIds, windows]);

  const handleDockAppClick = (appId: string) => {
    const appWindows = windows.filter((w) => w.appId === appId);
    if (appWindows.length === 0) {
      setLaunchingAppId(appId);
      setTimeout(() => setLaunchingAppId(null), 500);
      openWindow(appId);
    } else {
      const topWindow = [...appWindows].sort((a, b) => b.zIndex - a.zIndex)[0];
      if (topWindow) {
        if (topWindow.workspaceId !== activeWorkspace) {
          setActiveWorkspace(topWindow.workspaceId);
        }
        toggleMinimizeOrFocus(topWindow.id);
      }
    }
  };

  const computeScale = (index: number): number => {
    if (!motionPreset.enableDockMagnification || hoveredIndex === null) return 1;
    const distance = Math.abs(hoveredIndex - index);
    if (distance === 0) return 1.32;
    if (distance === 1) return 1.15;
    if (distance === 2) return 1.05;
    return 1;
  };

  return (
    <footer
      data-testid="taskbar"
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 select-none pointer-events-auto"
    >
      <motion.div
        layout
        transition={motionPreset.dockMagnifySpring}
        onMouseLeave={() => setHoveredIndex(null)}
        className={`flex items-center gap-2 px-3.5 py-2 ${DESIGN_TOKENS.radius.dock} ${DESIGN_TOKENS.glass.dock}`}
      >
        {/* Start Menu Launcher Button */}
        <motion.button
          type="button"
          data-testid="start-button"
          whileHover={{ scale: motionPreset.enableDockMagnification ? 1.12 : 1.03 }}
          whileTap={{ scale: 0.94 }}
          onClick={toggleStartMenu}
          title="Open Application Launcher"
          className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
            isStartMenuOpen
              ? `${accent.bgClass} text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.65)]`
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.1]'
          }`}
        >
          <Sparkles className="w-5 h-5" />
        </motion.button>

        {/* Subtle Vertical Divider */}
        <div className="h-7 w-px bg-white/[0.1] mx-0.5" />

        {/* Dock Application Icons with Dynamic Magnification */}
        <div className="flex items-center gap-2">
          {dockAppIds.map((appId, idx) => {
            const manifest = manifests[appId];
            if (!manifest) return null;

            const appWindows = windows.filter((w) => w.appId === appId);
            const isRunning = appWindows.length > 0;
            const isFocused = appWindows.some(
              (w) => w.isFocused && w.mode !== 'MINIMIZED' && w.workspaceId === activeWorkspace
            );
            const isLaunching = launchingAppId === appId;
            const scale = computeScale(idx);

            return (
              <div
                key={appId}
                className="relative flex flex-col items-center"
                onMouseEnter={() => setHoveredIndex(idx)}
              >
                {/* Floating Tooltip */}
                <AnimatePresence>
                  {hoveredIndex === idx && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.9 }}
                      animate={{ opacity: 1, y: -10, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.9 }}
                      transition={{ duration: 0.12 }}
                      className="absolute -top-8 px-2.5 py-1 rounded-lg bg-[#050811]/95 border border-white/15 text-[11px] font-medium text-white whitespace-nowrap shadow-xl pointer-events-none"
                    >
                      {manifest.name}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="button"
                  data-testid={`taskbar-app-${appId}`}
                  animate={{
                    scale,
                    y: isLaunching ? -12 : hoveredIndex === idx && motionPreset.enableDockMagnification ? -5 : 0,
                  }}
                  transition={motionPreset.dockMagnifySpring}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDockAppClick(appId)}
                  className={`relative w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                    isFocused
                      ? `${accent.subtleBgClass} ${accent.textClass} border ${accent.borderClass} shadow-[0_0_20px_rgba(6,182,212,0.28)]`
                      : isRunning
                        ? 'bg-white/[0.07] text-slate-100 border border-white/[0.12] hover:bg-white/[0.12]'
                        : 'bg-white/[0.03] text-slate-300 border border-white/[0.06] hover:bg-white/[0.09] hover:text-white'
                  }`}
                >
                  <OsIcon name={manifest.icon} className="w-5 h-5" />
                </motion.button>

                {/* Active / Focused Glowing Indicator Pill */}
                {isRunning && (
                  <motion.span
                    layoutId={`dock-indicator-${appId}`}
                    className={`mt-1 h-1 rounded-full transition-all ${
                      isFocused
                        ? `w-5 ${accent.bgClass} shadow-[0_0_10px_#06b6d4]`
                        : 'w-1.5 bg-slate-400/80'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="h-7 w-px bg-white/[0.1] mx-0.5" />

        {/* Quick App Center Button */}
        <motion.button
          type="button"
          whileHover={{ scale: motionPreset.enableDockMagnification ? 1.12 : 1.03 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => openWindow('app-store')}
          title="App & Plugin Center"
          className="w-11 h-11 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
        >
          <LayoutGrid className="w-5 h-5" />
        </motion.button>
      </motion.div>
    </footer>
  );
};
