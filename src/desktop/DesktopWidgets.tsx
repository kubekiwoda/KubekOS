/**
 * KubekOS Desktop Widgets — OBSIDIAN AURORA Edition
 * Features sculptural radial telemetry rings, glowing glass surfaces,
 * active workspace indicator, and instant system launchers.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Clock, Cpu, HardDrive, Sparkles, Terminal } from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';
import { useWindowStore } from '@/wm/windowStore';
import { useVfsStore } from '@/vfs/vfsStore';
import { ACCENT_COLORS, DESIGN_TOKENS } from '@/theme/tokens';

export const DesktopWidgets: React.FC = () => {
  const showWidgets = useKernelStore((s) => s.preferences.desktopShowWidgets);
  const uptimeSeconds = useKernelStore((s) => s.uptimeSeconds);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const getStorageStats = useVfsStore((s) => s.getStorageStats);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!showWidgets) return null;

  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;
  const stats = getStorageStats();
  const minutes = Math.floor(uptimeSeconds / 60);
  const seconds = uptimeSeconds % 60;

  return (
    <motion.aside
      data-testid="desktop-widgets"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed top-14 right-5 z-10 w-80 space-y-3.5 pointer-events-auto select-none"
    >
      {/* Obsidian Chronometer Card */}
      <div className={`rounded-2xl ${DESIGN_TOKENS.glass.panel} p-5 shadow-2xl relative overflow-hidden`}>
        <div
          className={`absolute -top-12 -right-12 w-32 h-32 rounded-full ${accent.bgClass} opacity-10 blur-2xl pointer-events-none`}
        />
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider text-cyan-400">
            <Clock className="w-3.5 h-3.5" />
            Obsidian Chronometer
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-slate-300">
            SYNCED
          </span>
        </div>
        <div className="text-4xl font-extralight tracking-tight text-white font-mono">
          {now.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </div>
        <div className="text-xs text-slate-400 mt-1.5 font-medium">
          {now.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* Kernel & VFS Telemetry Card */}
      <div className={`rounded-2xl ${DESIGN_TOKENS.glass.panel} p-4 shadow-2xl space-y-3.5`}>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <Activity className={`w-3.5 h-3.5 ${accent.textClass}`} />
            Kernel Telemetry
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
            OPTIMAL
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-black/40 border border-white/[0.06] p-2.5">
            <div className="text-[9px] text-slate-400 uppercase font-mono">Tasks</div>
            <div className="text-base font-semibold text-white mt-0.5 font-mono">
              {windows.length}
            </div>
          </div>
          <div className="rounded-xl bg-black/40 border border-white/[0.06] p-2.5">
            <div className="text-[9px] text-slate-400 uppercase font-mono">VFS Nodes</div>
            <div className="text-base font-semibold text-cyan-400 mt-0.5 font-mono">
              {stats.totalFiles + stats.totalDirectories}
            </div>
          </div>
          <div className="rounded-xl bg-black/40 border border-white/[0.06] p-2.5">
            <div className="text-[9px] text-slate-400 uppercase font-mono">Uptime</div>
            <div className="text-sm font-semibold text-emerald-400 mt-1 font-mono">
              {minutes}m {seconds}s
            </div>
          </div>
        </div>

        {/* VFS Storage Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-cyan-400" /> IndexedDB VFS
            </span>
            <span>{(stats.usedBytes / 1024).toFixed(1)} KB used</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-black/50 overflow-hidden border border-white/[0.06]">
            <div
              className={`h-full ${accent.bgClass} rounded-full`}
              style={{ width: `${Math.min(100, Math.max(8, (stats.usedBytes / 32768) * 100))}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.07] text-[11px] text-slate-300">
          <button
            type="button"
            onClick={() => openWindow('system-monitor')}
            className="flex items-center gap-1.5 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>System Monitor</span>
          </button>
          <button
            type="button"
            onClick={() => openWindow('terminal')}
            className="flex items-center gap-1.5 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Launch Shell</span>
          </button>
        </div>
      </div>

      {/* Quick Spotlight Hint */}
      <div className={`rounded-xl ${DESIGN_TOKENS.glass.panel} px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-300`}>
        <span className="flex items-center gap-2">
          <Sparkles className={`w-3.5 h-3.5 ${accent.textClass}`} />
          <span>Global Spotlight Launcher</span>
        </span>
        <kbd className="px-2 py-0.5 rounded bg-black/50 border border-white/10 font-mono text-[10px] text-cyan-300">
          Ctrl + K
        </kbd>
      </div>
    </motion.aside>
  );
};
