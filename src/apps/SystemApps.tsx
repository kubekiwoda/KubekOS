/**
 * KubekOS System Monitor, Task Manager, Image Viewer, App Center, and About Applications
 * Provides genuine browser telemetry, kernel log inspection, SVG/image rendering,
 * and sandboxed plugin installation.
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  HardDrive,
  Info,
  Package,
  PlusCircle,
  Shield,
  Trash2,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';
import { kernelLogger } from '@/kernel/logger';
import { useVfsStore } from '@/vfs/vfsStore';
import { useWindowStore } from '@/wm/windowStore';
import { useAppRegistryStore } from '@/apps/appRegistry';
import {
  getVerifiedCatalogPlugins,
  installCatalogPlugin,
  uninstallCatalogPlugin,
} from '@/plugins/pluginManager';
import { ACCENT_COLORS } from '@/theme/tokens';
import { OsIcon } from '@/components/ui/OsIcon';
import type { LogEntry } from '@/types/os';

// ============================================================================
// SYSTEM MONITOR APPLICATION
// ============================================================================

export const SystemMonitorApp: React.FC = () => {
  const uptimeSeconds = useKernelStore((s) => s.uptimeSeconds);
  const activeUser = useKernelStore((s) => s.activeUser);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const windows = useWindowStore((s) => s.windows);
  const getStorageStats = useVfsStore((s) => s.getStorageStats);
  const stats = getStorageStats();

  const [logs, setLogs] = useState<readonly LogEntry[]>(() => kernelLogger.getEntries());

  useEffect(() => {
    return kernelLogger.subscribe((updated) => setLogs(updated));
  }, []);

  const navConcurrency =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? `${navigator.hardwareConcurrency} Logical Cores`
      : 'Browser Sandbox Threads';

  return (
    <div data-testid="app-system-monitor" className="h-full flex flex-col p-5 gap-4 text-xs select-none">
      {/* Top Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono uppercase">
            <Activity className={`w-3.5 h-3.5 ${accent.textClass}`} />
            <span>Running Windows</span>
          </div>
          <div className="text-2xl font-semibold text-white mt-1">{windows.length}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono uppercase">
            <HardDrive className={`w-3.5 h-3.5 ${accent.textClass}`} />
            <span>VFS Used Storage</span>
          </div>
          <div className="text-2xl font-semibold text-white mt-1">
            {(stats.usedBytes / 1024).toFixed(2)} KB
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono uppercase">
            <Cpu className={`w-3.5 h-3.5 ${accent.textClass}`} />
            <span>Host Concurrency</span>
          </div>
          <div className="text-sm font-semibold text-white mt-2 truncate">
            {navConcurrency}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-slate-400 text-[10px] font-mono uppercase">
            Session Uptime
          </div>
          <div className="text-xl font-semibold font-mono text-emerald-400 mt-1">
            {Math.floor(uptimeSeconds / 60)}m {uptimeSeconds % 60}s
          </div>
          <div className="text-[10px] text-slate-400">
            User: {activeUser?.username ?? 'kubek'}
          </div>
        </div>
      </div>

      {/* Live Kernel Event & Diagnostic Log Stream */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
        <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <span className="font-semibold text-white">
            Kernel Diagnostic Log Stream ({logs.length} entries)
          </span>
          <button
            type="button"
            onClick={() => kernelLogger.clear()}
            className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
          >
            Clear Buffer
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5">
          {[...logs].reverse().map((entry) => (
            <div key={entry.id} className="flex items-start gap-2">
              <span className="text-slate-500 shrink-0">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`px-1.5 rounded text-[10px] shrink-0 ${
                  entry.level === 'ERROR' || entry.level === 'FATAL'
                    ? 'bg-rose-500/20 text-rose-300'
                    : entry.level === 'WARN'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-cyan-300'
                }`}
              >
                {entry.subsystem}
              </span>
              <span className="text-slate-200 break-all">{entry.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TASK MANAGER APPLICATION
// ============================================================================

export const TaskManagerApp: React.FC = () => {
  const windows = useWindowStore((s) => s.windows);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  return (
    <div data-testid="app-task-manager" className="h-full flex flex-col p-5 gap-4 text-xs select-none">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Active Application Processes ({windows.length})
          </h3>
          <p className="text-slate-400">
            Inspect running window instances, z-index priority, and terminate tasks.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/50">
        {windows.map((w) => (
          <div key={w.id} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-slate-800 ${accent.textClass}`}>
                <OsIcon name={w.icon} className="w-4 h-4" />
              </div>
              <div>
                <div className="font-medium text-white">{w.title}</div>
                <div className="text-[10px] font-mono text-slate-400">
                  Instance: {w.id} • Mode: {w.mode} • Z-Index: {w.zIndex}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => focusWindow(w.id)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                Bring to Front
              </button>
              <button
                type="button"
                onClick={() => closeWindow(w.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>End Task</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// IMAGE VIEWER APPLICATION
// ============================================================================

export const ImageViewerApp: React.FC<{ initialFilePath?: string }> = ({
  initialFilePath,
}) => {
  const nodesMap = useVfsStore((s) => s.nodes);
  const imageFiles = Object.values(nodesMap).filter(
    (n) => !n.isTrashed && n.type === 'FILE' && n.mimeType?.startsWith('image/')
  );

  const [selectedPath, setSelectedPath] = useState<string>(
    initialFilePath ?? imageFiles[0]?.path ?? '/KubekOS/Pictures/KubekOS_Emblem.svg'
  );
  const [zoom, setZoom] = useState(1);

  const activeNode = nodesMap[selectedPath] ?? imageFiles[0];

  const dataUri = React.useMemo(() => {
    if (!activeNode?.content) return '';
    if (activeNode.content.startsWith('data:')) return activeNode.content;
    if (activeNode.mimeType === 'image/svg+xml') {
      return `data:image/svg+xml;utf8,${encodeURIComponent(activeNode.content)}`;
    }
    return '';
  }, [activeNode]);

  return (
    <div data-testid="app-image-viewer" className="h-full flex flex-col text-xs select-none">
      <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {imageFiles.map((img) => (
            <button
              key={img.path}
              type="button"
              onClick={() => {
                setSelectedPath(img.path);
                setZoom(1);
              }}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                activeNode?.path === img.path
                  ? 'bg-cyan-500 text-slate-950 font-medium'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {img.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] px-2">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-950 flex items-center justify-center overflow-auto p-6">
        {dataUri ? (
          <img
            src={dataUri}
            alt={activeNode?.name ?? 'Preview'}
            style={{ transform: `scale(${zoom})` }}
            className="transition-transform duration-150 max-w-full max-h-full rounded-xl shadow-2xl"
          />
        ) : (
          <div className="text-slate-500">No image files found in /KubekOS/Pictures.</div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// APP STORE / PLUGIN CENTER APPLICATION
// ============================================================================

export const AppStoreApp: React.FC = () => {
  const manifestsMap = useAppRegistryStore((s) => s.manifests);
  const openWindow = useWindowStore((s) => s.openWindow);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const catalogPlugins = getVerifiedCatalogPlugins();

  return (
    <div data-testid="app-store" className="h-full flex flex-col p-6 gap-6 overflow-y-auto text-xs select-none">
      <div>
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Package className={`w-5 h-5 ${accent.textClass}`} />
          <span>KubekOS Application & Plugin Center</span>
        </h2>
        <p className="text-slate-400 mt-0.5">
          Install verified sandboxed plugins or launch built-in system applications. Each plugin runs with restricted ControlledPluginApi permissions.
        </p>
      </div>

      {/* Installable Verified Plugins */}
      <div className="space-y-3">
        <div className="text-[11px] font-mono uppercase text-cyan-400">
          Verified Sandboxed Plugins
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {catalogPlugins.map(({ manifest }) => {
            const isInstalled = Boolean(manifestsMap[manifest.id]);
            return (
              <div
                key={manifest.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white">
                      {manifest.name}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      v{manifest.version}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">{manifest.description}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {manifest.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                  {isInstalled ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openWindow(manifest.id)}
                        className={`px-3 py-1.5 rounded-lg ${accent.bgClass} text-slate-950 font-semibold cursor-pointer`}
                      >
                        Open Plugin
                      </button>
                      <button
                        type="button"
                        onClick={() => uninstallCatalogPlugin(manifest.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Uninstall</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      data-testid={`install-plugin-${manifest.id}`}
                      onClick={() => installCatalogPlugin(manifest.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Install Plugin</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Built-in System Applications */}
      <div className="space-y-3">
        <div className="text-[11px] font-mono uppercase text-slate-400">
          Built-in Core Applications ({Object.values(manifestsMap).filter((m) => m.isBuiltIn).length})
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {Object.values(manifestsMap)
            .filter((m) => m.isBuiltIn)
            .map((app) => (
              <div
                key={app.id}
                className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <OsIcon name={app.icon} className={`w-4 h-4 shrink-0 ${accent.textClass}`} />
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{app.name}</div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Installed
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openWindow(app.id)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  Open
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ABOUT KUBEKOS APPLICATION
// ============================================================================

export const AboutKubekOsApp: React.FC = () => {
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  return (
    <div data-testid="app-about" className="h-full flex flex-col justify-between p-6 text-xs select-none">
      <div className="space-y-4">
        <div className="flex items-center gap-3.5">
          <div className={`p-3.5 rounded-2xl ${accent.subtleBgClass} ${accent.textClass} border ${accent.borderClass}`}>
            <Info className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">KubekOS v1.0.0</h1>
            <p className="text-slate-400">
              Modular Browser-Based Operating System Simulation
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-2 leading-relaxed text-slate-300">
          <p>
            Engineered with React 19, TypeScript (Strict Mode), Vite, Tailwind CSS, Zustand, Framer Motion, and Dexie.js IndexedDB persistence.
          </p>
          <div className="flex items-center gap-2 text-emerald-400 font-medium pt-1">
            <Shield className="w-4 h-4" />
            <span>Sandboxed Virtual Filesystem & Controlled Plugin Runtime</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 font-mono text-[11px]">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400">Kernel:</span>{' '}
            <span className="text-white">v1.0.0-web</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400">VFS Engine:</span>{' '}
            <span className="text-white">IndexedDB (Dexie 4)</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800 text-center text-[11px] text-slate-500">
        © {new Date().getFullYear()} KubekOS Open-Source Project
      </div>
    </div>
  );
};
