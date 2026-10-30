/**
 * KubekOS Window Manager Store
 * Controls window creation, destruction, focus, z-index stacking, dragging, resizing,
 * minimize/maximize/restore, snap layouts, and Alt+Tab cycling.
 */

import { create } from 'zustand';
import type {
  WindowBounds,
  WindowInstance,
  WindowSnapRegion,
} from '@/types/os';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useDesktopStore } from '@/desktop/desktopStore';
import { eventBus } from '@/kernel/eventBus';
import { kernelLogger } from '@/kernel/logger';

const BASE_Z_INDEX = 20;
const TOP_BAR_HEIGHT = 36;
const DOCK_RESERVE_HEIGHT = 76;

export function calculateSnapBounds(
  region: WindowSnapRegion,
  viewportWidth: number,
  viewportHeight: number
): WindowBounds {
  const usableHeight = Math.max(320, viewportHeight - 48);
  const halfWidth = Math.floor(viewportWidth / 2);
  const halfHeight = Math.floor(usableHeight / 2);

  switch (region) {
    case 'LEFT_HALF':
      return { x: 0, y: 0, width: halfWidth, height: usableHeight };
    case 'RIGHT_HALF':
      return { x: halfWidth, y: 0, width: viewportWidth - halfWidth, height: usableHeight };
    case 'TOP_LEFT':
      return { x: 0, y: 0, width: halfWidth, height: halfHeight };
    case 'TOP_RIGHT':
      return { x: halfWidth, y: 0, width: viewportWidth - halfWidth, height: halfHeight };
    case 'BOTTOM_LEFT':
      return { x: 0, y: halfHeight, width: halfWidth, height: usableHeight - halfHeight };
    case 'BOTTOM_RIGHT':
      return {
        x: halfWidth,
        y: halfHeight,
        width: viewportWidth - halfWidth,
        height: usableHeight - halfHeight,
      };
    case 'MAXIMIZE':
    default:
      return { x: 0, y: 0, width: viewportWidth, height: usableHeight };
  }
}

interface WindowManagerState {
  windows: WindowInstance[];
  activeWindowId: string | null;
  nextZIndex: number;

