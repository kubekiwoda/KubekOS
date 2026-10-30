/**
 * KubekOS Desktop Environment Surface — OBSIDIAN AURORA Edition
 * Integrates TopSystemPanel, interactive parallax wallpaper, dynamic ambient lighting,
 * workspace-aware window compositor, sculpted desktop icon tiles, and Floating Dock.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKernelStore } from '@/kernel/kernelStore';
import { useDesktopStore } from './desktopStore';
import { useWindowStore } from '@/wm/windowStore';
import { useNotificationStore } from '@/notifications/notificationStore';
import { ACCENT_COLORS, WALLPAPER_PRESETS, getMotionPreset } from '@/theme/tokens';
import { OsIcon } from '@/components/ui/OsIcon';
import { WindowFrame } from '@/wm/WindowFrame';
import { AppWindowHost } from '@/wm/AppWindowHost';
import { TopSystemPanel } from './TopSystemPanel';
import { Taskbar } from './Taskbar';
import { StartMenu } from './StartMenu';
import { CommandPalette } from './CommandPalette';
import { NotificationCenterDrawer } from './NotificationCenterDrawer';
import { DesktopWidgets } from './DesktopWidgets';
import { ContextMenu } from './ContextMenu';
import { AltTabSwitcher } from './AltTabSwitcher';
import type { DesktopShortcut } from '@/types/os';

const GRID_CELL_WIDTH = 96;
const GRID_CELL_HEIGHT = 100;
const GRID_PADDING_LEFT = 20;
const GRID_PADDING_TOP = 50;

export const DesktopEnvironment: React.FC = () => {
  const preferences = useKernelStore((s) => s.preferences);
  const updatePreferences = useKernelStore((s) => s.updatePreferences);

  const shortcuts = useDesktopStore((s) => s.shortcuts);
  const selectedShortcutId = useDesktopStore((s) => s.selectedShortcutId);
  const activeWorkspace = useDesktopStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useDesktopStore((s) => s.setActiveWorkspace);
  const selectShortcut = useDesktopStore((s) => s.selectShortcut);
  const moveShortcut = useDesktopStore((s) => s.moveShortcut);
  const resetShortcuts = useDesktopStore((s) => s.resetShortcuts);
  const setStartMenuOpen = useDesktopStore((s) => s.setStartMenuOpen);
  const toggleCommandPalette = useDesktopStore((s) => s.toggleCommandPalette);
  const setAltTabOpen = useDesktopStore((s) => s.setAltTabOpen);
  const openContextMenu = useDesktopStore((s) => s.openContextMenu);
  const closeContextMenu = useDesktopStore((s) => s.closeContextMenu);

  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const cycleFocusNext = useWindowStore((s) => s.cycleFocusNext);

  const setCenterOpen = useNotificationStore((s) => s.setCenterOpen);

  const wallpaper =
    WALLPAPER_PRESETS[preferences.wallpaperId] ?? WALLPAPER_PRESETS['nebula-dark'];
  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;
  const motionPreset = getMotionPreset(
    preferences.motionQuality,
    preferences.reducedMotion
  );

  const dragMovedRef = useRef(false);
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });

  // Global keyboard shortcuts (Ctrl+K Command Palette, Alt+Tab Switcher, Alt+1..4 Workspaces)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      } else if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        setAltTabOpen(true);
        cycleFocusNext();
      } else if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        setActiveWorkspace(Number(e.key));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltTabOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleCommandPalette, setAltTabOpen, cycleFocusNext, setActiveWorkspace]);

  const handleDesktopMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!motionPreset.enableParallax) return;
    const nx = (e.clientX / window.innerWidth - 0.5) * -18;
    const ny = (e.clientY / window.innerHeight - 0.5) * -18;
    setParallaxOffset({ x: nx, y: ny });
  };

  const handleDesktopPointerDown = () => {
    selectShortcut(null);
    setStartMenuOpen(false);
    setCenterOpen(false);
    closeContextMenu();
  };

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY, [
      {
        id: 'ctx-open-terminal',
        label: 'Open Terminal Here',
        icon: 'terminal',
        shortcut: 'Ctrl+`',
        onSelect: () => openWindow('terminal'),
      },
      {
        id: 'ctx-open-explorer',
        label: 'Open File Explorer',
        icon: 'folder',
        onSelect: () => openWindow('file-explorer'),
      },
      {
        id: 'ctx-command-palette',
        label: 'Obsidian Command Palette...',
        icon: 'sparkles',
        shortcut: 'Ctrl+K',
        separatorAfter: true,
        onSelect: () => toggleCommandPalette(),
      },
      {
        id: 'ctx-toggle-widgets',
        label: preferences.desktopShowWidgets
          ? 'Hide Telemetry Widgets'
          : 'Show Telemetry Widgets',
        icon: 'layers',
        onSelect: () =>
          updatePreferences({ desktopShowWidgets: !preferences.desktopShowWidgets }),
      },
      {
        id: 'ctx-reset-icons',
        label: 'Align & Reset Desktop Icons',
        icon: 'window',
        separatorAfter: true,
        onSelect: () => resetShortcuts(),
      },
      {
        id: 'ctx-personalize',
        label: 'Obsidian Aurora Settings',
        icon: 'settings',
        onSelect: () => openWindow('settings', { section: 'personalization' }),
      },
    ]);
  };

  const handleShortcutPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    shortcut: DesktopShortcut
  ) => {
    e.stopPropagation();
    selectShortcut(shortcut.id);
    closeContextMenu();
    dragMovedRef.current = false;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = GRID_PADDING_LEFT + shortcut.gridCol * GRID_CELL_WIDTH;
    const initialTop = GRID_PADDING_TOP + shortcut.gridRow * GRID_CELL_HEIGHT;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        dragMovedRef.current = true;
        const targetCol = Math.round(
          (initialLeft + dx - GRID_PADDING_LEFT) / GRID_CELL_WIDTH
        );
        const targetRow = Math.round(
          (initialTop + dy - GRID_PADDING_TOP) / GRID_CELL_HEIGHT
        );
        moveShortcut(shortcut.id, targetCol, targetRow);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleShortcutContextMenu = (
    e: React.MouseEvent,
    shortcut: DesktopShortcut
  ) => {
    e.preventDefault();
    e.stopPropagation();
    selectShortcut(shortcut.id);
    openContextMenu(e.clientX, e.clientY, [
      {
        id: 'open-shortcut',
        label: `Launch ${shortcut.label}`,
        icon: shortcut.icon,
        separatorAfter: true,
        onSelect: () => openWindow(shortcut.targetId),
      },
      {
        id: 'pin-shortcut',
        label: preferences.pinnedAppIds.includes(shortcut.targetId)
          ? 'Remove from Floating Dock'
          : 'Pin to Floating Dock',
        icon: 'window',
        onSelect: () => {
          const isPinned = preferences.pinnedAppIds.includes(shortcut.targetId);
          updatePreferences({
            pinnedAppIds: isPinned
              ? preferences.pinnedAppIds.filter((id) => id !== shortcut.targetId)
              : [...preferences.pinnedAppIds, shortcut.targetId],
          });
        },
      },
    ]);
  };

  const workspaceWindows = windows.filter(
    (w) => (w.workspaceId ?? 1) === activeWorkspace
  );

  return (
    <main
      data-testid="desktop-root"
      onMouseMove={handleDesktopMouseMove}
      onPointerDown={handleDesktopPointerDown}
      onContextMenu={handleDesktopContextMenu}
      className="relative w-screen h-screen overflow-hidden select-none text-slate-100 bg-[#03050a]"
    >
      {/* Parallax Wallpaper Canvas */}
      <motion.div
        animate={{
          x: motionPreset.enableParallax ? parallaxOffset.x : 0,
          y: motionPreset.enableParallax ? parallaxOffset.y : 0,
          scale: motionPreset.enableParallax ? 1.04 : 1,
        }}
        transition={{ type: 'spring', stiffness: 120, damping: 25 }}
        style={{ background: wallpaper.cssBackground }}
        className="fixed inset-0 pointer-events-none obsidian-grid-overlay"
      />

      {/* Ambient Aurora Radial Glow */}
      {motionPreset.enableAmbientGlow && (
        <div
          className={`fixed -bottom-36 left-1/2 -translate-x-1/2 w-[720px] h-72 rounded-full ${accent.bgClass} opacity-[0.08] blur-[110px] pointer-events-none`}
        />
      )}

      {/* Top System Panel */}
      <TopSystemPanel />

      {/* Desktop Icons Grid */}
      <div className="relative w-full h-[calc(100vh-88px)] z-10">
        {shortcuts.map((shortcut) => {
          const isSelected = selectedShortcutId === shortcut.id;
          const left = GRID_PADDING_LEFT + shortcut.gridCol * GRID_CELL_WIDTH;
          const top = GRID_PADDING_TOP + shortcut.gridRow * GRID_CELL_HEIGHT;

          return (
            <motion.div
              key={shortcut.id}
              role="button"
              tabIndex={0}
              data-testid={`desktop-icon-${shortcut.targetId}`}
              style={{ left, top, width: 88 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              onPointerDown={(e) => handleShortcutPointerDown(e, shortcut)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!dragMovedRef.current) {
                  openWindow(shortcut.targetId);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  openWindow(shortcut.targetId);
                }
              }}
              onContextMenu={(e) => handleShortcutContextMenu(e, shortcut)}
              className={`absolute flex flex-col items-center p-2 rounded-2xl transition-colors cursor-pointer group ${
                isSelected
                  ? `bg-white/[0.1] backdrop-blur-md ring-1 ${accent.ringClass}`
                  : 'hover:bg-white/[0.05]'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-1.5 shadow-xl transition-all group-hover:scale-105 bg-[#080d1a]/90 border ${
                  isSelected ? accent.borderClass : 'border-white/[0.1] group-hover:border-white/[0.22]'
                } ${accent.textClass}`}
              >
                <OsIcon name={shortcut.icon} className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-center text-slate-100 leading-tight line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {shortcut.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Desktop Telemetry Widgets */}
      <DesktopWidgets />

      {/* Spatial Workspace Window Layer */}
      <AnimatePresence mode="popLayout">
        {workspaceWindows.map((win) => (
          <WindowFrame key={win.id} windowInstance={win}>
            <AppWindowHost windowInstance={win} />
          </WindowFrame>
        ))}
      </AnimatePresence>

      {/* Overlays & Popovers */}
      <StartMenu />
      <NotificationCenterDrawer />
      <CommandPalette />
      <AltTabSwitcher />
      <ContextMenu />

      {/* Bottom Floating Obsidian Dock */}
      <Taskbar />
    </main>
  );
};
