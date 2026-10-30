/**
 * KubekOS Kernel Store (Zustand)
 * Manages boot sequence, system power state, active user session, and theme tokens.
 */

import { create } from 'zustand';
import type {
  AccentColorId,
  KernelBootStage,
  SystemBootPhase,
  ThemeMode,
  UserPreferences,
  UserProfile,
  WallpaperId,
} from '@/types/os';
import { kernelLogger } from './logger';
import { eventBus } from './eventBus';

export const DEFAULT_BOOT_STAGES: KernelBootStage[] = [
  {
    id: 'stage-cpu-mem',
    label: 'Initializing virtual runtime & memory descriptors',
    subsystem: 'KERNEL',
    status: 'PENDING',
  },
  {
    id: 'stage-vfs',
    label: 'Mounting IndexedDB Virtual Filesystem (/KubekOS)',
    subsystem: 'VFS',
    status: 'PENDING',
  },
  {
    id: 'stage-theme',
    label: 'Loading Theme Engine & glassmorphism compositor',
    subsystem: 'THEME_ENGINE',
    status: 'PENDING',
  },
  {
    id: 'stage-users',
    label: 'Loading local user profiles & security policies',
    subsystem: 'USER_SYSTEM',
    status: 'PENDING',
  },
  {
    id: 'stage-apps',
    label: 'Registering application manifests & sandboxed plugin API',
    subsystem: 'APP_RUNTIME',
    status: 'PENDING',
  },
];

export const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'user-admin',
    username: 'kubek',
    displayName: 'Kubek Architect',
    role: 'ADMIN',
    avatarColor: 'cyan',
    title: 'System Administrator',
    createdAt: Date.now() - 86400000 * 14,
    lastLoginAt: Date.now(),
  },
  {
    id: 'user-guest',
    username: 'guest',
    displayName: 'Guest Workspace',
    role: 'GUEST',
    avatarColor: 'indigo',
    title: 'Standard Session',
    createdAt: Date.now() - 86400000 * 7,
    lastLoginAt: Date.now() - 86400000,
  },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  userId: 'user-admin',
  themeMode: 'dark',
  accentColor: 'cyan',
  wallpaperId: 'nebula-dark',
  motionQuality: 'EXTREME',
  reducedMotion: false,
  glassBlurIntensity: 'HIGH',
  soundEffectsEnabled: true,
  soundVolume: 75,
  doNotDisturb: false,
  pinnedAppIds: [
    'file-explorer',
    'terminal',
    'code-editor',
    'browser',
    'notes',
    'system-monitor',
    'settings',
  ],
  desktopShowWidgets: true,
  privacyTelemetryOptIn: false,
};

interface KernelState {
  bootPhase: SystemBootPhase;
  bootStages: KernelBootStage[];
  bootStartedAt: number | null;
  bootCompletedAt: number | null;
  uptimeSeconds: number;
  users: UserProfile[];
  activeUser: UserProfile | null;
  preferences: UserPreferences;

  // Actions
  startBootSequence: (initServicesCallback?: () => Promise<void>) => Promise<void>;
  updateBootStage: (stageId: string, status: KernelBootStage['status'], durationMs?: number) => void;
  loginUser: (userId: string) => void;
  logoutUser: () => void;
  lockSession: () => void;
  restartSystem: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColorId) => void;
  setWallpaper: (wallpaperId: WallpaperId) => void;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  updateUserProfile: (userId: string, partial: Partial<Pick<UserProfile, 'displayName' | 'title' | 'avatarColor'>>) => void;
  incrementUptime: () => void;
}

