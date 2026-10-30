/**
 * KubekOS Terminal Application & Custom Command Registry
 * Interactive shell operating strictly within the sandboxed Virtual Filesystem.
 * Never executes arbitrary host operating system commands.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useVfsStore, resolvePath } from '@/vfs/vfsStore';
import { useKernelStore } from '@/kernel/kernelStore';
import { useAppRegistryStore } from '@/apps/appRegistry';
import { useWindowStore } from '@/wm/windowStore';

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

  switch (cmd) {
    case 'help': {
      const builtInHelp = [
        'KubekOS Sandboxed Shell v1.0.0 — Built-in Commands:',
        '  help              Display this list of available commands',
        '  pwd               Print current working directory in VFS',
        '  ls [path]         List directory contents',
        '  cd <path>         Change working directory',
        '  mkdir <name>      Create a new directory',
        '  touch <name>      Create an empty file',
        '  write <f> <text>  Write text content into a file',
        '  cat <path>        Print file contents to standard output',
        '  rm <path>         Move a file or directory to Trash',
        '  whoami            Display active KubekOS user profile',
        '  uname             Display KubekOS kernel architecture info',
        '  uptime            Display current session uptime',
        '  apps              List installed KubekOS applications',
        '  open <appId>      Launch a registered application window',
        '  clear             Clear terminal screen output',
      ];
      if (customCommands.size > 0) {
        builtInHelp.push('\nRegistered Plugin / Custom Commands:');
        for (const [name, meta] of customCommands.entries()) {
          builtInHelp.push(`  ${name.padEnd(18)}${meta.description}`);
        }
      }
      return builtInHelp.join('\n');
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

    case 'cat': {
      const fileArg = args[0];
      if (!fileArg) return 'cat: missing file operand';
      const resolved = resolvePath(cwd, fileArg);
      const node = vfs.getNode(resolved);
      if (!node) return `cat: ${fileArg}: No such file or directory`;
      if (node.type === 'DIRECTORY') return `cat: ${fileArg}: Is a directory`;
      return node.content ?? '';
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

    case 'whoami': {
      const user = useKernelStore.getState().activeUser;
      return user ? `${user.username} (${user.displayName} — ${user.role})` : 'kubek';
    }

    case 'uname':
      return 'KubekOS 1.0.0-web x86_64 Browser-Sandbox-Kernel IndexedDB-VFS';

    case 'uptime': {
      const secs = useKernelStore.getState().uptimeSeconds;
      return `Session uptime: ${Math.floor(secs / 60)}m ${secs % 60}s`;
    }

    case 'apps': {
      const apps = useAppRegistryStore.getState().getAllManifests();
      return apps.map((a) => `${a.id.padEnd(16)} - ${a.name} (v${a.version})`).join('\n');
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
      command: 'uname',
      response:
        'KubekOS Sandboxed Interactive Shell v1.0.0\nType "help" to inspect built-in VFS and system commands.',
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
      className="h-full bg-slate-950/95 text-slate-100 font-mono text-xs p-4 overflow-y-auto flex flex-col justify-between select-text"
    >
      <div className="space-y-3">
        {entries.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-400">
              <span className="text-emerald-400">kubek@kubekos</span>
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
          <span className="text-emerald-400 shrink-0">kubek@kubekos</span>
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
            placeholder="Type a command (e.g. ls, pwd, help)..."
          />
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
