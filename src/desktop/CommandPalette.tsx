/**
 * KubekOS Global Command Palette (Ctrl + K)
 * Searches installed applications, system commands, settings sections, and VFS nodes.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Command, Search } from 'lucide-react';
import { useDesktopStore } from './desktopStore';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useWindowStore } from '@/wm/windowStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { useVfsStore } from '@/vfs/vfsStore';
import { ACCENT_COLORS } from '@/theme/tokens';
import { OsIcon } from '@/components/ui/OsIcon';

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'APPLICATION' | 'FILE' | 'COMMAND' | 'SETTINGS';
  icon: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const isOpen = useDesktopStore((s) => s.isCommandPaletteOpen);
  const setCommandPaletteOpen = useDesktopStore((s) => s.setCommandPaletteOpen);
  const manifestsMap = useAppRegistryStore((s) => s.manifests);
  const vfsNodesMap = useVfsStore((s) => s.nodes);
  const openWindow = useWindowStore((s) => s.openWindow);
  const closeAllWindows = useWindowStore((s) => s.closeAllWindows);

  const preferences = useKernelStore((s) => s.preferences);
  const setThemeMode = useKernelStore((s) => s.setThemeMode);
  const lockSession = useKernelStore((s) => s.lockSession);
  const restartSystem = useKernelStore((s) => s.restartSystem);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;

  const allItems = useMemo<PaletteItem[]>(() => {
    const appItems: PaletteItem[] = Object.values(manifestsMap).map((app) => ({
      id: `app-${app.id}`,
      title: app.name,
      subtitle: app.description,
      category: 'APPLICATION',
      icon: app.icon,
      action: () => openWindow(app.id),
    }));

    const commandItems: PaletteItem[] = [
      {
        id: 'cmd-toggle-theme',
        title: `Switch to ${preferences.themeMode === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: 'System Theme Engine Command',
        category: 'COMMAND',
        icon: 'sparkles',
        action: () => setThemeMode(preferences.themeMode === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'cmd-close-all-windows',
        title: 'Close All Open Windows',
        subtitle: 'Window Manager Action',
        category: 'COMMAND',
        icon: 'window',
        action: () => closeAllWindows(),
      },
      {
        id: 'cmd-lock-session',
        title: 'Lock Workspace Session',
        subtitle: 'Security & User Session',
        category: 'COMMAND',
        icon: 'shield',
        action: () => lockSession(),
      },
      {
        id: 'cmd-reboot-kernel',
        title: 'Reboot KubekOS Kernel',
        subtitle: 'System Power Action',
        category: 'COMMAND',
        icon: 'cpu',
        action: () => restartSystem(),
      },
      {
        id: 'settings-wallpaper',
        title: 'Settings: Change Wallpaper & Personalization',
        subtitle: 'Open Personalization Settings',
        category: 'SETTINGS',
        icon: 'settings',
        action: () => openWindow('settings', { section: 'personalization' }),
      },
      {
        id: 'settings-storage',
        title: 'Settings: Storage & Virtual Filesystem Quota',
        subtitle: 'Inspect IndexedDB VFS metrics',
        category: 'SETTINGS',
        icon: 'drive',
        action: () => openWindow('settings', { section: 'storage' }),
      },
    ];

    const fileItems: PaletteItem[] = Object.values(vfsNodesMap)
      .filter((node) => !node.isTrashed && node.path !== '/KubekOS')
      .map((node) => ({
        id: `vfs-${node.path}`,
        title: node.name,
        subtitle: node.path,
        category: 'FILE',
        icon: node.type === 'DIRECTORY' ? 'folder' : 'file-text',
        action: () => {
          if (node.type === 'DIRECTORY') {
            openWindow('file-explorer', { filePath: node.path });
          } else {
            openWindow('code-editor', { filePath: node.path });
          }
        },
      }));

    return [...appItems, ...commandItems, ...fileItems];
  }, [manifestsMap, vfsNodesMap, openWindow, preferences.themeMode, setThemeMode, closeAllWindows, lockSession, restartSystem]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 10);
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandPaletteOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
        setCommandPaletteOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, setCommandPaletteOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-testid="command-palette-backdrop"
          onPointerDown={() => setCommandPaletteOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-24 p-4 select-none"
        >
          <motion.div
            data-testid="command-palette"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.14 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 shadow-2xl overflow-hidden"
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3">
              <Search className={`w-4 h-4 ${accent.textClass}`} />
              <input
                type="text"
                autoFocus
                data-testid="command-palette-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command, application name, or setting..."
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              <kbd className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filtered.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`palette-item-${item.id}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => {
                      item.action();
                      setCommandPaletteOpen(false);
                      setQuery('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? `${accent.subtleBgClass} text-white`
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg bg-slate-800/90 ${accent.textClass}`}>
                        <OsIcon name={item.icon} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {item.category}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="py-10 text-center text-xs text-slate-400">
                  No matching applications, files, or commands found.
                </div>
              )}
            </div>

            {/* Footer Hints */}
            <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Command className="w-3 h-3" /> Use ↑↓ arrows to navigate
                </span>
                <span>↵ Enter to launch</span>
              </div>
              <span className="font-mono text-[10px]">KubekOS Spotlight</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
