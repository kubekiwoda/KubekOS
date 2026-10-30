/**
 * KubekOS Code Studio (Code Editor) Application
 * Supports multiple tabs, line numbers, language detection, dirty state indicator,
 * and direct reading/saving to the Virtual Filesystem.
 */

import React, { useState, useEffect } from 'react';
import { FileCode, FolderOpen, Plus, Save, X } from 'lucide-react';
import { useVfsStore } from '@/vfs/vfsStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';

interface EditorTab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  language: string;
}

function detectLanguage(name: string): string {
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'TypeScript';
  if (name.endsWith('.js') || name.endsWith('.jsx')) return 'JavaScript';
  if (name.endsWith('.json')) return 'JSON';
  if (name.endsWith('.md')) return 'Markdown';
  if (name.endsWith('.css')) return 'CSS';
  if (name.endsWith('.html')) return 'HTML';
  return 'PlainText';
}

export interface CodeEditorAppProps {
  initialFilePath?: string;
}

export const CodeEditorApp: React.FC<CodeEditorAppProps> = ({ initialFilePath }) => {
  const nodesMap = useVfsStore((s) => s.nodes);
  const writeFile = useVfsStore((s) => s.writeFile);
  const accentColor = useKernelStore((s) => s.preferences.accentColor);
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS.cyan;

  const defaultFiles = [
    '/KubekOS/Documents/Projects/hello_kubekos.ts',
    '/KubekOS/Documents/Projects/theme_tokens.json',
  ];

  const [tabs, setTabs] = useState<EditorTab[]>(() => {
    const pathsToOpen = initialFilePath ? [initialFilePath] : defaultFiles;
    const initialTabs: EditorTab[] = [];
    for (const p of pathsToOpen) {
      const node = useVfsStore.getState().getNode(p);
      if (node && node.type === 'FILE') {
        initialTabs.push({
          path: node.path,
          name: node.name,
          content: node.content ?? '',
          savedContent: node.content ?? '',
          language: detectLanguage(node.name),
        });
      }
    }
    if (initialTabs.length === 0) {
      initialTabs.push({
        path: '/KubekOS/Documents/Projects/untitled.ts',
        name: 'untitled.ts',
        content: '// Write TypeScript code here\n',
        savedContent: '// Write TypeScript code here\n',
        language: 'TypeScript',
      });
    }
    return initialTabs;
  });

  const [activePath, setActivePath] = useState<string>(
    initialFilePath ?? tabs[0]?.path ?? '/KubekOS/Documents/Projects/hello_kubekos.ts'
  );
  const [statusMessage, setStatusMessage] = useState<string>('Ready');

  useEffect(() => {
    if (!initialFilePath) return;
    const node = useVfsStore.getState().getNode(initialFilePath);
    if (!node || node.type !== 'FILE') return;

    setTabs((prev) => {
      if (prev.some((t) => t.path === node.path)) return prev;
      return [
        ...prev,
        {
          path: node.path,
          name: node.name,
          content: node.content ?? '',
          savedContent: node.content ?? '',
          language: detectLanguage(node.name),
        },
      ];
    });
    setActivePath(node.path);
  }, [initialFilePath]);

  const activeTab = tabs.find((t) => t.path === activePath) ?? tabs[0];

  const handleContentChange = (value: string) => {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) => (t.path === activeTab.path ? { ...t, content: value } : t))
    );
  };

  const handleSave = async () => {
    if (!activeTab) return;
    await writeFile(activeTab.path, activeTab.content);
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activeTab.path ? { ...t, savedContent: t.content } : t
      )
    );
    setStatusMessage(`Saved ${activeTab.path} at ${new Date().toLocaleTimeString()}`);
  };

  const handleNewTab = () => {
    const idx = tabs.length + 1;
    const newPath = `/KubekOS/Documents/Projects/script_${idx}.ts`;
    const newTab: EditorTab = {
      path: newPath,
      name: `script_${idx}.ts`,
      content: `// KubekOS Script ${idx}\nexport const version = ${idx};\n`,
      savedContent: '',
      language: 'TypeScript',
    };
    setTabs((prev) => [...prev, newTab]);
    setActivePath(newPath);
  };

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = tabs.filter((t) => t.path !== path);
    setTabs(remaining);
    if (activePath === path && remaining[0]) {
      setActivePath(remaining[0].path);
    }
  };

  const openFromVfs = (path: string) => {
    const node = nodesMap[path];
    if (!node || node.type !== 'FILE') return;
    if (!tabs.some((t) => t.path === path)) {
      setTabs((prev) => [
        ...prev,
        {
          path: node.path,
          name: node.name,
          content: node.content ?? '',
          savedContent: node.content ?? '',
          language: detectLanguage(node.name),
        },
      ]);
    }
    setActivePath(path);
  };

  const allVfsFiles = Object.values(nodesMap).filter(
    (n) => n.type === 'FILE' && !n.isTrashed && !n.mimeType?.startsWith('image/')
  );

  const lineCount = activeTab ? activeTab.content.split('\n').length : 1;

  return (
    <div data-testid="app-code-editor" className="h-full flex flex-col text-xs select-none">
      {/* Top Tab Bar & Actions */}
      <div className="flex items-center justify-between bg-slate-900/90 border-b border-slate-800 px-2 pt-1.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isDirty = tab.content !== tab.savedContent;
            const isActive = tab.path === activeTab?.path;

            return (
              <div
                key={tab.path}
                onClick={() => setActivePath(tab.path)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-slate-950 border-slate-700 text-white'
                    : 'bg-slate-900/50 border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${accent.textClass}`} />
                <span className="truncate max-w-[140px]">{tab.name}</span>
                {isDirty && (
                  <span
                    title="Unsaved changes"
                    className={`w-2 h-2 rounded-full ${accent.bgClass}`}
                  />
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => closeTab(tab.path, e)}
                    className="text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleNewTab}
            className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
            title="New Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 pb-1">
          <button
            type="button"
            data-testid="code-editor-save"
            onClick={() => void handleSave()}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg ${accent.bgClass} text-slate-950 font-medium cursor-pointer`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save (VFS)</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 min-h-0 flex">
        {/* Left Project Files Explorer */}
        <aside className="w-48 border-r border-slate-800 bg-slate-900/40 p-2.5 overflow-y-auto shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase text-slate-400">
            <FolderOpen className="w-3 h-3" />
            <span>VFS Workspace Files</span>
          </div>
          <div className="mt-1 space-y-0.5">
            {allVfsFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => openFromVfs(file.path)}
                className={`w-full text-left px-2 py-1.5 rounded-lg truncate transition-colors cursor-pointer ${
                  activeTab?.path === file.path
                    ? `${accent.subtleBgClass} ${accent.textClass} font-medium`
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Code Editing Surface with Line Numbers */}
        <div className="flex-1 flex bg-slate-950 font-mono text-xs overflow-hidden">
          <div className="w-11 py-3 bg-slate-900/50 border-r border-slate-800/80 text-right pr-2.5 text-slate-600 select-none overflow-hidden">
            {Array.from({ length: lineCount }).map((_, idx) => (
              <div key={idx} className="leading-6">
                {idx + 1}
              </div>
            ))}
          </div>
          <textarea
            data-testid="code-editor-textarea"
            value={activeTab?.content ?? ''}
            onChange={(e) => handleContentChange(e.target.value)}
            spellCheck={false}
            className="flex-1 p-3 bg-transparent text-slate-100 leading-6 focus:outline-none resize-none overflow-y-auto font-mono"
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="px-3.5 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>{activeTab?.path}</span>
        <div className="flex items-center gap-4">
          <span>{statusMessage}</span>
          <span className={accent.textClass}>{activeTab?.language}</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
