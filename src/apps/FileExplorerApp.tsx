/**
 * KubekOS File Explorer Application
 * Full-featured file manager supporting directory navigation, create file/folder,
 * rename, copy/paste, cut/move, Trash & recovery, search, and JSON/file import & export.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  ArrowUp,
  ClipboardPaste,
  Copy,
  Download,
  Edit3,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  RotateCcw,
  Scissors,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useVfsStore } from '@/vfs/vfsStore';
import { useWindowStore } from '@/wm/windowStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { useNotificationStore } from '@/notifications/notificationStore';
import { ACCENT_COLORS } from '@/theme/tokens';
import type { VfsNode } from '@/types/os';

const QUICK_LOCATIONS = [
  { label: 'Root (/KubekOS)', path: '/KubekOS' },
  { label: 'Desktop', path: '/KubekOS/Desktop' },
  { label: 'Documents', path: '/KubekOS/Documents' },
  { label: 'Projects', path: '/KubekOS/Documents/Projects' },
  { label: 'Notes', path: '/KubekOS/Documents/Notes' },
  { label: 'Downloads', path: '/KubekOS/Downloads' },
  { label: 'Pictures', path: '/KubekOS/Pictures' },
  { label: 'Music', path: '/KubekOS/Music' },
  { label: 'System', path: '/KubekOS/System' },
];

export interface FileExplorerAppProps {
  initialPath?: string;
}

export const FileExplorerApp: React.FC<FileExplorerAppProps> = ({
  initialPath = '/KubekOS',
}) => {
  const nodesMap = useVfsStore((s) => s.nodes);
  const createFile = useVfsStore((s) => s.createFile);
  const createDirectory = useVfsStore((s) => s.createDirectory);
  const renameNode = useVfsStore((s) => s.renameNode);
  const copyNode = useVfsStore((s) => s.copyNode);
  const moveNode = useVfsStore((s) => s.moveNode);
  const moveToTrash = useVfsStore((s) => s.moveToTrash);
  const restoreFromTrash = useVfsStore((s) => s.restoreFromTrash);
  const deletePermanently = useVfsStore((s) => s.deletePermanently);
  const emptyTrash = useVfsStore((s) => s.emptyTrash);
  const exportSubtreeJson = useVfsStore((s) => s.exportSubtreeJson);

  const openWindow = useWindowStore((s) => s.openWindow);
  const pushNotification = useNotificationStore((s) => s.pushNotification);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [viewMode, setViewMode] = useState<'BROWSE' | 'TRASH'>('BROWSE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{
    path: string;
    mode: 'COPY' | 'MOVE';
  } | null>(null);

  // Dialog prompts inside the window (no browser window.prompt!)
  const [promptMode, setPromptMode] = useState<
    null | 'NEW_FILE' | 'NEW_FOLDER' | 'RENAME'
  >(null);
  const [promptValue, setPromptValue] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const all = Object.values(nodesMap);
    if (viewMode === 'TRASH') {
      return all
        .filter((n) => n.isTrashed)
        .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return all.filter(
        (n) =>
          !n.isTrashed &&
          (n.name.toLowerCase().includes(q) ||
            (n.content && n.content.toLowerCase().includes(q)))
      );
    }
    return all
      .filter((n) => n.parentPath === currentPath && !n.isTrashed)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'DIRECTORY' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [nodesMap, viewMode, searchQuery, currentPath]);

  const navigateUp = () => {
    const node = nodesMap[currentPath];
    if (node?.parentPath) {
      setCurrentPath(node.parentPath);
      setSelectedPath(null);
    }
  };

  const handleOpenItem = (node: VfsNode) => {
    if (viewMode === 'TRASH') return;
    if (node.type === 'DIRECTORY') {
      setCurrentPath(node.path);
      setSelectedPath(null);
      setSearchQuery('');
      return;
    }

    if (node.mimeType?.startsWith('image/')) {
      openWindow('image-viewer', { filePath: node.path }, `${node.name} — Image Viewer`);
    } else if (node.mimeType?.startsWith('audio/')) {
      openWindow('media-player', { filePath: node.path });
    } else {
      openWindow('code-editor', { filePath: node.path });
    }
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    const val = promptValue.trim();
    if (!val) return;

    try {
      if (promptMode === 'NEW_FILE') {
        const created = await createFile(currentPath, val, '');
        setSelectedPath(created.path);
      } else if (promptMode === 'NEW_FOLDER') {
        const created = await createDirectory(currentPath, val);
        setSelectedPath(created.path);
      } else if (promptMode === 'RENAME' && selectedPath) {
        const renamed = await renameNode(selectedPath, val);
        setSelectedPath(renamed.path);
      }
      setPromptMode(null);
      setPromptValue('');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    }
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    setErrorBanner(null);
    try {
      if (clipboard.mode === 'COPY') {
        await copyNode(clipboard.path, currentPath);
      } else {
        await moveNode(clipboard.path, currentPath);
        setClipboard(null);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExportFolder = () => {
    const json = exportSubtreeJson(currentPath);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kubekos_vfs_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushNotification({
      title: 'VFS Export Complete',
      message: `Exported directory ${currentPath} to JSON archive.`,
      sourceAppId: 'file-explorer',
    });
  };

  const handleFileImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrorBanner(null);

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        await createFile(currentPath, file.name, text);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : String(err));
      }
    }
    e.target.value = '';
    pushNotification({
      title: 'File Imported',
      message: `Imported ${files.length} file(s) into ${currentPath}.`,
      sourceAppId: 'file-explorer',
    });
  };

  const selectedNode = selectedPath ? nodesMap[selectedPath] : undefined;

  return (
    <div data-testid="app-file-explorer" className="h-full flex flex-col text-xs select-none">
      {/* Top Action Toolbar */}
      <div className="p-2.5 border-b border-slate-800/80 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={navigateUp}
            disabled={currentPath === '/KubekOS' || viewMode === 'TRASH'}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer"
            title="Up One Level"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-slate-200 min-w-[200px]">
            {viewMode === 'TRASH' ? 'Trash Bin (/KubekOS/.Trash)' : currentPath}
          </div>
        </div>

        {/* File Operations */}
        {viewMode === 'BROWSE' ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              data-testid="vfs-new-file-btn"
              onClick={() => {
                setPromptMode('NEW_FILE');
                setPromptValue('note.md');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>New File</span>
            </button>

            <button
              type="button"
              data-testid="vfs-new-folder-btn"
              onClick={() => {
                setPromptMode('NEW_FOLDER');
                setPromptValue('New_Folder');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>New Folder</span>
            </button>

            {selectedNode && !selectedNode.isSystemProtected && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPromptMode('RENAME');
                    setPromptValue(selectedNode.name);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Rename"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setClipboard({ path: selectedNode.path, mode: 'COPY' })}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setClipboard({ path: selectedNode.path, mode: 'MOVE' })}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Cut / Move"
                >
                  <Scissors className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="vfs-trash-btn"
                  onClick={() => {
                    void moveToTrash(selectedNode.path);
                    setSelectedPath(null);
                  }}
                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 cursor-pointer"
                  title="Move to Trash"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {clipboard && (
              <button
                type="button"
                onClick={() => void handlePaste()}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${accent.bgClass} text-slate-950 font-medium cursor-pointer`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Import Local File"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => void handleFileImportChange(e)}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleExportFolder}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Export Directory as JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {selectedNode && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void restoreFromTrash(selectedNode.path);
                    setSelectedPath(null);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deletePermanently(selectedNode.path);
                    setSelectedPath(null);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Permanently</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void emptyTrash()}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 cursor-pointer"
            >
              Empty Trash
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="relative w-44">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Inline Dialog Bar for Create / Rename */}
      {promptMode && (
        <form
          onSubmit={(e) => void handlePromptSubmit(e)}
          className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2"
        >
          <span className="font-medium text-cyan-300">
            {promptMode === 'NEW_FILE'
              ? 'New File Name:'
              : promptMode === 'NEW_FOLDER'
                ? 'New Folder Name:'
                : 'Rename To:'}
          </span>
          <input
            type="text"
            autoFocus
            data-testid="vfs-prompt-input"
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none"
          />
          <button
            type="submit"
            data-testid="vfs-prompt-confirm"
            className={`px-3 py-1 rounded-lg ${accent.bgClass} text-slate-950 font-medium cursor-pointer`}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setPromptMode(null)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {errorBanner && (
        <div className="px-4 py-2 bg-rose-500/20 border-b border-rose-500/40 text-rose-200 flex items-center justify-between">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split View */}
      <div className="flex-1 min-h-0 flex">
        {/* Left Navigation Sidebar */}
        <aside className="w-48 border-r border-slate-800/80 bg-slate-900/40 p-2.5 flex flex-col justify-between shrink-0">
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono uppercase text-slate-400">
              Locations
            </div>
            {QUICK_LOCATIONS.map((loc) => {
              const active = viewMode === 'BROWSE' && currentPath === loc.path;
              return (
                <button
                  key={loc.path}
                  type="button"
                  onClick={() => {
                    setViewMode('BROWSE');
                    setCurrentPath(loc.path);
                    setSelectedPath(null);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    active
                      ? `${accent.subtleBgClass} ${accent.textClass} font-medium`
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{loc.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setViewMode('TRASH');
                setSelectedPath(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'TRASH'
                  ? 'bg-rose-500/20 text-rose-300 font-medium'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Trash</span>
              </span>
            </button>
          </div>
        </aside>

        {/* Right Directory Content Grid */}
        <div
          onClick={() => setSelectedPath(null)}
          className="flex-1 p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 content-start"
        >
          {items.map((node) => {
            const isSelected = selectedPath === node.path;
            return (
              <div
                key={node.path}
                data-testid={`vfs-item-${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPath(node.path);
                }}
                onDoubleClick={() => handleOpenItem(node)}
                className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? `${accent.subtleBgClass} ${accent.borderClass} ring-1 ${accent.ringClass}`
                    : 'bg-slate-900/50 border-slate-800/70 hover:bg-slate-800/60'
                }`}
              >
                {node.type === 'DIRECTORY' ? (
                  <Folder className={`w-9 h-9 mb-2 ${accent.textClass}`} />
                ) : (
                  <FileText className="w-9 h-9 mb-2 text-slate-300" />
                )}
                <span className="font-medium text-white truncate max-w-full">
                  {node.name}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {node.type === 'DIRECTORY'
                    ? 'Directory'
                    : `${node.sizeBytes} B`}
                </span>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-500">
              {viewMode === 'TRASH'
                ? 'Trash is empty.'
                : 'This folder is empty. Use "New File" or "New Folder" above.'}
            </div>
          )}
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="px-3.5 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span>{items.length} item(s)</span>
        <span>
          {selectedNode
            ? `Selected: ${selectedNode.name} (${selectedNode.type})`
            : 'Double-click any folder to enter or file to open'}
        </span>
      </div>
    </div>
  );
};
