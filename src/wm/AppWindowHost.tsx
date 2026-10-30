/**
 * KubekOS Application Window Host
 * Routes all 14 built-in applications and dynamically installed sandboxed plugins.
 */

import React from 'react';
import type { WindowInstance } from '@/types/os';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { FileExplorerApp } from '@/apps/FileExplorerApp';
import { TerminalApp } from '@/apps/TerminalApp';
import { CodeEditorApp } from '@/apps/CodeEditorApp';
import { NotesApp } from '@/apps/NotesApp';
import { CalculatorApp } from '@/apps/CalculatorApp';
import { SettingsApp } from '@/apps/SettingsApp';
import { BrowserApp } from '@/apps/BrowserApp';
import { MediaPlayerApp } from '@/apps/MediaPlayerApp';
import { CalendarApp } from '@/apps/CalendarApp';
import {
  AboutKubekOsApp,
  AppStoreApp,
  ImageViewerApp,
  SystemMonitorApp,
  TaskManagerApp,
} from '@/apps/SystemApps';
import {
  createControlledPluginApi,
  getVerifiedPluginById,
} from '@/plugins/pluginManager';

export interface AppWindowHostProps {
  windowInstance: WindowInstance;
}

export const AppWindowHost: React.FC<AppWindowHostProps> = ({ windowInstance }) => {
  const manifest = useAppRegistryStore((s) => s.getManifest(windowInstance.appId));

  if (!manifest) {
    return (
      <div className="p-6 text-xs text-rose-400">
        Application manifest not found for ID: {windowInstance.appId}
      </div>
    );
  }

  const initialFilePath =
    typeof windowInstance.launchArgs?.filePath === 'string'
      ? windowInstance.launchArgs.filePath
      : undefined;

  switch (manifest.id) {
    case 'file-explorer':
      return <FileExplorerApp initialPath={initialFilePath ?? '/KubekOS'} />;
    case 'terminal':
      return <TerminalApp />;
    case 'code-editor':
      return <CodeEditorApp initialFilePath={initialFilePath} />;
    case 'notes':
      return <NotesApp />;
    case 'calculator':
      return <CalculatorApp />;
    case 'settings':
      return (
        <SettingsApp
          initialSection={
            typeof windowInstance.launchArgs?.section === 'string'
              ? (windowInstance.launchArgs.section as 'personalization')
              : 'personalization'
          }
        />
      );
    case 'browser':
      return <BrowserApp />;
    case 'media-player':
      return <MediaPlayerApp />;
    case 'calendar':
      return <CalendarApp />;
    case 'system-monitor':
      return <SystemMonitorApp />;
    case 'task-manager':
      return <TaskManagerApp />;
    case 'image-viewer':
      return <ImageViewerApp initialFilePath={initialFilePath} />;
    case 'app-store':
      return <AppStoreApp />;
    case 'about-kubekos':
      return <AboutKubekOsApp />;
    default: {
      // Check if it is an installed verified plugin
      const pluginPkg = getVerifiedPluginById(manifest.id);
      if (pluginPkg) {
        const api = createControlledPluginApi(manifest);
        const PluginComponent = pluginPkg.renderComponent;
        return <PluginComponent api={api} />;
      }
      return (
        <div className="p-6 text-xs text-slate-400">
          Sandboxed Plugin Runtime Active: {manifest.name} (v{manifest.version})
        </div>
      );
    }
  }
};