  openWindow: (appId: string, launchArgs?: Record<string, unknown>, customTitle?: string) => string | null;
  closeWindow: (windowId: string) => void;
  closeAllWindows: () => void;
  focusWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  toggleMinimizeOrFocus: (windowId: string) => void;
  moveWindow: (windowId: string, x: number, y: number) => void;
  resizeWindow: (windowId: string, bounds: WindowBounds) => void;
  snapWindow: (windowId: string, region: WindowSnapRegion) => void;
  setWindowTitle: (windowId: string, title: string) => void;
  cycleFocusNext: () => void;
}

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: [],
  activeWindowId: null,
  nextZIndex: BASE_Z_INDEX,

  openWindow: (appId, launchArgs, customTitle) => {
    const manifest = useAppRegistryStore.getState().getManifest(appId);
    if (!manifest) {
      kernelLogger.error('WINDOW_MANAGER', `Cannot open window: Unknown application ID "${appId}"`);
      return null;
    }

    const existingWindows = get().windows.filter((w) => w.appId === appId);
    if (!manifest.windowConfig.allowMultipleInstances && existingWindows.length > 0) {
      const existing = existingWindows[0];
      if (existing) {
        if (launchArgs) {
          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === existing.id ? { ...w, launchArgs, mode: w.mode === 'MINIMIZED' ? 'NORMAL' : w.mode } : w
            ),
          }));
        }
        get().focusWindow(existing.id);
        return existing.id;
      }
    }

    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportH =
      typeof window !== 'undefined' ? window.innerHeight - DOCK_RESERVE_HEIGHT : 750;

    const width = Math.min(manifest.windowConfig.defaultWidth, Math.max(360, viewportW - 40));
    const height = Math.min(manifest.windowConfig.defaultHeight, Math.max(300, viewportH - 40));

    const cascadeOffset = (get().windows.length % 6) * 26;
    const centerX = Math.max(16, Math.floor((viewportW - width) / 2) + cascadeOffset);
    const centerY = Math.max(
      TOP_BAR_HEIGHT + 8,
      Math.floor((viewportH - height) / 2) + cascadeOffset
    );

    const newZ = get().nextZIndex + 1;
    const windowId = `win_${appId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const activeWorkspace = useDesktopStore.getState().activeWorkspace;

    const newWindow: WindowInstance = {
      id: windowId,
      appId: manifest.id,
      title: customTitle ?? manifest.name,
      icon: manifest.icon,
      mode: 'NORMAL',
      snapRegion: 'NONE',
      bounds: {
        x: centerX,
        y: centerY,
        width,
        height,
      },
      minWidth: manifest.windowConfig.minWidth,
      minHeight: manifest.windowConfig.minHeight,
      isResizable: manifest.windowConfig.isResizable,
      isFocused: true,
      zIndex: newZ,
      workspaceId: activeWorkspace,
      createdAt: Date.now(),
      launchArgs,
    };

    set((state) => ({
      windows: [
        ...state.windows.map((w) => ({ ...w, isFocused: false })),
        newWindow,
      ],
      activeWindowId: windowId,
      nextZIndex: newZ,
    }));

    eventBus.emit('window:opened', { windowId, appId: manifest.id });
    eventBus.emit('app:launched', { appId: manifest.id, instanceId: windowId });
    kernelLogger.info('WINDOW_MANAGER', `Opened window "${newWindow.title}" (${windowId})`);
    return windowId;
  },

  closeWindow: (windowId) => {
    const target = get().windows.find((w) => w.id === windowId);
    if (!target) return;

    const remaining = get().windows.filter((w) => w.id !== windowId);
    const visibleRemaining = remaining
      .filter((w) => w.mode !== 'MINIMIZED')
      .sort((a, b) => b.zIndex - a.zIndex);

    const nextActiveId = visibleRemaining[0]?.id ?? null;

    set({
      windows: remaining.map((w) => ({
        ...w,
        isFocused: w.id === nextActiveId,
      })),
      activeWindowId: nextActiveId,
    });

    eventBus.emit('window:closed', { windowId, appId: target.appId });
    eventBus.emit('app:terminated', { appId: target.appId, instanceId: windowId });
    kernelLogger.info('WINDOW_MANAGER', `Closed window "${target.title}" (${windowId})`);
  },

  closeAllWindows: () => {
    set({
      windows: [],
      activeWindowId: null,
    });
  },

  focusWindow: (windowId) => {
    const target = get().windows.find((w) => w.id === windowId);
    if (!target) return;

    const newZ = get().nextZIndex + 1;
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              mode: w.mode === 'MINIMIZED' ? 'NORMAL' : w.mode,
              isFocused: true,
              zIndex: newZ,
            }
          : { ...w, isFocused: false }
      ),
      activeWindowId: windowId,
      nextZIndex: newZ,
    }));

    eventBus.emit('window:focused', { windowId });
  },

  minimizeWindow: (windowId) => {
    const remainingVisible = get()
      .windows.filter((w) => w.id !== windowId && w.mode !== 'MINIMIZED')
      .sort((a, b) => b.zIndex - a.zIndex);

    const nextActiveId = remainingVisible[0]?.id ?? null;

    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id === windowId) {
          return { ...w, mode: 'MINIMIZED', isFocused: false };
        }
        return { ...w, isFocused: w.id === nextActiveId };
      }),
      activeWindowId: nextActiveId,
    }));
  },

  maximizeWindow: (windowId) => {
    const newZ = get().nextZIndex + 1;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const maxBounds = calculateSnapBounds('MAXIMIZE', viewportW, viewportH);

    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) return { ...w, isFocused: false };
        return {
          ...w,
          restoreBounds: w.mode === 'NORMAL' ? { ...w.bounds } : w.restoreBounds,
          bounds: maxBounds,
          mode: 'MAXIMIZED',
          snapRegion: 'MAXIMIZE',
          isFocused: true,
          zIndex: newZ,
        };
      }),
      activeWindowId: windowId,
      nextZIndex: newZ,
    }));
  },

  restoreWindow: (windowId) => {
    const newZ = get().nextZIndex + 1;
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) return { ...w, isFocused: false };
        return {
          ...w,
          bounds: w.restoreBounds ?? w.bounds,
          mode: 'NORMAL',
          snapRegion: 'NONE',
          isFocused: true,
          zIndex: newZ,
        };
      }),
      activeWindowId: windowId,
      nextZIndex: newZ,
    }));
  },

  toggleMinimizeOrFocus: (windowId) => {
    const target = get().windows.find((w) => w.id === windowId);
    if (!target) return;

    if (target.mode === 'MINIMIZED') {
      get().focusWindow(windowId);
    } else if (target.isFocused) {
      get().minimizeWindow(windowId);
    } else {
      get().focusWindow(windowId);
    }
  },

  moveWindow: (windowId, x, y) => {
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportH =
      typeof window !== 'undefined' ? window.innerHeight - DOCK_RESERVE_HEIGHT : 750;

    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) return w;
        const clampedX = Math.max(-w.bounds.width + 120, Math.min(x, viewportW - 120));
        const clampedY = Math.max(0, Math.min(y, viewportH - 40));
        return {
          ...w,
          mode: 'NORMAL',
          snapRegion: 'NONE',
          bounds: {
            ...w.bounds,
            x: clampedX,
            y: clampedY,
          },
        };
      }),
    }));
  },

  resizeWindow: (windowId, bounds) => {
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId || !w.isResizable) return w;
        return {
          ...w,
          mode: 'NORMAL',
          snapRegion: 'NONE',
          bounds: {
            x: bounds.x,
            y: bounds.y,
            width: Math.max(w.minWidth, bounds.width),
            height: Math.max(w.minHeight, bounds.height),
          },
        };
      }),
    }));
  },

  snapWindow: (windowId, region) => {
    if (region === 'NONE') {
      get().restoreWindow(windowId);
      return;
    }
    if (region === 'MAXIMIZE') {
      get().maximizeWindow(windowId);
      return;
    }

    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const snappedBounds = calculateSnapBounds(region, viewportW, viewportH);
    const newZ = get().nextZIndex + 1;

    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== windowId) return { ...w, isFocused: false };
        return {
          ...w,
          restoreBounds: w.snapRegion === 'NONE' && w.mode === 'NORMAL' ? { ...w.bounds } : w.restoreBounds,
          bounds: snappedBounds,
          mode: 'NORMAL',
          snapRegion: region,
          isFocused: true,
          zIndex: newZ,
        };
      }),
      activeWindowId: windowId,
      nextZIndex: newZ,
    }));
  },

  setWindowTitle: (windowId, title) => {
    set((state) => ({
      windows: state.windows.map((w) => (w.id === windowId ? { ...w, title } : w)),
    }));
  },

  cycleFocusNext: () => {
    const allWindows = get().windows;
    if (allWindows.length === 0) return;

    const sorted = [...allWindows].sort((a, b) => b.zIndex - a.zIndex);
    const nextTarget = sorted[1] ?? sorted[0];
    if (nextTarget) {
      get().focusWindow(nextTarget.id);
    }
  },
}));
