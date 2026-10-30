/**
 * KubekOS Virtual Filesystem Initial Seed Structure
 * Creates the mandatory /KubekOS directory hierarchy and realistic sample files.
 */

import type { FileMimeCategory, VfsNode } from '@/types/os';

const now = Date.now();

function makeDir(path: string, parentPath: string | null, isSystemProtected = true): VfsNode {
  const parts = path.split('/').filter(Boolean);
  const name = parts[parts.length - 1] ?? 'KubekOS';
  return {
    id: `dir_${path.replace(/\//g, '_')}`,
    name,
    path,
    parentPath,
    type: 'DIRECTORY',
    sizeBytes: 0,
    createdAt: now,
    updatedAt: now,
    isSystemProtected,
    isTrashed: false,
  };
}

function makeFile(
  path: string,
  parentPath: string,
  mimeType: FileMimeCategory,
  content: string,
  isSystemProtected = false
): VfsNode {
  const parts = path.split('/').filter(Boolean);
  const name = parts[parts.length - 1] ?? 'untitled';
  return {
    id: `file_${path.replace(/\//g, '_')}`,
    name,
    path,
    parentPath,
    type: 'FILE',
    mimeType,
    content,
    sizeBytes: new Blob([content]).size,
    createdAt: now,
    updatedAt: now,
    isSystemProtected,
    isTrashed: false,
  };
}

export const INITIAL_VFS_NODES: VfsNode[] = [
  // Root & Mandatory Top-Level Directories
  makeDir('/KubekOS', null, true),
  makeDir('/KubekOS/Desktop', '/KubekOS', true),
  makeDir('/KubekOS/Documents', '/KubekOS', true),
  makeDir('/KubekOS/Documents/Projects', '/KubekOS/Documents', true),
  makeDir('/KubekOS/Documents/Notes', '/KubekOS/Documents', true),
  makeDir('/KubekOS/Downloads', '/KubekOS', true),
  makeDir('/KubekOS/Pictures', '/KubekOS', true),
  makeDir('/KubekOS/Music', '/KubekOS', true),
  makeDir('/KubekOS/Applications', '/KubekOS', true),
  makeDir('/KubekOS/System', '/KubekOS', true),
  makeDir('/KubekOS/System/Themes', '/KubekOS/System', true),
  makeDir('/KubekOS/System/Config', '/KubekOS/System', true),
  makeDir('/KubekOS/System/Logs', '/KubekOS/System', true),

  // Realistic Sample Files (Explicitly labeled as Sample Data)
  makeFile(
    '/KubekOS/Desktop/Welcome_to_KubekOS.md',
    '/KubekOS/Desktop',
    'text/markdown',
    `# Welcome to KubekOS v1.0 (Sample Document)\n\nKubekOS is a modular browser-based operating system simulation engineered with React, TypeScript, Tailwind CSS, Zustand, and IndexedDB.\n\n## Quick Keyboard Shortcuts\n- **Ctrl + K**: Open Global Command Palette\n- **Alt + Tab**: Switch active application windows\n\nFeel free to edit this file in **Code Studio** or **Notes**!`
  ),
  makeFile(
    '/KubekOS/Documents/Notes/Architecture_Overview.md',
    '/KubekOS/Documents/Notes',
    'text/markdown',
    `# KubekOS Architecture Notes (Sample Note)\n\n1. **Kernel Core**: Event bus, service registry, structured logger.\n2. **Virtual Filesystem**: Persistent IndexedDB storage via Dexie.js.\n3. **Window Manager**: Multi-window z-index stacking, snapping, and resizing.\n4. **Plugin API**: Sandboxed manifest-driven application extensions.`
  ),
  makeFile(
    '/KubekOS/Documents/Notes/Daily_Checklist.md',
    '/KubekOS/Documents/Notes',
    'text/markdown',
    `# Project Tasks (Sample Note)\n\n- [x] Verify IndexedDB VFS persistence\n- [x] Test Terminal directory navigation\n- [x] Customize desktop wallpaper in Settings`
  ),
  makeFile(
    '/KubekOS/Documents/Projects/hello_kubekos.ts',
    '/KubekOS/Documents/Projects',
    'text/typescript',
    `// Sample TypeScript Project File in KubekOS\nexport interface SystemGreeting {\n  os: string;\n  version: string;\n  status: 'ONLINE' | 'OFFLINE';\n}\n\nexport function getSystemGreeting(): SystemGreeting {\n  return {\n    os: 'KubekOS',\n    version: '1.0.0',\n    status: 'ONLINE',\n  };\n}\n\nconsole.log(getSystemGreeting());\n`
  ),
  makeFile(
    '/KubekOS/Documents/Projects/theme_tokens.json',
    '/KubekOS/Documents/Projects',
    'application/json',
    JSON.stringify(
      {
        sampleData: true,
        theme: 'Kubek Nebula Dark',
        accent: 'cyan',
        glassBlur: '16px',
      },
      null,
      2
    )
  ),
  makeFile(
    '/KubekOS/System/Config/system.json',
    '/KubekOS/System/Config',
    'application/json',
    JSON.stringify(
      {
        kernelVersion: '1.0.0',
        vfsMountPoint: '/KubekOS',
        sandboxMode: 'STRICT',
        persistenceEngine: 'IndexedDB (Dexie)',
      },
      null,
      2
    ),
    true
  ),
  makeFile(
    '/KubekOS/Pictures/KubekOS_Emblem.svg',
    '/KubekOS/Pictures',
    'image/svg+xml',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" width="240" height="160">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#06b6d4"/>
          <stop offset="100%" stop-color="#6366f1"/>
        </linearGradient>
      </defs>
      <rect width="240" height="160" rx="20" fill="#0f172a"/>
      <circle cx="120" cy="80" r="46" fill="url(#bg)" opacity="0.25"/>
      <circle cx="120" cy="80" r="30" stroke="#22d3ee" stroke-width="4" fill="none"/>
      <text x="120" y="142" fill="#e2e8f0" font-family="monospace" font-size="12" text-anchor="middle">KUBEKOS VECTOR SAMPLE</text>
    </svg>`
  ),
];
