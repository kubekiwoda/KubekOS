/**
 * KubekOS Terminal Application & Expanded Command Suite
 * Interactive shell operating strictly within the sandboxed Virtual Filesystem.
 * Includes system fetch (neofetch), search (grep, find), text stats (wc, head, tail),
 * hashing/encoding (base64), calc, theme/wallpaper switching, and Google search launcher.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useVfsStore, resolvePath } from '@/vfs/vfsStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useWindowStore } from '@/wm/windowStore';
import { evaluateArithmeticExpression } from './CalculatorApp';
import type { AccentColorId, WallpaperId } from '@/types/os';

export interface TerminalCommandContext {
  cwd: string;
  setCwd: (nextCwd: string) => void;
  args: string[];
  rawInput: string;
}

export type TerminalCommandHandler = (
  ctx: TerminalCommandContext
) => Promise<string | void> | string | void;

const customCommands = new Map<
  string,
  { description: string; handler: TerminalCommandHandler }
>();

export function registerTerminalCommand(
  name: string,
  description: string,
  handler: TerminalCommandHandler
): void {
  customCommands.set(name.toLowerCase(), { description, handler });
}

export async function executeTerminalCommandLine(
  inputLine: string,
  cwd: string,
  setCwd: (dir: string) => void,
  clearOutput: () => void
): Promise<string> {
  const trimmed = inputLine.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(/\s+/);
  const cmd = (parts[0] ?? '').toLowerCase();
  const args = parts.slice(1);
  const vfs = useVfsStore.getState();
  const kernel = useKernelStore.getState();

  switch (cmd) {
    case 'help': {
      const builtInHelp = [
        'KubekOS Obsidian Shell v1.2.0 — Available Commands:',
        '  neofetch / sysinfo   Display KubekOS ASCII emblem & kernel telemetry',
        '  help                 Display this list of available commands',
        '  pwd                  Print current working directory in VFS',
        '  ls [path]            List directory contents',
        '  tree [path]          Render visual directory tree structure',
        '  cd <path>            Change working directory',
        '  mkdir <name>         Create a new directory',
        '  touch <name>         Create an empty file',
        '  write <f> <text>     Write text content into a file',
        '  cp <src> <destDir>   Copy a file or folder into destination directory',
        '  mv <src> <destDir>   Move a file or folder into destination directory',
        '  cat <path>           Print file contents to standard output',
        '  head / tail <path>   Print first or last 5 lines of a file',
        '  wc <path>            Count lines, words, and bytes in a file',
        '  grep <query>         Search for text across all files in VFS',
        '  find <name>          Find files and directories matching name',
        '  rm <path>            Move a file or directory to Trash',
        '  df                   Display Virtual Filesystem disk usage statistics',
        '  ps                   List active running window processes',
        '  kill <windowId>      Terminate a running window process by ID',
        '  calc <expr>          Evaluate math expression (e.g. calc 24 * 7 + 12)',
        '  base64 <enc|dec> <t> Encode or decode Base64 strings',
        '  google <query>       Launch Web Browser with live search query',
        '  theme <dark|light>   Switch system color mode',
        '  accent <color>       Set accent (cyan, blue, indigo, emerald, amber, rose, violet)',
        '  wallpaper <id>       Set wallpaper (nebula-dark, arctic-aurora, obsidian-grid, etc.)',
        '  whoami / date        Display active user or system timestamp',
        '  apps / open <appId>  List or launch installed KubekOS applications',
        '  clear                Clear terminal screen output',
      ];
      return builtInHelp.join('\n');
    }

    case 'neofetch':
    case 'sysinfo': {
      const stats = vfs.getStorageStats();
      const wins = useWindowStore.getState().windows;
      const secs = kernel.uptimeSeconds;
      return [
        '       /\\          kubek@kubekos-obsidian',
        '      /  \\         ----------------------',
        '     / /\\ \\        OS: KubekOS v1.2.0 (Obsidian Aurora)',
        '    / /  \\ \\       Kernel: 1.0.0-x86_64-Browser-Sandbox',
        `   / /    \\ \\      Uptime: ${Math.floor(secs / 60)}m ${secs % 60}s`,
        `  / /      \\ \\     Packages: ${useAppRegistryStore.getState().getAllManifests().length} (Built-in + Plugins)`,
        ' /_/        \\_\\    Shell: kubeksh 1.2.0',
        `                   WM: Obsidian Compositor (${wins.length} active windows)`,
        `                   Theme: ${kernel.preferences.themeMode} (${kernel.preferences.accentColor})`,
        `                   VFS Disk: ${(stats.usedBytes / 1024).toFixed(2)} KB / 50 MB (${stats.totalFiles} files)`,
      ].join('\n');
    }

    case 'pwd':
      return cwd;

    case 'ls': {
      const target = args[0] ? resolvePath(cwd, args[0]) : cwd;
      const node = vfs.getNode(target);
      if (!node) return `ls: cannot access '${target}': No such file or directory`;
      if (node.type === 'FILE') return node.name;
      const children = vfs.listDirectory(target);
      if (children.length === 0) return '(empty directory)';
      return children
        .map((c) => (c.type === 'DIRECTORY' ? `${c.name}/` : c.name))
        .join('  ');
    }

    case 'tree': {
      const target = args[0] ? resolvePath(cwd, args[0]) : cwd;
      const all = Object.values(vfs.nodes).filter(
        (n) => !n.isTrashed && (n.path === target || n.path.startsWith(`${target}/`))
      );
      return all
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((n) => {
          const depth = n.path.split('/').length - target.split('/').length;
          const indent = '  '.repeat(Math.max(0, depth));
          return `${indent}${n.type === 'DIRECTORY' ? '📁' : '📄'} ${n.name}`;
        })
        .join('\n');
    }

    case 'cd': {
      const targetArg = args[0] ?? '/KubekOS';
      const resolved = resolvePath(cwd, targetArg);
      const node = vfs.getNode(resolved);
      if (!node) return `cd: no such file or directory: ${targetArg}`;
      if (node.type !== 'DIRECTORY') return `cd: not a directory: ${targetArg}`;
      setCwd(resolved);
      return '';
    }

    case 'mkdir': {
      const dirName = args[0];
      if (!dirName) return 'mkdir: missing operand';
      try {
        const created = await vfs.createDirectory(cwd, dirName);
        return `Created directory ${created.path}`;
      } catch (err) {
        return `mkdir: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'touch': {
      const fileName = args[0];
      if (!fileName) return 'touch: missing file operand';
      try {
        const created = await vfs.createFile(cwd, fileName, '');
        return `Created file ${created.path}`;
      } catch (err) {
        return `touch: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'write': {
      const fileName = args[0];
      const text = args.slice(1).join(' ');
      if (!fileName) return 'write: usage: write <filename> <content>';
      try {
        const target = resolvePath(cwd, fileName);
        await vfs.writeFile(target, text);
        return `Wrote ${new Blob([text]).size} bytes to ${target}`;
      } catch (err) {
        return `write: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'cp': {
      const [src, dest] = args;
      if (!src || !dest) return 'cp: usage: cp <source> <destDirectory>';
      try {
        const copied = await vfs.copyNode(resolvePath(cwd, src), resolvePath(cwd, dest));
        return `Copied to ${copied.path}`;
      } catch (err) {
        return `cp: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'mv': {
      const [src, dest] = args;
      if (!src || !dest) return 'mv: usage: mv <source> <destDirectory>';
      try {
        const moved = await vfs.moveNode(resolvePath(cwd, src), resolvePath(cwd, dest));
        return `Moved to ${moved.path}`;
      } catch (err) {
        return `mv: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'cat': {
      const fileArg = args[0];
      if (!fileArg) return 'cat: missing file operand';
      const resolved = resolvePath(cwd, fileArg);
      const node = vfs.getNode(resolved);
      if (!node) return `cat: ${fileArg}: No such file or directory`;
      if (node.type === 'DIRECTORY') return `cat: ${fileArg}: Is a directory`;
      return node.content ?? '';
    }

    case 'head':
    case 'tail': {
      const fileArg = args[0];
      if (!fileArg) return `${cmd}: missing file operand`;
      const resolved = resolvePath(cwd, fileArg);
      const node = vfs.getNode(resolved);
      if (!node || node.type !== 'FILE') return `${cmd}: cannot read file: ${fileArg}`;
      const lines = (node.content ?? '').split('\n');
      return (cmd === 'head' ? lines.slice(0, 5) : lines.slice(-5)).join('\n');
    }

    case 'wc': {
      const fileArg = args[0];
      if (!fileArg) return 'wc: missing file operand';
      const resolved = resolvePath(cwd, fileArg);
      const node = vfs.getNode(resolved);
      if (!node || node.type !== 'FILE') return `wc: cannot read file: ${fileArg}`;
      const text = node.content ?? '';
      const lines = text.split('\n').length;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      return `  ${lines} lines   ${words} words   ${node.sizeBytes} bytes  ${node.name}`;
    }

    case 'grep':
    case 'find': {
      const q = args.join(' ');
      if (!q) return `${cmd}: missing search query`;
      const matches = vfs.searchNodes(q);
      if (matches.length === 0) return `No VFS nodes matched "${q}"`;
      return matches.map((m) => `${m.type.padEnd(10)} ${m.path}`).join('\n');
    }

    case 'rm': {
      const targetArg = args[0];
      if (!targetArg) return 'rm: missing operand';
      const resolved = resolvePath(cwd, targetArg);
      try {
        await vfs.moveToTrash(resolved);
        return `Moved ${resolved} to Trash`;
      } catch (err) {
        return `rm: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'df': {
      const s = vfs.getStorageStats();
      return `Filesystem: IndexedDB (Dexie)\nFiles: ${s.totalFiles} | Directories: ${s.totalDirectories} | Trash: ${s.trashedItems}\nUsed: ${(s.usedBytes / 1024).toFixed(2)} KB / Quota: 50,000 KB`;
    }

    case 'ps': {
      const wins = useWindowStore.getState().windows;
      if (wins.length === 0) return 'No active window processes.';
      return wins
        .map((w) => `${w.id.padEnd(28)} [${w.mode.padEnd(9)}] WS:${w.workspaceId} ${w.title}`)
        .join('\n');
    }

    case 'kill': {
      const targetId = args[0];
      if (!targetId) return 'kill: usage: kill <windowId>';
      useWindowStore.getState().closeWindow(targetId);
      return `Sent termination signal to ${targetId}`;
    }

    case 'calc': {
      const expr = args.join('');
      if (!expr) return 'calc: usage: calc <expression>';
      try {
        return `${expr} = ${evaluateArithmeticExpression(expr)}`;
      } catch (err) {
        return `calc error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'base64': {
      const mode = args[0]?.toLowerCase();
      const payload = args.slice(1).join(' ');
      if (!mode || !payload) return 'base64: usage: base64 <enc|dec> <text>';
      try {
        return mode === 'dec' ? atob(payload) : btoa(payload);
      } catch {
        return 'base64: invalid input string';
      }
    }

    case 'google':
    case 'search': {
      const q = args.join(' ');
      useWindowStore.getState().openWindow('browser');
      return q
        ? `Opened Web Browser for query: "${q}"`
        : 'Opened KubekOS Web Browser';
    }

    case 'theme': {
      const mode = args[0]?.toLowerCase();
      if (mode !== 'dark' && mode !== 'light') return 'theme: usage: theme <dark|light>';
      kernel.setThemeMode(mode);
      return `Switched theme mode to ${mode}`;
    }

    case 'accent': {
      const color = args[0]?.toLowerCase() as AccentColorId;
      const valid: AccentColorId[] = ['cyan', 'blue', 'indigo', 'emerald', 'amber', 'rose', 'violet'];
      if (!valid.includes(color)) return `accent: choose from: ${valid.join(', ')}`;
      kernel.setAccentColor(color);
      return `Updated system accent color to ${color}`;
    }

    case 'wallpaper': {
      const wp = args[0]?.toLowerCase() as WallpaperId;
      const valid: WallpaperId[] = [
        'nebula-dark',
        'arctic-aurora',
        'obsidian-grid',
        'sunset-horizon',
        'forest-mist',
        'minimal-slate',
      ];
      if (!valid.includes(wp)) return `wallpaper: choose from: ${valid.join(', ')}`;
      kernel.setWallpaper(wp);
      return `Updated desktop wallpaper to ${wp}`;
    }

    case 'date':
      return new Date().toString();

    case 'echo':
      return args.join(' ');

    case 'whoami': {
      const user = kernel.activeUser;
      return user ? `${user.username} (${user.displayName} — ${user.role})` : 'kubek';
    }

    case 'uname':
      return 'KubekOS 1.2.0-obsidian x86_64 Browser-Sandbox-Kernel IndexedDB-VFS';

    case 'uptime': {
      const secs = kernel.uptimeSeconds;
      return `Session uptime: ${Math.floor(secs / 60)}m ${secs % 60}s`;
    }

    case 'apps': {
      const apps = useAppRegistryStore.getState().getAllManifests();
      return apps.map((a) => `${a.id.padEnd(18)} - ${a.name} (v${a.version})`).join('\n');
    }

    case 'open': {
      const appId = args[0];
      if (!appId) return 'open: specify an application ID (run "apps" to list)';
      const winId = useWindowStore.getState().openWindow(appId);
      return winId ? `Launched ${appId} (${winId})` : `open: unknown application "${appId}"`;
    }

    case 'clear':
      clearOutput();
      return '';

    default: {
      const custom = customCommands.get(cmd);
      if (custom) {
        const res = await custom.handler({ cwd, setCwd, args, rawInput: trimmed });
        return res ?? '';
      }
      return `kubeksh: command not found: ${cmd}. Type "help" for available commands.`;
    }
  }
}

interface OutputEntry {
  id: string;
  cwd: string;
  command: string;
  response: string;
}

export const TerminalApp: React.FC = () => {
  const [cwd, setCwd] = useState('/KubekOS');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [entries, setEntries] = useState<OutputEntry[]>([
    {
      id: 'welcome',
      cwd: '/KubekOS',
      command: 'neofetch',
      response: [
        '       /\\          kubek@kubekos-obsidian',
        '      /  \\         ----------------------',
        '     / /\\ \\        OS: KubekOS v1.2.0 (Obsidian Aurora)',
        '    / /  \\ \\       Shell: kubeksh 1.2.0 (Type "help" for 30+ commands)',
        '   /_/    \\_\\      Try: tree, df, ps, calc 12*8, accent violet, open kanban-board',
      ].join('\n'),
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input;
    setInput('');
    if (!raw.trim()) return;

    setHistory((prev) => [raw, ...prev]);
    setHistoryIdx(-1);

    const currentDir = cwd;
    let cleared = false;
    const output = await executeTerminalCommandLine(
      raw,
      currentDir,
      setCwd,
      () => {
        cleared = true;
        setEntries([]);
      }
    );

    if (!cleared) {
      setEntries((prev) => [
        ...prev,
        {
          id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          cwd: currentDir,
          command: raw,
          response: output,
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIdx + 1 < history.length) {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx] ?? '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx] ?? '');
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setInput('');
      }
    }
  };

  return (
    <div
      data-testid="app-terminal"
      className="h-full bg-[#050811]/95 text-slate-100 font-mono text-xs p-4 overflow-y-auto flex flex-col justify-between select-text"
    >
      <div className="space-y-3">
        {entries.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-400">
              <span className="text-emerald-400">kubek@obsidian</span>
              <span className="text-slate-500">:</span>
              <span className="text-sky-400">{item.cwd}</span>
              <span className="text-slate-400">$</span>
              <span className="text-white">{item.command}</span>
            </div>
            {item.response && (
              <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed pl-2">
                {item.response}
              </pre>
            )}
          </div>
        ))}

        {/* Active Command Input Line */}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-2 pt-1">
          <span className="text-emerald-400 shrink-0">kubek@obsidian</span>
          <span className="text-slate-500">:</span>
          <span className="text-sky-400 shrink-0">{cwd}</span>
          <span className="text-slate-400">$</span>
          <input
            type="text"
            autoFocus
            data-testid="terminal-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white focus:outline-none"
            placeholder="Type a command (help, neofetch, tree, df, ps, calc)..."
          />
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