export const useKernelStore = create<KernelState>((set, get) => ({
  bootPhase: 'OFF',
  bootStages: DEFAULT_BOOT_STAGES.map((s) => ({ ...s })),
  bootStartedAt: null,
  bootCompletedAt: null,
  uptimeSeconds: 0,
  users: DEFAULT_USERS,
  activeUser: null,
  preferences: DEFAULT_PREFERENCES,

  updateBootStage: (stageId, status, durationMs) => {
    set((state) => ({
      bootStages: state.bootStages.map((stage) =>
        stage.id === stageId ? { ...stage, status, durationMs } : stage
      ),
    }));
    eventBus.emit('kernel:boot-stage', { stageId, status });
  },

  startBootSequence: async (initServicesCallback) => {
    const startTime = performance.now();
    set({
      bootPhase: 'BOOTING',
      bootStartedAt: Date.now(),
      bootStages: DEFAULT_BOOT_STAGES.map((s) => ({ ...s, status: 'PENDING' })),
    });

    kernelLogger.info('KERNEL', 'KubekOS Kernel v1.0.0 starting boot sequence...');

    const stages = get().bootStages;
    for (const stage of stages) {
      const stageStart = performance.now();
      get().updateBootStage(stage.id, 'IN_PROGRESS');

      try {
        if (stage.id === 'stage-vfs' && initServicesCallback) {
          await initServicesCallback();
        } else {
          await new Promise((resolve) => setTimeout(resolve, 110));
        }

        const elapsed = Math.round(performance.now() - stageStart);
        get().updateBootStage(stage.id, 'DONE', elapsed);
        kernelLogger.info(stage.subsystem, `${stage.label} completed in ${elapsed}ms`);
      } catch (err) {
        get().updateBootStage(stage.id, 'FAILED');
        kernelLogger.error(stage.subsystem, `Failed during stage: ${stage.label}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        set({ bootPhase: 'SAFE_MODE' });
        return;
      }
    }

    const totalBootMs = Math.round(performance.now() - startTime);
    set({
      bootPhase: 'LOGIN',
      bootCompletedAt: Date.now(),
    });
    eventBus.emit('kernel:ready', { bootTimeMs: totalBootMs });
    kernelLogger.info('KERNEL', `Kernel boot sequence finished in ${totalBootMs}ms. Awaiting user login.`);
  },

  loginUser: (userId) => {
    const targetUser = get().users.find((u) => u.id === userId);
    if (!targetUser) {
      kernelLogger.warn('USER_SYSTEM', `Attempted login for non-existent user ID: ${userId}`);
      return;
    }

    const updatedUser: UserProfile = {
      ...targetUser,
      lastLoginAt: Date.now(),
    };

    set((state) => ({
      activeUser: updatedUser,
      users: state.users.map((u) => (u.id === userId ? updatedUser : u)),
      bootPhase: 'READY',
    }));

    kernelLogger.info('USER_SYSTEM', `User "${updatedUser.username}" logged in successfully.`);
    eventBus.emit('user:login', { userId: updatedUser.id, username: updatedUser.username });
  },

  logoutUser: () => {
    const current = get().activeUser;
    if (current) {
      kernelLogger.info('USER_SYSTEM', `User "${current.username}" logged out.`);
      eventBus.emit('user:logout', { userId: current.id });
    }
    set({
      activeUser: null,
      bootPhase: 'LOGIN',
    });
  },

  lockSession: () => {
    const current = get().activeUser;
    if (current) {
      kernelLogger.info('USER_SYSTEM', `Session locked for "${current.username}".`);
    }
    set({ bootPhase: 'LOCKED' });
  },

  restartSystem: () => {
    kernelLogger.info('KERNEL', 'System restart initiated by user.');
    set({
      bootPhase: 'OFF',
      activeUser: null,
      uptimeSeconds: 0,
    });
    void get().startBootSequence();
  },

  setThemeMode: (mode) => {
    set((state) => ({
      preferences: { ...state.preferences, themeMode: mode },
    }));
    const htmlEl = document.documentElement;
    if (mode === 'dark') {
      htmlEl.classList.add('dark');
      htmlEl.classList.remove('light');
    } else {
      htmlEl.classList.add('light');
      htmlEl.classList.remove('dark');
    }
    eventBus.emit('theme:changed', { mode, accentColor: get().preferences.accentColor });
    kernelLogger.info('THEME_ENGINE', `Theme mode switched to ${mode}`);
  },

  setAccentColor: (accentColor) => {
    set((state) => ({
      preferences: { ...state.preferences, accentColor },
    }));
    eventBus.emit('theme:changed', { mode: get().preferences.themeMode, accentColor });
    kernelLogger.info('THEME_ENGINE', `Accent color updated to ${accentColor}`);
  },

  setWallpaper: (wallpaperId) => {
    set((state) => ({
      preferences: { ...state.preferences, wallpaperId },
    }));
    kernelLogger.info('THEME_ENGINE', `Wallpaper changed to ${wallpaperId}`);
  },

  updatePreferences: (partial) => {
    set((state) => ({
      preferences: { ...state.preferences, ...partial },
    }));
  },

  updateUserProfile: (userId, partial) => {
    set((state) => {
      const updatedUsers = state.users.map((u) =>
        u.id === userId ? { ...u, ...partial } : u
      );
      const updatedActive =
        state.activeUser?.id === userId
          ? { ...state.activeUser, ...partial }
          : state.activeUser;
      return {
        users: updatedUsers,
        activeUser: updatedActive,
      };
    });
  },

  incrementUptime: () => {
    set((state) => ({ uptimeSeconds: state.uptimeSeconds + 1 }));
  },
}));
