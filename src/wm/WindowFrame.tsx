/**
 * KubekOS Window Frame Component — OBSIDIAN AURORA Edition
 * Features spring-based opening, fluid spatial snapping & maximizing transitions,
 * active neon border aura, 8-way resizing, and workspace-aware visibility.
 */

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Columns2,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Minus,
  Square,
  X,
} from 'lucide-react';
import type { WindowInstance, WindowSnapRegion } from '@/types/os';
import { useWindowStore } from './windowStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS, DESIGN_TOKENS, getMotionPreset } from '@/theme/tokens';
import { OsIcon } from '@/components/ui/OsIcon';

export interface WindowFrameProps {
  windowInstance: WindowInstance;
  children: React.ReactNode;
}

const SNAP_OPTIONS: { region: WindowSnapRegion; label: string }[] = [
  { region: 'LEFT_HALF', label: 'Left Half' },
  { region: 'RIGHT_HALF', label: 'Right Half' },
  { region: 'TOP_LEFT', label: 'Top Left' },
  { region: 'TOP_RIGHT', label: 'Top Right' },
  { region: 'BOTTOM_LEFT', label: 'Bottom Left' },
  { region: 'BOTTOM_RIGHT', label: 'Bottom Right' },
  { region: 'MAXIMIZE', label: 'Full Screen' },
];

