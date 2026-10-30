/**
 * KubekOS Controlled Plugin Architecture & Sandbox API
 * Enforces explicit permission checks for third-party / plugin applications.
 * Never uses eval() or unrestricted Function execution.
 */

import React from 'react';
import type {
  AppPermission,
  ApplicationManifest,
  VfsNode,
} from '@/types/os';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useVfsStore } from '@/vfs/vfsStore';
import { useNotificationStore } from '@/notifications/notificationStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { kernelLogger } from '@/kernel/logger';

export interface ControlledPluginApi {
  readonly appId: string;
  readonly permissions: readonly AppPermission[];
  hasPermission: (perm: AppPermission) => boolean;
  vfs: {
    readFile: (path: string) => string | undefined;
    listDirectory: (path: string) => VfsNode[];
    writeFile: (path: string, content: string) => Promise<VfsNode>;
  };
  notifications: {
    send: (title: string, message: string) => void;
  };
  system: {
    getUptimeSeconds: () => number;
  };
}

export function createControlledPluginApi(manifest: ApplicationManifest): ControlledPluginApi {
  const permSet = new Set<AppPermission>(manifest.permissions);

  const assertPermission = (required: AppPermission) => {
    if (!permSet.has(required)) {
      kernelLogger.warn(
        'PLUGIN_API',
        `Permission denied: Plugin "${manifest.id}" attempted "${required}" without declaration.`
      );
      throw new Error(
        `Permission Denied: Application "${manifest.name}" lacks "${required}" permission.`
      );
    }
  };

  return {
    appId: manifest.id,
    permissions: Object.freeze([...manifest.permissions]),
    hasPermission: (perm) => permSet.has(perm),

    vfs: {
      readFile: (path: string) => {
        assertPermission('vfs.read');
        const node = useVfsStore.getState().getNode(path);
        if (!node || node.type !== 'FILE') return undefined;
        return node.content;
      },
      listDirectory: (path: string) => {
        assertPermission('vfs.read');
        return useVfsStore.getState().listDirectory(path);
      },
      writeFile: async (path: string, content: string) => {
        assertPermission('vfs.write');
        if (path.startsWith('/KubekOS/System') && !permSet.has('vfs.system')) {
          throw new Error('Permission Denied: Writing to /KubekOS/System requires "vfs.system".');
        }
        return useVfsStore.getState().writeFile(path, content);
      },
    },

    notifications: {
      send: (title: string, message: string) => {
        assertPermission('notifications.send');
        useNotificationStore.getState().pushNotification({
          title: `[${manifest.name}] ${title}`,
          message,
          sourceAppId: manifest.id,
        });
      },
    },

    system: {
      getUptimeSeconds: () => {
        assertPermission('system.metrics');
        return useKernelStore.getState().uptimeSeconds;
      },
    },
  };
}

export interface VerifiedPluginPackage {
  manifest: ApplicationManifest;
  renderComponent: React.FC<{ api: ControlledPluginApi }>;
}

const verifiedCatalog = new Map<string, VerifiedPluginPackage>();

export function registerVerifiedPluginInCatalog(pkg: VerifiedPluginPackage): void {
  verifiedCatalog.set(pkg.manifest.id, pkg);
}

export function getVerifiedCatalogPlugins(): VerifiedPluginPackage[] {
  return Array.from(verifiedCatalog.values());
}

export function getVerifiedPluginById(appId: string): VerifiedPluginPackage | undefined {
  return verifiedCatalog.get(appId);
}

export function installCatalogPlugin(appId: string): boolean {
  const pkg = verifiedCatalog.get(appId);
  if (!pkg) return false;
  useAppRegistryStore.getState().registerPluginApp(pkg.manifest);
  return true;
}

export function uninstallCatalogPlugin(appId: string): void {
  useAppRegistryStore.getState().unregisterPluginApp(appId);
}

// Register 3 built-in verified installable plugins for the App Store
registerVerifiedPluginInCatalog({
  manifest: {
    id: 'plugin-pomodoro',
    name: 'Focus Timer Pro',
    version: '1.2.0',
    description: 'Pomodoro productivity timer with notification alerts and session counter.',
    author: 'KubekOS Community Plugins',
    category: 'PRODUCTIVITY',
    icon: 'activity',
    entryPoint: 'plugin://focus-timer-pro',
    permissions: ['notifications.send'],
    windowConfig: {
      defaultWidth: 420,
      defaultHeight: 380,
      minWidth: 360,
      minHeight: 320,
      isResizable: false,
      allowMultipleInstances: false,
    },
    isBuiltIn: false,
  },
  renderComponent: ({ api }) => {
    const [secondsLeft, setSecondsLeft] = React.useState(25 * 60);
    const [running, setRunning] = React.useState(false);

    React.useEffect(() => {
      if (!running) return;
      const timer = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setRunning(false);
            api.notifications.send('Focus Session Complete!', 'Great work! Time for a 5 minute break.');
            return 25 * 60;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }, [running, api]);

    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const secs = String(secondsLeft % 60).padStart(2, '0');

    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-5">
        <div className="text-xs font-mono uppercase text-cyan-400">Sandboxed Plugin • Focus Timer</div>
        <div className="text-5xl font-light font-mono text-white">
          {mins}:{secs}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-medium text-xs cursor-pointer"
          >
            {running ? 'Pause' : 'Start Focus'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setSecondsLeft(25 * 60);
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>
    );
  },
});

registerVerifiedPluginInCatalog({
  manifest: {
    id: 'plugin-json-formatter',
    name: 'JSON Inspector & Validator',
    version: '1.0.4',
    description: 'Format, minify, validate, and save JSON payloads directly to /KubekOS/Documents.',
    author: 'KubekOS DevTools',
    category: 'DEVELOPMENT',
    icon: 'file-code',
    entryPoint: 'plugin://json-inspector',
    permissions: ['vfs.read', 'vfs.write', 'notifications.send'],
    windowConfig: {
      defaultWidth: 640,
      defaultHeight: 460,
      minWidth: 480,
      minHeight: 360,
      isResizable: true,
      allowMultipleInstances: false,
    },
    isBuiltIn: false,
  },
  renderComponent: ({ api }) => {
    const [raw, setRaw] = React.useState('{"project":"KubekOS","valid":true,"nodes":14}');
    const [status, setStatus] = React.useState('Valid JSON');

    const formatJson = () => {
      try {
        const parsed = JSON.parse(raw);
        setRaw(JSON.stringify(parsed, null, 2));
        setStatus('Formatted successfully');
      } catch (e) {
        setStatus(`Syntax Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    const saveToVfs = async () => {
      try {
        const target = '/KubekOS/Documents/formatted_payload.json';
        await api.vfs.writeFile(target, raw);
        api.notifications.send('Saved JSON', `Wrote formatted payload to ${target}`);
        setStatus(`Saved to ${target}`);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : String(e));
      }
    };

    return (
      <div className="h-full flex flex-col p-4 gap-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-slate-400">{status}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={formatJson}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
            >
              Prettify JSON
            </button>
            <button
              type="button"
              onClick={() => void saveToVfs()}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-medium cursor-pointer"
            >
              Save to VFS
            </button>
          </div>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="flex-1 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-100 focus:outline-none resize-none"
        />
      </div>
    );
  },
});
