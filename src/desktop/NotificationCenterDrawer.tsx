/**
 * KubekOS Notification Center & Quick Settings Drawer
 * Provides quick toggles (Theme, DND, Audio, Widgets, Accent) and notification history.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  CheckCheck,
  LayoutGrid,
  Moon,
  Sun,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useNotificationStore } from '@/notifications/notificationStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { useWindowStore } from '@/wm/windowStore';
import { ACCENT_COLORS } from '@/theme/tokens';

export const NotificationCenterDrawer: React.FC = () => {
  const isOpen = useNotificationStore((s) => s.isCenterOpen);
  const setCenterOpen = useNotificationStore((s) => s.setCenterOpen);
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);

  const preferences = useKernelStore((s) => s.preferences);
  const setThemeMode = useKernelStore((s) => s.setThemeMode);
  const updatePreferences = useKernelStore((s) => s.updatePreferences);
  const openWindow = useWindowStore((s) => s.openWindow);

  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          data-testid="notification-center"
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed top-11 right-3 z-50 w-96 max-w-[calc(100vw-24px)] rounded-2xl bg-[#070b16]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_28px_70px_rgba(0,0,0,0.92)] overflow-hidden flex flex-col select-none"
        >
          {/* Quick Settings Section */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Quick Settings</span>
              <button
                type="button"
                onClick={() => setCenterOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Theme Mode Toggle */}
              <button
                type="button"
                onClick={() =>
                  setThemeMode(preferences.themeMode === 'dark' ? 'light' : 'dark')
                }
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  preferences.themeMode === 'dark'
                    ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                    : 'bg-slate-800/80 border-slate-700 text-slate-200'
                }`}
              >
                {preferences.themeMode === 'dark' ? (
                  <Moon className={`w-4 h-4 ${accent.textClass}`} />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <div className="font-medium">Theme</div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {preferences.themeMode} Mode
                  </div>
                </div>
              </button>

              {/* Do Not Disturb */}
              <button
                type="button"
                onClick={() =>
                  updatePreferences({ doNotDisturb: !preferences.doNotDisturb })
                }
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  preferences.doNotDisturb
                    ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                    : 'bg-slate-800/60 border-slate-800 text-slate-300'
                }`}
              >
                {preferences.doNotDisturb ? (
                  <BellOff className={`w-4 h-4 ${accent.textClass}`} />
                ) : (
                  <Bell className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <div className="font-medium">Focus Mode</div>
                  <div className="text-[10px] text-slate-400">
                    {preferences.doNotDisturb ? 'Alerts Muted' : 'Alerts Active'}
                  </div>
                </div>
              </button>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() =>
                  updatePreferences({
                    soundEffectsEnabled: !preferences.soundEffectsEnabled,
                  })
                }
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  preferences.soundEffectsEnabled
                    ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                    : 'bg-slate-800/60 border-slate-800 text-slate-300'
                }`}
              >
                {preferences.soundEffectsEnabled ? (
                  <Volume2 className={`w-4 h-4 ${accent.textClass}`} />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <div className="font-medium">System Audio</div>
                  <div className="text-[10px] text-slate-400">
                    {preferences.soundEffectsEnabled
                      ? `${preferences.soundVolume}% Volume`
                      : 'Muted'}
                  </div>
                </div>
              </button>

              {/* Desktop Widgets Toggle */}
              <button
                type="button"
                onClick={() =>
                  updatePreferences({
                    desktopShowWidgets: !preferences.desktopShowWidgets,
                  })
                }
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  preferences.desktopShowWidgets
                    ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                    : 'bg-slate-800/60 border-slate-800 text-slate-300'
                }`}
              >
                <LayoutGrid
                  className={`w-4 h-4 ${
                    preferences.desktopShowWidgets ? accent.textClass : 'text-slate-400'
                  }`}
                />
                <div>
                  <div className="font-medium">Widgets</div>
                  <div className="text-[10px] text-slate-400">
                    {preferences.desktopShowWidgets ? 'Visible' : 'Hidden'}
                  </div>
                </div>
              </button>
            </div>

            {/* Volume Slider */}
            <div className="pt-1 flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="range"
                min={0}
                max={100}
                value={preferences.soundVolume}
                onChange={(e) =>
                  updatePreferences({ soundVolume: Number(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
                {preferences.soundVolume}%
              </span>
            </div>
          </div>

          {/* Notifications List */}
          <div className="p-4 flex-1 flex flex-col min-h-[220px] max-h-[320px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white">
                Notifications ({notifications.length})
              </span>
              {notifications.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Read all</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border transition-colors ${
                    n.read
                      ? 'bg-slate-950/40 border-slate-800/60'
                      : 'bg-slate-800/70 border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium text-white">{n.title}</div>
                    <button
                      type="button"
                      onClick={() => removeNotification(n.id)}
                      className="text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(n.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {n.actionLabel && n.actionAppId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (n.actionAppId) openWindow(n.actionAppId);
                          setCenterOpen(false);
                        }}
                        className={`text-[11px] font-medium ${accent.textClass} hover:underline cursor-pointer`}
                      >
                        {n.actionLabel} →
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {notifications.length === 0 && (
                <div className="h-36 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5">
                  <Bell className="w-5 h-5 opacity-40" />
                  <span>No new notifications</span>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
