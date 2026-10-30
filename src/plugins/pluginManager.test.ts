import { describe, it, expect, beforeEach } from 'vitest';
import {
  createControlledPluginApi,
  installCatalogPlugin,
  uninstallCatalogPlugin,
} from './pluginManager';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useVfsStore } from '@/vfs/vfsStore';
import type { ApplicationManifest } from '@/types/os';

describe('Phase 6 & 7 — Controlled Plugin API & Sandbox Permissions', () => {
  beforeEach(async () => {
    await useVfsStore.getState().initializeVfs();
  });

  it('installs and uninstalls verified plugins in the Application Registry', () => {
    const installed = installCatalogPlugin('plugin-pomodoro');
    expect(installed).toBe(true);
    expect(useAppRegistryStore.getState().getManifest('plugin-pomodoro')).toBeDefined();

    uninstallCatalogPlugin('plugin-pomodoro');
    expect(useAppRegistryStore.getState().getManifest('plugin-pomodoro')).toBeUndefined();
  });

  it('enforces explicit permission boundaries in ControlledPluginApi', async () => {
    const restrictedManifest: ApplicationManifest = {
      id: 'plugin-restricted',
      name: 'Restricted Test Plugin',
      version: '1.0.0',
      description: 'Has only vfs.read permission',
      author: 'Test',
      category: 'UTILITIES',
      icon: 'window',
      entryPoint: 'plugin://restricted',
      permissions: ['vfs.read'],
      windowConfig: {
        defaultWidth: 400,
        defaultHeight: 300,
        minWidth: 300,
        minHeight: 200,
        isResizable: false,
        allowMultipleInstances: false,
      },
      isBuiltIn: false,
    };

    const api = createControlledPluginApi(restrictedManifest);

    // Allowed: vfs.read
    expect(api.hasPermission('vfs.read')).toBe(true);
    const files = api.vfs.listDirectory('/KubekOS/Documents');
    expect(files.length).toBeGreaterThan(0);

    // Denied: vfs.write
    expect(api.hasPermission('vfs.write')).toBe(false);
    await expect(
      api.vfs.writeFile('/KubekOS/Documents/unauthorized.txt', 'blocked')
    ).rejects.toThrow(/Permission Denied/i);

    // Denied: system.metrics
    expect(() => api.system.getUptimeSeconds()).toThrow(/Permission Denied/i);
  });
});
