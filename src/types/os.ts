/**
 * KubekOS Core System Types & Contracts
 * Strict typing for all 8 subsystems: Kernel, Desktop, Window Manager,
 * Application Runtime, Virtual Filesystem, User System, Notifications, Theme Engine.
 */

// ============================================================================
// 1. KERNEL CORE TYPES
// ============================================================================

export type SystemBootPhase =
  | 'OFF'
  | 'BOOTING'
  | 'LOGIN'
  | 'READY'
  | 'LOCKED'
  | 'SAFE_MODE'
  | 'SHUTTING_DOWN';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  subsystem:
    | 'KERNEL'
    | 'VFS'
    | 'WINDOW_MANAGER'
    | 'APP_RUNTIME'
    | 'USER_SYSTEM'
    | 'THEME_ENGINE'
    | 'NOTIFICATION'
    | 'PLUGIN_API'
    | 'DESKTOP';
  message: string;
  details?: Record<string, unknown>;
}

export interface KernelService {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  status: 'UNINITIALIZED' | 'INITIALIZING' | 'RUNNING' | 'STOPPED' | 'ERROR';
  init: () => Promise<void>;
  shutdown?: () => Promise<void>;
}

export interface KernelBootStage {
  id: string;
  label: string;
  subsystem: LogEntry['subsystem'];
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
  durationMs?: number;
}

export interface SystemEventMap {
  'kernel:boot-stage': { stageId: string; status: KernelBootStage['status'] };
  'kernel:ready': { bootTimeMs: number };
  'kernel:error': { message: string; subsystem: LogEntry['subsystem']; fatal: boolean };
  'vfs:changed': { path: string; operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE' | 'RESTORE' };
  'window:opened': { windowId: string; appId: string };
  'window:closed': { windowId: string; appId: string };
  'window:focused': { windowId: string };
  'app:launched': { appId: string; instanceId: string };
  'app:terminated': { appId: string; instanceId: string };
  'user:login': { userId: string; username: string };
  'user:logout': { userId: string };
  'theme:changed': { mode: ThemeMode; accentColor: AccentColorId };
  'notification:pushed': { notificationId: string };
}

export type SystemEventKey = keyof SystemEventMap;
export type SystemEventHandler<K extends SystemEventKey> = (payload: SystemEventMap[K]) => void;

// ============================================================================
// 2. VIRTUAL FILESYSTEM (VFS) TYPES
// ============================================================================

export type VfsNodeType = 'FILE' | 'DIRECTORY';

export type FileMimeCategory =
  | 'text/plain'
  | 'text/markdown'
  | 'application/json'
  | 'text/typescript'
  | 'text/javascript'
  | 'text/css'
  | 'text/html'
  | 'image/svg+xml'
  | 'image/png'
  | 'image/jpeg'
  | 'audio/mpeg'
  | 'audio/wav'
  | 'application/x-kubek-app';

export interface VfsNode {
  id: string;
  name: string;
  path: string; // Normalized full path e.g., "/KubekOS/Documents/Notes/welcome.md"
  parentPath: string | null; // e.g., "/KubekOS/Documents/Notes" or null for root "/KubekOS"
  type: VfsNodeType;
  mimeType?: FileMimeCategory;
  content?: string; // UTF-8 content or Data URL for binary assets
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  isSystemProtected: boolean; // Prevents accidental deletion of root OS directories
  isTrashed: boolean;
  trashedAt?: number;
  originalPath?: string; // Stored when moved to Trash for recovery
}

export interface VfsStorageStats {
  totalFiles: number;
  totalDirectories: number;
  trashedItems: number;
  usedBytes: number;
  quotaBytes: number;
}

// ============================================================================
// 3. WINDOW MANAGER TYPES
// ============================================================================

export type WindowStateMode = 'NORMAL' | 'MINIMIZED' | 'MAXIMIZED';

export type WindowSnapRegion =
  | 'NONE'
  | 'LEFT_HALF'
  | 'RIGHT_HALF'
  | 'TOP_LEFT'
  | 'TOP_RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_RIGHT'
  | 'MAXIMIZE';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  icon: string;
  mode: WindowStateMode;
  snapRegion: WindowSnapRegion;
  bounds: WindowBounds;
  restoreBounds?: WindowBounds;
  minWidth: number;
  minHeight: number;
  isResizable: boolean;
  isFocused: boolean;
  zIndex: number;
  workspaceId: number;
  createdAt: number;
  launchArgs?: Record<string, unknown>;
}

