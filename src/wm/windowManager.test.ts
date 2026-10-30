import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore, calculateSnapBounds } from './windowStore';
import { useDesktopStore } from '@/desktop/desktopStore';
import { useNotificationStore } from '@/notifications/notificationStore';

describe('Phase 2 & 3 — Desktop Environment & Window Manager', () => {
  beforeEach(() => {
    useWindowStore.getState().closeAllWindows();
    useDesktopStore.getState().resetShortcuts();
    useDesktopStore.getState().setStartMenuOpen(false);
    useDesktopStore.getState().setCommandPaletteOpen(false);
    useNotificationStore.getState().clearAll();
  });

  it('opens, focuses, minimizes, maximizes, restores, and closes windows accurately', () => {
    const wm = useWindowStore.getState();

    const win1Id = wm.openWindow('terminal');
    expect(win1Id).toBeTruthy();
    expect(useWindowStore.getState().windows).toHaveLength(1);
    expect(useWindowStore.getState().activeWindowId).toBe(win1Id);

    const win2Id = wm.openWindow('file-explorer');
    expect(useWindowStore.getState().windows).toHaveLength(2);
    expect(useWindowStore.getState().activeWindowId).toBe(win2Id);

    if (!win1Id || !win2Id) return;

    // Focus first window
    wm.focusWindow(win1Id);
    expect(useWindowStore.getState().activeWindowId).toBe(win1Id);

    // Minimize first window -> focus falls back to second window
    wm.minimizeWindow(win1Id);
    expect(useWindowStore.getState().activeWindowId).toBe(win2Id);
    expect(useWindowStore.getState().windows.find((w) => w.id === win1Id)?.mode).toBe('MINIMIZED');

    // Maximize and restore second window
    wm.maximizeWindow(win2Id);
    expect(useWindowStore.getState().windows.find((w) => w.id === win2Id)?.mode).toBe('MAXIMIZED');

    wm.restoreWindow(win2Id);
    expect(useWindowStore.getState().windows.find((w) => w.id === win2Id)?.mode).toBe('NORMAL');

    // Close windows
    wm.closeWindow(win2Id);
    expect(useWindowStore.getState().windows).toHaveLength(1);
  });

  it('prevents duplicate instances for single-instance applications like Settings', () => {
    const wm = useWindowStore.getState();

    const firstId = wm.openWindow('settings');
    const secondId = wm.openWindow('settings');

    expect(firstId).toBe(secondId);
    expect(useWindowStore.getState().windows).toHaveLength(1);
  });

  it('calculates snap bounds for screen halves and quadrants accurately', () => {
    const leftHalf = calculateSnapBounds('LEFT_HALF', 1200, 848);
    expect(leftHalf).toEqual({ x: 0, y: 0, width: 600, height: 800 });

    const bottomRight = calculateSnapBounds('BOTTOM_RIGHT', 1200, 848);
    expect(bottomRight).toEqual({ x: 600, y: 400, width: 600, height: 400 });
  });

  it('manages desktop icon selection, grid movement, Start menu, and Command Palette', () => {
    const desktop = useDesktopStore.getState();
    const firstShortcut = desktop.shortcuts[0];
    expect(firstShortcut).toBeDefined();
    if (!firstShortcut) return;

    desktop.selectShortcut(firstShortcut.id);
    expect(useDesktopStore.getState().selectedShortcutId).toBe(firstShortcut.id);

    desktop.moveShortcut(firstShortcut.id, 3, 4);
    const moved = useDesktopStore.getState().shortcuts.find((s) => s.id === firstShortcut.id);
    expect(moved?.gridCol).toBe(3);
    expect(moved?.gridRow).toBe(4);

    desktop.toggleCommandPalette();
    expect(useDesktopStore.getState().isCommandPaletteOpen).toBe(true);
  });

  it('pushes and marks notifications as read in NotificationStore', () => {
    const notifStore = useNotificationStore.getState();
    const pushed = notifStore.pushNotification({
      title: 'Disk Check Complete',
      message: 'All VFS nodes healthy',
      priority: 'NORMAL',
    });

    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(pushed.read).toBe(false);

    notifStore.markAsRead(pushed.id);
    expect(useNotificationStore.getState().notifications[0]?.read).toBe(true);
  });
});
