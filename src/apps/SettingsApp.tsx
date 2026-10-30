/**
 * KubekOS Settings Application
 * Complete system configuration: Personalization, Wallpaper, Theme, Accent Color,
 * Sound Preferences, User Profile Management, Storage Information, and Privacy Settings.
 */

import React, { useState } from 'react';
import {
  Database,
  Palette,
  Shield,
  Sparkles,
  User,
  Volume2,
} from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';
import { useVfsStore } from '@/vfs/vfsStore';
import { ACCENT_COLORS, WALLPAPER_PRESETS } from '@/theme/tokens';

type SettingsSection =
  | 'personalization'
  | 'audio'
  | 'profile'
  | 'storage'
  | 'privacy';

export interface SettingsAppProps {
  initialSection?: SettingsSection;
}

export const SettingsApp: React.FC<SettingsAppProps> = ({
  initialSection = 'personalization',
}) => {
  const preferences = useKernelStore((s) => s.preferences);
  const activeUser = useKernelStore((s) => s.activeUser);
  const setThemeMode = useKernelStore((s) => s.setThemeMode);
  const setAccentColor = useKernelStore((s) => s.setAccentColor);
  const setWallpaper = useKernelStore((s) => s.setWallpaper);
  const updatePreferences = useKernelStore((s) => s.updatePreferences);
  const updateUserProfile = useKernelStore((s) => s.updateUserProfile);

  const getStorageStats = useVfsStore((s) => s.getStorageStats);
  const emptyTrash = useVfsStore((s) => s.emptyTrash);

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [displayNameInput, setDisplayNameInput] = useState(
    activeUser?.displayName ?? 'Kubek Architect'
  );
  const [titleInput, setTitleInput] = useState(
    activeUser?.title ?? 'System Administrator'
  );
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;
  const stats = getStorageStats();

  const navItems: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    {
      id: 'personalization',
      label: 'Personalization & Theme',
      icon: <Palette className="w-4 h-4" />,
    },
    {
      id: 'audio',
      label: 'Sound & Notifications',
      icon: <Volume2 className="w-4 h-4" />,
    },
    {
      id: 'profile',
      label: 'User Profile',
      icon: <User className="w-4 h-4" />,
    },
    {
      id: 'storage',
      label: 'Storage & VFS',
      icon: <Database className="w-4 h-4" />,
    },
    {
      id: 'privacy',
      label: 'Privacy & Security',
      icon: <Shield className="w-4 h-4" />,
    },
  ];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    updateUserProfile(activeUser.id, {
      displayName: displayNameInput.trim() || activeUser.displayName,
      title: titleInput.trim() || activeUser.title,
    });
    setProfileSavedMsg(true);
    setTimeout(() => setProfileSavedMsg(false), 2500);
  };

  return (
    <div data-testid="app-settings" className="h-full flex text-xs select-none">
      {/* Left Navigation Sidebar */}
      <aside className="w-56 border-r border-slate-800 bg-slate-900/50 p-3 space-y-1 shrink-0">
        <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase text-slate-400">
          System Control Panel
        </div>
        {navItems.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`settings-tab-${item.id}`}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                active
                  ? `${accent.subtleBgClass} ${accent.textClass} font-medium`
                  : 'text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {section === 'personalization' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white">
                Personalization & Theme Engine
              </h2>
              <p className="text-slate-400 mt-0.5">
                Configure dark/light mode, accent color tokens, wallpapers, and motion preferences.
              </p>
            </div>

            {/* Theme Mode */}
            <div className="space-y-2">
              <label className="font-medium text-slate-200">Color Mode</label>
              <div className="flex gap-2.5">
                {(['dark', 'light'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    data-testid={`theme-mode-${mode}`}
                    onClick={() => setThemeMode(mode)}
                    className={`px-4 py-2 rounded-xl font-medium capitalize border cursor-pointer ${
                      preferences.themeMode === mode
                        ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {mode} Mode
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <label className="font-medium text-slate-200">System Accent Color</label>
              <div className="flex flex-wrap gap-2">
                {Object.values(ACCENT_COLORS).map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    data-testid={`accent-color-${token.id}`}
                    onClick={() => setAccentColor(token.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer ${
                      preferences.accentColor === token.id
                        ? 'bg-slate-800 border-white/40 text-white font-medium'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${token.bgClass}`} />
                    <span>{token.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Wallpaper Selection */}
            <div className="space-y-2">
              <label className="font-medium text-slate-200">Desktop Wallpaper</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.values(WALLPAPER_PRESETS).map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    data-testid={`wallpaper-${wp.id}`}
                    onClick={() => {
                      setWallpaper(wp.id);
                      updatePreferences({ customWallpaperUrl: '' });
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      preferences.wallpaperId === wp.id && !preferences.customWallpaperUrl
                        ? `${accent.borderClass} ring-2 ${accent.ringClass} bg-slate-900`
                        : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900'
                    }`}
                  >
                    <div
                      style={{ background: wp.cssBackground }}
                      className="w-full h-14 rounded-lg mb-2 border border-white/10"
                    />
                    <div className="font-medium text-white">{wp.name}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">
                      {wp.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Wallpaper URL & Advanced Shell Customization */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="space-y-1.5">
                <label className="font-medium text-white">
                  Custom Wallpaper Image URL (HTTPS or Data URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={preferences.customWallpaperUrl ?? ''}
                    onChange={(e) =>
                      updatePreferences({ customWallpaperUrl: e.target.value })
                    }
                    placeholder="https://images.unsplash.com/photo-..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none"
                  />
                  {preferences.customWallpaperUrl && (
                    <button
                      type="button"
                      onClick={() => updatePreferences({ customWallpaperUrl: '' })}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                {/* Dock Size */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Floating Dock Size</label>
                  <select
                    value={preferences.dockSize}
                    onChange={(e) =>
                      updatePreferences({
                        dockSize: e.target.value as 'COMPACT' | 'NORMAL' | 'LARGE',
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="COMPACT">Compact</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LARGE">Large</option>
                  </select>
                </div>

                {/* Glass Blur Intensity */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Glass Blur Intensity</label>
                  <select
                    value={preferences.glassBlurIntensity}
                    onChange={(e) =>
                      updatePreferences({
                        glassBlurIntensity: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH',
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="LOW">Low Blur</option>
                    <option value="MEDIUM">Medium Blur</option>
                    <option value="HIGH">Ultra Obsidian Blur</option>
                  </select>
                </div>

                {/* Window Opacity */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">
                    Window Opacity ({preferences.windowOpacity}%)
                  </label>
                  <input
                    type="range"
                    min={75}
                    max={100}
                    value={preferences.windowOpacity}
                    onChange={(e) =>
                      updatePreferences({ windowOpacity: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer mt-2"
                  />
                </div>
              </div>
            </div>

            {/* Motion & Performance Quality Tiers */}
            <div className="space-y-2 pt-2">
              <label className="font-medium text-slate-200">
                Obsidian Motion & Compositor Quality
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'EXTREME', label: 'Extreme', desc: 'Parallax + Springs + Dock Zoom' },
                    { id: 'ENHANCED', label: 'Enhanced', desc: 'Springs + Dock Zoom' },
                    { id: 'STANDARD', label: 'Standard', desc: 'Clean Fast Transitions' },
                    { id: 'REDUCED_MOTION', label: 'Reduced Motion', desc: 'Instant Accessibility' },
                  ] as const
                ).map((tier) => {
                  const isActive = preferences.motionQuality === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      data-testid={`motion-tier-${tier.id}`}
                      onClick={() =>
                        updatePreferences({
                          motionQuality: tier.id,
                          reducedMotion: tier.id === 'REDUCED_MOTION',
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs">{tier.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{tier.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Motion & Widgets Toggles */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer">
                <div>
                  <div className="font-medium text-white">Reduced Motion</div>
                  <div className="text-[10px] text-slate-400">
                    Minimize window transitions
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.reducedMotion}
                  onChange={(e) =>
                    updatePreferences({ reducedMotion: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer">
                <div>
                  <div className="font-medium text-white">Desktop Widgets</div>
                  <div className="text-[10px] text-slate-400">
                    Show clock and status cards
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.desktopShowWidgets}
                  onChange={(e) =>
                    updatePreferences({ desktopShowWidgets: e.target.checked })
                  }
                  className="accent-cyan-400"
                />
              </label>
            </div>
          </div>
        )}

        {section === 'audio' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                Sound & Notification Preferences
              </h2>
              <p className="text-slate-400 mt-0.5">
                Control system audio synthesizer output and notification alerts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Master Volume</div>
                  <div className="text-[10px] text-slate-400">
                    Applies to Media Player and system sound effects
                  </div>
                </div>
                <span className="font-mono text-sm text-cyan-400">
                  {preferences.soundVolume}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={preferences.soundVolume}
                onChange={(e) =>
                  updatePreferences({ soundVolume: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <label className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer">
              <div>
                <div className="font-medium text-white">Do Not Disturb (Focus Mode)</div>
                <div className="text-[10px] text-slate-400">
                  Suppress popup banners while working
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.doNotDisturb}
                onChange={(e) =>
                  updatePreferences({ doNotDisturb: e.target.checked })
                }
                className="accent-cyan-400"
              />
            </label>
          </div>
        )}

        {section === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-5 max-w-md">
            <div>
              <h2 className="text-base font-semibold text-white">User Profile</h2>
              <p className="text-slate-400 mt-0.5">
                Manage your active KubekOS workspace identity.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Display Name</label>
              <input
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Role / Title</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              className={`px-4 py-2 rounded-xl ${accent.bgClass} text-slate-950 font-semibold cursor-pointer`}
            >
              Save Profile Changes
            </button>

            {profileSavedMsg && (
              <div className="text-emerald-400 font-medium">
                Profile updated successfully!
              </div>
            )}
          </form>
        )}

        {section === 'storage' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                Virtual Filesystem & IndexedDB Storage
              </h2>
              <p className="text-slate-400 mt-0.5">
                Real-time telemetry of persistent IndexedDB storage in /KubekOS.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Active Files
                </div>
                <div className="text-2xl font-semibold text-white mt-1">
                  {stats.totalFiles}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Directories
                </div>
                <div className="text-2xl font-semibold text-white mt-1">
                  {stats.totalDirectories}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Used Bytes
                </div>
                <div className="text-2xl font-semibold text-cyan-400 mt-1">
                  {(stats.usedBytes / 1024).toFixed(2)} KB
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-medium text-white">
                  Trash Bin ({stats.trashedItems} items)
                </div>
                <div className="text-[10px] text-slate-400">
                  Permanently purge deleted items from IndexedDB
                </div>
              </div>
              <button
                type="button"
                onClick={() => void emptyTrash()}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 cursor-pointer"
              >
                Empty Trash
              </button>
            </div>
          </div>
        )}

        {section === 'privacy' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                Privacy & Sandbox Security
              </h2>
              <p className="text-slate-400 mt-0.5">
                KubekOS runs 100% locally in your browser with strict plugin permission isolation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-medium text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>Zero External Data Transmission</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                All files, notes, calendar events, and user preferences are stored strictly inside your local browser IndexedDB (`KubekOS_PersistentDB`). No external telemetry servers are contacted.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
