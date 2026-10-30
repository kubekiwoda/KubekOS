/**
 * KubekOS Notes Application
 * Create, edit, search, and automatically persist notes inside /KubekOS/Documents/Notes.
 */

import React, { useState, useMemo } from 'react';
import { FilePlus, Search, StickyNote, Trash2 } from 'lucide-react';
import { useVfsStore } from '@/vfs/vfsStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';

const NOTES_DIR = '/KubekOS/Documents/Notes';

export const NotesApp: React.FC = () => {
  const nodesMap = useVfsStore((s) => s.nodes);
  const createFile = useVfsStore((s) => s.createFile);
  const writeFile = useVfsStore((s) => s.writeFile);
  const moveToTrash = useVfsStore((s) => s.moveToTrash);

  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const [searchQuery, setSearchQuery] = useState('');

  const notes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return Object.values(nodesMap)
      .filter(
        (n) =>
          n.parentPath === NOTES_DIR &&
          n.type === 'FILE' &&
          !n.isTrashed &&
          (!q ||
            n.name.toLowerCase().includes(q) ||
            (n.content && n.content.toLowerCase().includes(q)))
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [nodesMap, searchQuery]);

  const [selectedPath, setSelectedPath] = useState<string | null>(
    () => notes[0]?.path ?? null
  );

  const activeNote =
    notes.find((n) => n.path === selectedPath) ?? notes[0] ?? null;

  const handleCreateNote = async () => {
    const fileName = `Note_${new Date().toISOString().slice(0, 10)}_${Math.floor(
      Math.random() * 900 + 100
    )}.md`;
    const created = await createFile(
      NOTES_DIR,
      fileName,
      `# ${fileName.replace('.md', '')}\n\nWrite your thoughts here...`
    );
    setSelectedPath(created.path);
  };

  const handleNoteChange = (content: string) => {
    if (!activeNote) return;
    void writeFile(activeNote.path, content);
  };

  return (
    <div data-testid="app-notes" className="h-full flex text-xs select-none">
      {/* Left Notes List */}
      <aside className="w-60 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <StickyNote className={`w-4 h-4 ${accent.textClass}`} />
              <span>Notes ({notes.length})</span>
            </span>
            <button
              type="button"
              data-testid="notes-create-btn"
              onClick={() => void handleCreateNote()}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${accent.bgClass} text-slate-950 font-medium cursor-pointer`}
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.map((note) => {
            const isSelected = activeNote?.path === note.path;
            return (
              <div
                key={note.path}
                onClick={() => setSelectedPath(note.path)}
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="font-medium truncate">{note.name}</div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  {note.content?.slice(0, 60) || 'Empty note'}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right Note Editor */}
      <div className="flex-1 flex flex-col bg-slate-950/60">
        {activeNote ? (
          <>
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">{activeNote.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Auto-saved to {activeNote.path}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void moveToTrash(activeNote.path)}
                className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                title="Delete Note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              data-testid="notes-editor-textarea"
              value={activeNote.content ?? ''}
              onChange={(e) => handleNoteChange(e.target.value)}
              className="flex-1 p-4 bg-transparent text-slate-100 text-sm leading-relaxed focus:outline-none resize-none"
              placeholder="Start typing your note..."
            />
          </>
        ) : (
          <div className="m-auto text-center text-slate-500 space-y-2">
            <StickyNote className="w-8 h-8 mx-auto opacity-40" />
            <div>No note selected. Click "New" to create one.</div>
          </div>
        )}
      </div>
    </div>
  );
};