// ============================================================================
// 4. APPLICATION RUNTIME & PLUGIN ARCHITECTURE TYPES
// ============================================================================

export type AppPermission =
  | 'vfs.read'
  | 'vfs.write'
  | 'vfs.system'
  | 'notifications.send'
  | 'settings.read'
  | 'settings.write'
  | 'audio.playback'
  | 'network.external'
  | 'system.metrics';

export type AppCategory =
  | 'SYSTEM'
  | 'PRODUCTIVITY'
  | 'DEVELOPMENT'
  | 'MEDIA'
  | 'UTILITIES'
  | 'INTERNET';

export interface AppWindowConfig {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  isResizable: boolean;
  allowMultipleInstances: boolean;
}

export interface ApplicationManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: AppCategory;
  icon: string; // Lucide icon identifier
  entryPoint: string;
  permissions: AppPermission[];
  windowConfig: AppWindowConfig;
  isBuiltIn: boolean;
  pinnedByDefault?: boolean;
  desktopShortcutByDefault?: boolean;
}

export interface RunningProcess {
  instanceId: string;
  appId: string;
  windowId: string;
  startedAt: number;
  status: 'RUNNING' | 'SUSPENDED';
}

// ============================================================================
// 5. USER SYSTEM TYPES
// ============================================================================

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: 'ADMIN' | 'STANDARD' | 'GUEST';
  avatarColor: AccentColorId;
  title: string;
  pinCodeHash?: string; // Optional simple lock PIN
  createdAt: number;
  lastLoginAt: number;
}

export type MotionQualityTier =
  | 'STANDARD'
  | 'ENHANCED'
  | 'EXTREME'
  | 'REDUCED_MOTION';

export type FontScaleTier = 'COMPACT' | 'DEFAULT' | 'LARGE';
export type DockSizeTier = 'COMPACT' | 'NORMAL' | 'LARGE';

export interface UserPreferences {
  userId: string;
  themeMode: ThemeMode;
  accentColor: AccentColorId;
  wallpaperId: WallpaperId;
  customWallpaperUrl?: string;
  fontScale: FontScaleTier;
  dockSize: DockSizeTier;
  windowOpacity: number; // 75 to 100
  motionQuality: MotionQualityTier;
  reducedMotion: boolean;
  glassBlurIntensity: 'LOW' | 'MEDIUM' | 'HIGH';
  soundEffectsEnabled: boolean;
  soundVolume: number; // 0 to 100
  doNotDisturb: boolean;
  pinnedAppIds: string[];
  desktopShowWidgets: boolean;
  privacyTelemetryOptIn: boolean;
}

// ============================================================================
// 6. THEME ENGINE & VISUAL DESIGN SYSTEM TYPES
// ============================================================================

export type ThemeMode = 'dark' | 'light';

export type AccentColorId =
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet';

export type WallpaperId =
  | 'nebula-dark'
  | 'arctic-aurora'
  | 'obsidian-grid'
  | 'sunset-horizon'
  | 'forest-mist'
  | 'minimal-slate';

export interface WallpaperPreset {
  id: WallpaperId;
  name: string;
  description: string;
  cssBackground: string;
  previewAccent: AccentColorId;
  recommendedMode: ThemeMode;
}

export interface AccentColorToken {
  id: AccentColorId;
  label: string;
  primaryHex: string;
  ringClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  subtleBgClass: string;
}

// ============================================================================
// 7. NOTIFICATION CENTER & QUICK SETTINGS TYPES
// ============================================================================

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  sourceAppId?: string;
  priority: NotificationPriority;
  timestamp: number;
  read: boolean;
  actionLabel?: string;
  actionAppId?: string;
}

// ============================================================================
// 8. DESKTOP ENVIRONMENT TYPES
// ============================================================================

export interface DesktopShortcut {
  id: string;
  label: string;
  icon: string;
  targetType: 'APP' | 'FILE' | 'DIRECTORY';
  targetId: string; // appId or VFS path
  gridCol: number;
  gridRow: number;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorAfter?: boolean;
  onSelect: () => void;
}