export const WindowFrame: React.FC<WindowFrameProps> = ({ windowInstance, children }) => {
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const snapWindow = useWindowStore((s) => s.snapWindow);

  const preferences = useKernelStore((s) => s.preferences);
  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;
  const motionPreset = getMotionPreset(
    preferences.motionQuality,
    preferences.reducedMotion
  );

  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [isDraggingOrResizing, setIsDraggingOrResizing] = useState(false);
  const dragEdgeSnapCandidate = useRef<WindowSnapRegion | null>(null);
  const [snapPreview, setSnapPreview] = useState<WindowSnapRegion | null>(null);

  if (windowInstance.mode === 'MINIMIZED') {
    return null;
  }

  const { id, title, icon, bounds, isFocused, zIndex, mode, isResizable } = windowInstance;

  const handleTitleBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    focusWindow(id);
    setIsDraggingOrResizing(true);

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const initialX = bounds.x;
    const initialY = bounds.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startMouseX;
      const dy = moveEvent.clientY - startMouseY;
      const nextX = initialX + dx;
      const nextY = initialY + dy;

      moveWindow(id, nextX, nextY);

      const vw = window.innerWidth;
      if (moveEvent.clientX <= 14) {
        dragEdgeSnapCandidate.current = 'LEFT_HALF';
        setSnapPreview('LEFT_HALF');
      } else if (moveEvent.clientX >= vw - 14) {
        dragEdgeSnapCandidate.current = 'RIGHT_HALF';
        setSnapPreview('RIGHT_HALF');
      } else if (moveEvent.clientY <= 40) {
        dragEdgeSnapCandidate.current = 'MAXIMIZE';
        setSnapPreview('MAXIMIZE');
      } else {
        dragEdgeSnapCandidate.current = null;
        setSnapPreview(null);
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setIsDraggingOrResizing(false);
      if (dragEdgeSnapCandidate.current) {
        snapWindow(id, dragEdgeSnapCandidate.current);
        dragEdgeSnapCandidate.current = null;
        setSnapPreview(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    direction: 'e' | 's' | 'se' | 'w' | 'sw'
  ) => {
    if (!isResizable) return;
    e.preventDefault();
    e.stopPropagation();
    focusWindow(id);
    setIsDraggingOrResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startBounds = { ...bounds };

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let nextX = startBounds.x;
      let nextY = startBounds.y;
      let nextW = startBounds.width;
      let nextH = startBounds.height;

      if (direction.includes('e')) {
        nextW = Math.max(windowInstance.minWidth, startBounds.width + dx);
      }
      if (direction.includes('s')) {
        nextH = Math.max(windowInstance.minHeight, startBounds.height + dy);
      }
      if (direction.includes('w')) {
        const proposedW = startBounds.width - dx;
        if (proposedW >= windowInstance.minWidth) {
          nextW = proposedW;
          nextX = startBounds.x + dx;
        }
      }

      resizeWindow(id, { x: nextX, y: nextY, width: nextW, height: nextH });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setIsDraggingOrResizing(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const toggleMaximize = () => {
    if (mode === 'MAXIMIZED') {
      restoreWindow(id);
    } else {
      maximizeWindow(id);
    }
  };

  return (
    <>
      {/* Hyprland-inspired Glowing Edge Snap Preview */}
      {snapPreview && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`fixed z-40 pointer-events-none rounded-2xl border-2 ${accent.borderClass} bg-cyan-400/10 backdrop-blur-md shadow-[0_0_40px_rgba(6,182,212,0.25)]`}
          style={{
            top: 42,
            bottom: 84,
            left: snapPreview === 'RIGHT_HALF' ? '50%' : 10,
            right: snapPreview === 'LEFT_HALF' ? '50%' : 10,
          }}
        />
      )}

      <motion.section
        data-testid={`window-${windowInstance.appId}`}
        initial={{ opacity: 0, scale: 0.92, y: 18 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
        }}
        transition={
          isDraggingOrResizing
            ? { duration: 0 }
            : motionPreset.windowOpenSpring
        }
        onPointerDown={() => {
          if (!isFocused) focusWindow(id);
        }}
        style={{ zIndex }}
        className={`fixed flex flex-col overflow-hidden ${
          mode === 'MAXIMIZED' ? 'rounded-none' : DESIGN_TOKENS.radius.window
        } ${
          isFocused
            ? `${DESIGN_TOKENS.glass.windowFocused} ring-1 ${accent.ringClass}`
            : `${DESIGN_TOKENS.glass.windowUnfocused} opacity-95`
        }`}
      >
        {/* Top Ambient Accent Line on Focused Window */}
        {isFocused && (
          <div
            className={`h-[2px] w-full ${accent.bgClass} opacity-80 shrink-0`}
          />
        )}

        {/* Window Titlebar */}
        <div
          onPointerDown={handleTitleBarPointerDown}
          onDoubleClick={toggleMaximize}
          className={`h-10 px-3.5 flex items-center justify-between border-b select-none shrink-0 ${
            isFocused
              ? 'bg-[#090e1c]/95 border-white/[0.09] text-slate-100'
              : 'bg-[#060913]/85 border-white/[0.05] text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-1.5 rounded-lg ${accent.subtleBgClass} ${accent.textClass} border border-white/[0.06]`}
            >
              <OsIcon name={icon} className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold tracking-tight truncate">{title}</span>
          </div>

          {/* Window Controls */}
          <div className="flex items-center gap-1 relative">
            {isResizable && (
              <div className="relative">
                <button
                  type="button"
                  title="Snap Window Layout"
                  onClick={() => setShowSnapMenu((v) => !v)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>

                {showSnapMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`absolute right-0 top-8 z-50 w-48 rounded-xl ${DESIGN_TOKENS.glass.popover} p-2 space-y-1`}
                  >
                    <div className="px-2 py-1 text-[10px] font-mono uppercase text-cyan-400">
                      Spatial Snap Tiling
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {SNAP_OPTIONS.map((opt) => (
                        <button
                          key={opt.region}
                          type="button"
                          onClick={() => {
                            snapWindow(id, opt.region);
                            setShowSnapMenu(false);
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors cursor-pointer ${
                            windowInstance.snapRegion === opt.region
                              ? `${accent.subtleBgClass} ${accent.textClass} font-medium`
                              : 'text-slate-300 hover:bg-white/[0.08]'
                          } ${opt.region === 'MAXIMIZE' ? 'col-span-2 justify-center' : ''}`}
                        >
                          <Columns2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            <button
              type="button"
              title="Minimize"
              data-testid={`window-minimize-${windowInstance.appId}`}
              onClick={() => minimizeWindow(id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {isResizable ? (
              <button
                type="button"
                title={mode === 'MAXIMIZED' ? 'Restore' : 'Maximize'}
                data-testid={`window-maximize-${windowInstance.appId}`}
                onClick={toggleMaximize}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                {mode === 'MAXIMIZED' ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="p-1.5 text-slate-600 cursor-not-allowed">
                <Square className="w-3 h-3" />
              </span>
            )}

            <button
              type="button"
              title="Close Window"
              data-testid={`window-close-${windowInstance.appId}`}
              onClick={() => closeWindow(id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500/85 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Window Content Viewport */}
        <div
          onClick={() => {
            if (showSnapMenu) setShowSnapMenu(false);
          }}
          className="flex-1 min-h-0 overflow-auto bg-[#050811]/75 text-slate-100 relative"
        >
          {children}
        </div>

        {/* 8-Way Resize Handles */}
        {isResizable && mode !== 'MAXIMIZED' && (
          <>
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'e')}
              className="absolute top-2 bottom-2 right-0 w-1.5 cursor-ew-resize"
            />
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'w')}
              className="absolute top-2 bottom-2 left-0 w-1.5 cursor-ew-resize"
            />
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 's')}
              className="absolute bottom-0 left-2 right-2 h-1.5 cursor-ns-resize"
            />
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'se')}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            />
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
              className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize"
            />
          </>
        )}
      </motion.section>
    </>
  );
};
