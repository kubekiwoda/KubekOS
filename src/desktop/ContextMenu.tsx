/**
 * KubekOS Desktop Context Menu
 * Renders right-click actions with keyboard shortcut badges and viewport boundary clamping.
 */

import React, { useEffect } from 'react';
import { useDesktopStore } from './desktopStore';
import { OsIcon } from '@/components/ui/OsIcon';

export const ContextMenu: React.FC = () => {
  const contextMenu = useDesktopStore((s) => s.contextMenu);
  const closeContextMenu = useDesktopStore((s) => s.closeContextMenu);

  useEffect(() => {
    if (!contextMenu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  const menuWidth = 220;
  const menuHeight = contextMenu.items.length * 36 + 16;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight - 52 : 740;

  const left = Math.min(contextMenu.x, vw - menuWidth - 8);
  const top = Math.min(contextMenu.y, vh - menuHeight - 8);

  return (
    <div
      data-testid="desktop-context-menu"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 w-56 rounded-xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 shadow-2xl p-1.5 text-xs text-slate-200 select-none"
    >
      {contextMenu.items.map((item) => (
        <React.Fragment key={item.id}>
          <button
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              closeContextMenu();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed'
                : item.danger
                  ? 'text-rose-400 hover:bg-rose-500/15'
                  : 'hover:bg-slate-800/90 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {item.icon && <OsIcon name={item.icon} className="w-3.5 h-3.5 text-slate-400" />}
              <span>{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-[10px] font-mono text-slate-400">{item.shortcut}</span>
            )}
          </button>
          {item.separatorAfter && <div className="my-1 border-t border-slate-800" />}
        </React.Fragment>
      ))}
    </div>
  );
};
