/**
 * KubekOS Boot Sequence Screen
 * Renders real-time kernel stage diagnostics and progress during startup.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Cpu, Loader2, ShieldAlert, Terminal } from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';

export const BootScreen: React.FC = () => {
  const bootStages = useKernelStore((state) => state.bootStages);
  const completedCount = bootStages.filter((s) => s.status === 'DONE').length;
  const progressPercent = Math.round((completedCount / bootStages.length) * 100);

  return (
    <div
      data-testid="boot-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950 text-slate-100 p-8 select-none"
    >
      {/* Top hardware / kernel telemetry header */}
      <div className="w-full max-w-2xl flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>KUBEKOS KERNEL v1.0.0-x86_64-WEB</span>
        </div>
        <span>ARCH: BROWSER-SANDBOX-VFS</span>
      </div>

      {/* Center brand emblem and progress bar */}
      <div className="flex flex-col items-center max-w-md w-full my-auto gap-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-2xl shadow-cyan-500/10"
        >
          <Terminal className="w-10 h-10 text-cyan-400" />
          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping" />
        </motion.div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Kubek<span className="text-cyan-400">OS</span>
          </h1>
          <p className="text-xs text-slate-400">
            Initializing modular web desktop environment...
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-2">
          <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            <motion.div
              className="h-full bg-cyan-400 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>SYSTEM INIT</span>
            <span>{progressPercent}%</span>
          </div>
        </div>

        {/* Live Boot Stage Log */}
        <div className="w-full rounded-xl bg-slate-900/60 border border-slate-800/80 p-4 space-y-2.5 font-mono text-xs">
          {bootStages.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {stage.status === 'DONE' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                {stage.status === 'IN_PROGRESS' && (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                )}
                {stage.status === 'PENDING' && (
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                )}
                {stage.status === 'FAILED' && (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )}
                <span
                  className={
                    stage.status === 'DONE'
                      ? 'text-slate-300 truncate'
                      : stage.status === 'IN_PROGRESS'
                        ? 'text-cyan-300 truncate'
                        : 'text-slate-500 truncate'
                  }
                >
                  {stage.label}
                </span>
              </div>
              {stage.durationMs !== undefined && (
                <span className="text-[10px] text-slate-500 shrink-0">
                  {stage.durationMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-[11px] font-mono text-slate-500">
        Protected Sandbox Mode • IndexedDB Persistence Enabled
      </div>
    </div>
  );
};
