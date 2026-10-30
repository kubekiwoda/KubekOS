/**
 * KubekOS Desktop Environment Store
 * Manages desktop icon grid, selection, dragging, Start menu, Command Palette, and context menus.
 */

import { create } from 'zustand';
import type { ContextMenuItem, DesktopShortcut } from '@/types/os';
import { BUILT_IN_MANIFESTS } from '@/apps/appRegistry';

const DEFAULT_SHORTCUTS: DesktopShortcut[] = BUILT_IN_MANIFESTS.filter(
  (m) => m.desktopShortcutByDefault
).map((manifest, index) => ({
  id: `shortcut_${manifest.id}`,
  label: manifest.name,
  icon: manifest.icon,
  targetType: 'APP',
  targetId: manifest.id,
  gridCol: Math.floor(index / 6),
  gridRow: index % 6,
}));

interface ActiveContextMenu {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface DesktopEnvironmentState {
  shortcuts: DesktopShortcut[];
  selectedShortcutId: string | null;
  activeWorkspace: number;
  isStartMenuOpen: boolean;
  isCommandPaletteOpen: boolean;
  isAltTabOpen: boolean;
  contextMenu: ActiveContextMenu | null;

  selectShortcut: (id: string | null) => void;
  setActiveWorkspace: (workspaceId: number) => void;
  moveShortcut: (id: string, gridCol: number, gridRow: number) => void;
  addShortcut: (shortcut: Omit<DesktopShortcut, 'id' | 'gridCol' | 'gridRow'>) => void;
  removeShortcut: (id: string) => void;
  resetShortcuts: () => void;
  setStartMenuOpen: (open: boolean) => void;
  toggleStartMenu: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setAltTabOpen: (open: boolean) => void;
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;
}

export const useDesktopStore = create<DesktopEnvironmentState>((set, get) => ({
  shortcuts: DEFAULT_SHORTCUTS,
  selectedShortcutId: null,
  activeWorkspace: 1,
  isStartMenuOpen: false,
  isCommandPaletteOpen: false,
  isAltTabOpen: false,
  contextMenu: null,

  selectShortcut: (id) => set({ selectedShortcutId: id }),

  setActiveWorkspace: (workspaceId) =>
    set({
      activeWorkspace: Math.max(1, Math.min(4, workspaceId)),
      isStartMenuOpen: false,
      contextMenu: null,
    }),

  moveShortcut: (id, gridCol, gridRow) => {
    const clampedCol = Math.max(0, Math.min(12, gridCol));
    const clampedRow = Math.max(0, Math.min(7, gridRow));

    set((state) => {
      const occupied = state.shortcuts.find(
        (s) => s.id !== id && s.gridCol === clampedCol && s.gridRow === clampedRow
      );
      const current = state.shortcuts.find((s) => s.id === id);
      if (!current) return state;

      return {
        shortcuts: state.shortcuts.map((s) => {
          if (s.id === id) {
            return { ...s, gridCol: clampedCol, gridRow: clampedRow };
          }
          if (occupied && s.id === occupied.id) {
            return { ...s, gridCol: current.gridCol, gridRow: current.gridRow };
          }
          return s;
        }),
      };
    });
  },

  addShortcut: (shortcutInput) => {
    const existing = get().shortcuts;
    let col = 0;
    let row = 0;
    while (existing.some((s) => s.gridCol === col && s.gridRow === row)) {
      row += 1;
      if (row >= 6) {
        row = 0;
        col += 1;
      }
    }

    const newShortcut: DesktopShortcut = {
      ...shortcutInput,
      id: `shortcut_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      gridCol: col,
      gridRow: row,
    };

    set((state) => ({
      shortcuts: [...state.shortcuts, newShortcut],
    }));
  },

  removeShortcut: (id) => {
    set((state) => ({
      shortcuts: state.shortcuts.filter((s) => s.id !== id),
      selectedShortcutId: state.selectedShortcutId === id ? null : state.selectedShortcutId,
    }));
  },

  resetShortcuts: () => {
    set({
      shortcuts: DEFAULT_SHORTCUTS,
      selectedShortcutId: null,
    });
  },

  setStartMenuOpen: (open) =>
    set({
      isStartMenuOpen: open,
      contextMenu: null,
    }),

  toggleStartMenu: () =>
    set((state) => ({
      isStartMenuOpen: !state.isStartMenuOpen,
      contextMenu: null,
    })),

  setCommandPaletteOpen: (open) =>
    set({
      isCommandPaletteOpen: open,
      isStartMenuOpen: false,
      contextMenu: null,
    }),

  toggleCommandPalette: () =>
    set((state) => ({
      isCommandPaletteOpen: !state.isCommandPaletteOpen,
      isStartMenuOpen: false,
      contextMenu: null,
    })),

  setAltTabOpen: (open) => set({ isAltTabOpen: open }),

  openContextMenu: (x, y, items) =>
    set({
      contextMenu: { x, y, items },
      isStartMenuOpen: false,
    }),

  closeContextMenu: () => set({ contextMenu: null }),
}));
