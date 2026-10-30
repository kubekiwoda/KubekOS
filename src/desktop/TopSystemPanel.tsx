/**
 * KubekOS Top System Panel — OBSIDIAN AURORA Edition
 * Inspired by Hyprland Waybar & KDE Plasma 6 top bar:
 * Houses workspace switcher (1-4), active window title pill, Command Palette trigger,
 * live system telemetry, and Notification Center / Quick Settings trigger.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Bell,
  Command,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useDesktopStore } from './desktopStore';
import { useWindowStore } from '@/wm/windowStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { useNotificationStore } from '@/notifications/notificationStore';
import { ACCENT_COLORS, DESIGN_TOKENS, getMotionPreset } from '@/theme/tokens';
import { OsIcon } from '@/components/ui/OsIcon';

const WORKSPACES = [
  { id: 1, label: 'I', tag: 'CORE' },
  { id: 2, label: 'II', tag: 'DEV' },
  { id: 3, label: 'III', tag: 'MEDIA' },
  { id: 4, label: 'IV', tag: 'SYS' },
];

export const TopSystemPanel: React.FC = () => {
  const activeWorkspace = useDesktopStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useDesktopStore((s) => s.setActiveWorkspace);
  const toggleStartMenu = useDesktopStore((s) => s.toggleStartMenu);
  const isStartMenuOpen = useDesktopStore((s) => s.isStartMenuOpen);
  const toggleCommandPalette = useDesktopStore((s) => s.toggleCommandPalette);

  const windows = useWindowStore((s) => s.windows);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);
  const openWindow = useWindowStore((s) => s.openWindow);

  const preferences = useKernelStore((s) => s.preferences);
  const notifications = useNotificationStore((s) => s.notifications);
  const toggleCenter = useNotificationStore((s) => s.toggleCenter);
  const isCenterOpen = useNotificationStore((s) => s.isCenterOpen);

  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;
  const motionPreset = getMotionPreset(
    preferences.motionQuality,
    preferences.reducedMotion
  );

  const focusedWindow = windows.find(
    (w) => w.id === activeWindowId && w.mode !== 'MINIMIZED'
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header
      data-testid="top-system-panel"
      onPointerDown={(e) => e.stopPropagation()}
      className={`fixed top-0 left-0 right-0 h-9 z-40 px-3 ${DESIGN_TOKENS.glass.panel} flex items-center justify-between text-xs select-none`}
    >
      {/* Left Cluster: Launcher Pill + Hyprland-style Spatial Workspaces */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleStartMenu}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-[11px] tracking-wide transition-all cursor-pointer ${
            isStartMenuOpen
              ? `${accent.bgClass} text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.5)]`
              : 'bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>KUBEK</span>
        </button>

        {/* Virtual Workspaces Switcher (1-4) */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/[0.06]">
          {WORKSPACES.map((ws) => {
            const isActive = activeWorkspace === ws.id;
            const hasWindows = windows.some((w) => w.workspaceId === ws.id);

            return (
              <button
                key={ws.id}
                type="button"
                data-testid={`workspace-btn-${ws.id}`}
                onClick={() => setActiveWorkspace(ws.id)}
                className={`relative px-2.5 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                  isActive
                    ? 'text-slate-950 font-bold'
                    : hasWindows
                      ? 'text-cyan-300 hover:text-white'
                      : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-workspace-pill"
                    transition={motionPreset.workspaceSlideSpring}
                    className={`absolute inset-0 rounded-md ${accent.bgClass}`}
                  />
                )}
                <span className="relative z-10">{ws.label}</span>
                {hasWindows && !isActive && (
                  <span className={`relative z-10 w-1 h-1 rounded-full ${accent.bgClass}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Focused Window Breadcrumb */}
        {focusedWindow && (
          <motion.div
            key={focusedWindow.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-slate-200"
          >
            <OsIcon name={focusedWindow.icon} className={`w-3.5 h-3.5 ${accent.textClass}`} />
            <span className="font-medium truncate max-w-[200px]">{focusedWindow.title}</span>
          </motion.div>
        )}
      </div>

      {/* Center Cluster: Global Spotlight Command Palette Trigger */}
      <button
        type="button"
        data-testid="command-palette-trigger"
        onClick={toggleCommandPalette}
        className="flex items-center gap-2.5 px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer group"
      >
        <Search className={`w-3.5 h-3.5 ${accent.textClass} group-hover:scale-110 transition-transform`} />
        <span className="hidden sm:inline text-slate-400 group-hover:text-slate-200">
          Obsidian Command & Search
        </span>
        <kbd className="flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-black/50 border border-white/10 font-mono text-[9px] text-cyan-300">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* Right Cluster: Telemetry Pill, Audio, Notifications & Clock */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => openWindow('system-monitor')}
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-mono text-slate-300 cursor-pointer"
          title="Open System Monitor"
        >
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>{windows.length} PROCS</span>
        </button>

        <button
          type="button"
          data-testid="notification-center-trigger"
          onClick={toggleCenter}
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
            isCenterOpen
              ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
              : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-slate-200'
          }`}
        >
          {preferences.soundEffectsEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-slate-300" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
          )}

          <div className="relative">
            <Bell className="w-3.5 h-3.5 text-slate-200" />
            {unreadCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${accent.bgClass} animate-pulse`}
              />
            )}
          </div>

          <span className="font-mono font-medium text-white pl-1 border-l border-white/10">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </button>
      </div>
    </header>
  );
};
