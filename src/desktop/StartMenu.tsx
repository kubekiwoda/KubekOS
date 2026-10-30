/**
 * KubekOS Start Menu Component
 * Provides searchable application launcher, category filtering, pinned apps, and power controls.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  LogOut,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  Settings,
} from 'lucide-react';
import { useDesktopStore } from './desktopStore';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useWindowStore } from '@/wm/windowStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';
import { OsIcon } from '@/components/ui/OsIcon';
import type { AppCategory } from '@/types/os';

const CATEGORIES: { id: 'ALL' | AppCategory; label: string }[] = [
  { id: 'ALL', label: 'All Apps' },
  { id: 'SYSTEM', label: 'System' },
  { id: 'DEVELOPMENT', label: 'Dev' },
  { id: 'PRODUCTIVITY', label: 'Productivity' },
  { id: 'MEDIA', label: 'Media' },
  { id: 'INTERNET', label: 'Internet' },
  { id: 'UTILITIES', label: 'Utilities' },
];

export const StartMenu: React.FC = () => {
  const isOpen = useDesktopStore((s) => s.isStartMenuOpen);
  const setStartMenuOpen = useDesktopStore((s) => s.setStartMenuOpen);
  const manifestsMap = useAppRegistryStore((s) => s.manifests);
  const openWindow = useWindowStore((s) => s.openWindow);

  const activeUser = useKernelStore((s) => s.activeUser);
  const preferences = useKernelStore((s) => s.preferences);
  const updatePreferences = useKernelStore((s) => s.updatePreferences);
  const lockSession = useKernelStore((s) => s.lockSession);
  const logoutUser = useKernelStore((s) => s.logoutUser);
  const restartSystem = useKernelStore((s) => s.restartSystem);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | AppCategory>('ALL');

  const manifests = useMemo(() => Object.values(manifestsMap), [manifestsMap]);
  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;

  const filteredApps = useMemo(() => {
    return manifests.filter((app) => {
      const matchesCategory =
        selectedCategory === 'ALL' || app.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        app.name.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [manifests, selectedCategory, searchQuery]);

  const togglePinApp = (appId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isPinned = preferences.pinnedAppIds.includes(appId);
    const nextPinned = isPinned
      ? preferences.pinnedAppIds.filter((id) => id !== appId)
      : [...preferences.pinnedAppIds, appId];
    updatePreferences({ pinnedAppIds: nextPinned });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-testid="start-menu"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-2xl bg-[#070b16]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_28px_70px_rgba(0,0,0,0.92)] overflow-hidden flex flex-col select-none"
        >
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                data-testid="start-menu-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search applications, tools, or system settings..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                      active
                        ? `${accent.bgClass} text-slate-950`
                        : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Applications Grid */}
          <div className="p-4 max-h-[340px] overflow-y-auto grid grid-cols-3 gap-2.5">
            {filteredApps.map((app) => {
              const isPinned = preferences.pinnedAppIds.includes(app.id);
              return (
                <div
                  key={app.id}
                  data-testid={`start-menu-app-${app.id}`}
                  onClick={() => {
                    openWindow(app.id);
                    setStartMenuOpen(false);
                  }}
                  className="group relative flex flex-col items-start p-3 rounded-xl bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800/60 hover:border-slate-700 transition-all cursor-pointer"
                >
                  <div className="w-full flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-xl ${accent.subtleBgClass} ${accent.textClass}`}>
                      <OsIcon name={app.icon} className="w-5 h-5" />
                    </div>
                    <button
                      type="button"
                      title={isPinned ? 'Unpin from Taskbar' : 'Pin to Taskbar'}
                      onClick={(e) => togglePinApp(app.id, e)}
                      className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                        isPinned
                          ? 'text-cyan-400 opacity-100'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-xs font-medium text-slate-100 truncate max-w-full">
                    {app.name}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                    {app.description}
                  </div>
                </div>
              );
            })}
            {filteredApps.length === 0 && (
              <div className="col-span-3 py-8 text-center text-xs text-slate-400">
                No applications matched "{searchQuery}"
              </div>
            )}
          </div>

          {/* Bottom User Profile & Power Bar */}
          <div className="px-4 py-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 ${accent.bgClass}`}
              >
                {activeUser?.displayName.charAt(0) ?? 'K'}
              </div>
              <div>
                <div className="text-xs font-medium text-slate-100">
                  {activeUser?.displayName ?? 'Kubek Architect'}
                </div>
                <div className="text-[10px] text-slate-400">{activeUser?.title ?? 'Admin'}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="System Settings"
                onClick={() => {
                  openWindow('settings');
                  setStartMenuOpen(false);
                }}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Lock Session"
                onClick={() => {
                  setStartMenuOpen(false);
                  lockSession();
                }}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Reboot System"
                onClick={() => {
                  setStartMenuOpen(false);
                  restartSystem();
                }}
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Sign Out"
                onClick={() => {
                  setStartMenuOpen(false);
                  logoutUser();
                }}
                className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
