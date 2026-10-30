/**
 * KubekOS Login & Lock Screen
 * Provides local user profile selection, session authentication, and system power actions.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, RotateCcw, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS, WALLPAPER_PRESETS } from '@/theme/tokens';

export const LoginScreen: React.FC = () => {
  const users = useKernelStore((state) => state.users);
  const activeUser = useKernelStore((state) => state.activeUser);
  const preferences = useKernelStore((state) => state.preferences);
  const loginUser = useKernelStore((state) => state.loginUser);
  const restartSystem = useKernelStore((state) => state.restartSystem);

  const [selectedUserId, setSelectedUserId] = useState<string>(
    activeUser?.id ?? users[0]?.id ?? 'user-admin'
  );
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? users[0];
  const wallpaper = WALLPAPER_PRESETS[preferences.wallpaperId] ?? WALLPAPER_PRESETS['nebula-dark'];
  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      loginUser(selectedUser.id);
    }
  };

  return (
    <div
      data-testid="login-screen"
      style={{ background: wallpaper.cssBackground }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-between p-8 text-slate-100 select-none"
    >
      {/* Top Clock & Date Display */}
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mt-8 space-y-1"
      >
        <div className="text-6xl font-light tracking-tight text-white drop-shadow-sm">
          {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-sm font-medium text-slate-300 tracking-wide uppercase">
          {clock.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </motion.div>

      {/* Center Glassmorphic Login Card */}
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md rounded-2xl bg-slate-900/75 backdrop-blur-xl border border-slate-700/60 shadow-2xl p-7 space-y-6"
      >
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-[11px] font-medium text-slate-300">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>KubekOS Desktop Environment</span>
          </div>
          <h2 className="text-xl font-semibold text-white">Select Workspace Profile</h2>
          <p className="text-xs text-slate-400">
            Choose a local profile to enter your persistent desktop session
          </p>
        </div>

        {/* Profile Selector */}
        <div className="grid grid-cols-2 gap-3">
          {users.map((user) => {
            const isSelected = user.id === selectedUser?.id;
            const userAccent = ACCENT_COLORS[user.avatarColor] ?? ACCENT_COLORS.cyan;

            return (
              <button
                key={user.id}
                type="button"
                data-testid={`login-profile-${user.username}`}
                onClick={() => setSelectedUserId(user.id)}
                className={`flex flex-col items-center p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? `bg-slate-800/90 ${userAccent.borderClass} ring-2 ${userAccent.ringClass}`
                    : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/50'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-base mb-2 ${userAccent.bgClass}`}
                >
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-white truncate max-w-full">
                  {user.displayName}
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-full">
                  {user.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sign In Action */}
        <form onSubmit={handleLogin} className="space-y-3">
          <button
            type="submit"
            data-testid="login-submit-button"
            className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm text-slate-950 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] cursor-pointer ${accent.bgClass} hover:opacity-95`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Sign in as {selectedUser?.displayName}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </motion.div>

      {/* Bottom Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>IndexedDB Virtual Filesystem Ready</span>
        </div>

        <button
          type="button"
          onClick={restartSystem}
          className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
          <span>Reboot Kernel</span>
        </button>
      </div>
    </div>
  );
};
