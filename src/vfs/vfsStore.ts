/**
 * KubekOS Virtual Filesystem Store & Service
 * Provides full CRUD, directory navigation, copy/move, rename, Trash management,
 * full-text search, import/export, and automatic IndexedDB persistence.
 */

import { create } from 'zustand';
import type { FileMimeCategory, VfsNode, VfsStorageStats } from '@/types/os';
import { osDb } from './db';
import { INITIAL_VFS_NODES } from './seedData';
import { eventBus } from '@/kernel/eventBus';
import { kernelLogger } from '@/kernel/logger';

export function normalizePath(inputPath: string): string {
  const cleaned = inputPath.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!cleaned || cleaned === '/') return '/KubekOS';
  const withoutTrailing = cleaned.length > 1 && cleaned.endsWith('/') ? cleaned.slice(0, -1) : cleaned;
  return withoutTrailing.startsWith('/') ? withoutTrailing : `/${withoutTrailing}`;
}

export function resolvePath(currentDir: string, targetPath: string): string {
  const trimmed = targetPath.trim();
  if (!trimmed || trimmed === '.') return normalizePath(currentDir);
  if (trimmed === '~') return '/KubekOS';

  const combined = trimmed.startsWith('/')
    ? trimmed
    : `${normalizePath(currentDir)}/${trimmed}`;

  const segments = combined.split('/').filter(Boolean);
  const resolved: string[] = [];

  for (const seg of segments) {
    if (seg === '.') continue;
    if (seg === '..') {
      if (resolved.length > 1) {
        resolved.pop();
      }
    } else {
      resolved.push(seg);
    }
  }

  if (resolved.length === 0 || resolved[0] !== 'KubekOS') {
    resolved.unshift('KubekOS');
  }

  return `/${resolved.join('/')}`;
}

export function inferMimeType(filename: string): FileMimeCategory {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'text/typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'text/javascript';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return 'text/plain';
}

interface VfsState {
  nodes: Record<string, VfsNode>; // Keyed by normalized path
  isInitialized: boolean;

  initializeVfs: () => Promise<void>;
  listDirectory: (dirPath: string) => VfsNode[];
  listTrash: () => VfsNode[];
  getNode: (path: string) => VfsNode | undefined;
  createFile: (parentPath: string, name: string, content?: string, mimeType?: FileMimeCategory) => Promise<VfsNode>;
  createDirectory: (parentPath: string, name: string) => Promise<VfsNode>;
  writeFile: (path: string, content: string) => Promise<VfsNode>;
  renameNode: (path: string, newName: string) => Promise<VfsNode>;
  copyNode: (sourcePath: string, targetDirPath: string) => Promise<VfsNode>;
  moveNode: (sourcePath: string, targetDirPath: string) => Promise<VfsNode>;
  moveToTrash: (path: string) => Promise<void>;
  restoreFromTrash: (path: string) => Promise<void>;
  deletePermanently: (path: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  searchNodes: (query: string) => VfsNode[];
  getStorageStats: () => VfsStorageStats;
  exportSubtreeJson: (rootPath?: string) => string;
  importNodesJson: (jsonString: string) => Promise<number>;
}

const initialSeedMap: Record<string, VfsNode> = {};
for (const node of INITIAL_VFS_NODES) {
  initialSeedMap[node.path] = node;
}

export const useVfsStore = create<VfsState>((set, get) => ({
  nodes: initialSeedMap,
  isInitialized: false,

  initializeVfs: async () => {
    try {
      const existingCount = await osDb.vfsNodes.count();
      if (existingCount === 0) {
        await osDb.vfsNodes.bulkPut(INITIAL_VFS_NODES);
        kernelLogger.info('VFS', `Seeded IndexedDB VFS with ${INITIAL_VFS_NODES.length} initial nodes.`);
      }

      const allRecords = await osDb.vfsNodes.toArray();
      const map: Record<string, VfsNode> = {};
      for (const rec of allRecords) {
        map[rec.path] = rec;
      }

      set({ nodes: map, isInitialized: true });
      kernelLogger.info('VFS', `Mounted ${allRecords.length} VFS nodes from IndexedDB.`);
    } catch (err) {
      kernelLogger.error('VFS', 'IndexedDB initialization error; using in-memory fallback.', {
        error: err instanceof Error ? err.message : String(err),
      });
      set({ isInitialized: true });
    }
  },

  listDirectory: (dirPath) => {
    const normalized = normalizePath(dirPath);
    return Object.values(get().nodes)
      .filter((n) => n.parentPath === normalized && !n.isTrashed)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'DIRECTORY' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  },

  listTrash: () => {
    return Object.values(get().nodes)
      .filter((n) => n.isTrashed)
      .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
  },

  getNode: (path) => {
    return get().nodes[normalizePath(path)];
  },

  createFile: async (parentPath, name, content = '', mimeType) => {
    const cleanName = name.trim().replace(/\//g, '_');
    if (!cleanName) throw new Error('File name cannot be empty.');

    const normParent = normalizePath(parentPath);
    const parentNode = get().nodes[normParent];
    if (!parentNode || parentNode.type !== 'DIRECTORY') {
      throw new Error(`Parent directory "${normParent}" does not exist.`);
    }

    const fullPath = `${normParent}/${cleanName}`;
    if (get().nodes[fullPath]) {
      throw new Error(`An item named "${cleanName}" already exists in ${normParent}.`);
    }

    const now = Date.now();
    const newNode: VfsNode = {
      id: `file_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      path: fullPath,
      parentPath: normParent,
      type: 'FILE',
      mimeType: mimeType ?? inferMimeType(cleanName),
      content,
      sizeBytes: new Blob([content]).size,
      createdAt: now,
      updatedAt: now,
      isSystemProtected: false,
      isTrashed: false,
    };

    await osDb.vfsNodes.put(newNode);
    set((state) => ({
      nodes: { ...state.nodes, [fullPath]: newNode },
    }));

    eventBus.emit('vfs:changed', { path: fullPath, operation: 'CREATE' });
    kernelLogger.info('VFS', `Created file: ${fullPath}`);
    return newNode;
  },

  createDirectory: async (parentPath, name) => {
    const cleanName = name.trim().replace(/\//g, '_');
    if (!cleanName) throw new Error('Directory name cannot be empty.');

    const normParent = normalizePath(parentPath);
    const parentNode = get().nodes[normParent];
    if (!parentNode || parentNode.type !== 'DIRECTORY') {
      throw new Error(`Parent directory "${normParent}" does not exist.`);
    }

    const fullPath = `${normParent}/${cleanName}`;
    if (get().nodes[fullPath]) {
      throw new Error(`Directory "${cleanName}" already exists in ${normParent}.`);
    }

    const now = Date.now();
    const newNode: VfsNode = {
      id: `dir_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      path: fullPath,
      parentPath: normParent,
      type: 'DIRECTORY',
      sizeBytes: 0,
      createdAt: now,
      updatedAt: now,
      isSystemProtected: false,
      isTrashed: false,
    };

    await osDb.vfsNodes.put(newNode);
    set((state) => ({
      nodes: { ...state.nodes, [fullPath]: newNode },
    }));

    eventBus.emit('vfs:changed', { path: fullPath, operation: 'CREATE' });
    kernelLogger.info('VFS', `Created directory: ${fullPath}`);
    return newNode;
  },

  writeFile: async (path, content) => {
    const normPath = normalizePath(path);
    const existing = get().nodes[normPath];
    if (!existing) {
      const lastSlash = normPath.lastIndexOf('/');
      const parentPath = lastSlash > 0 ? normPath.slice(0, lastSlash) : '/KubekOS';
      const fileName = normPath.slice(lastSlash + 1);
      return get().createFile(parentPath, fileName, content);
    }

    if (existing.type !== 'FILE') {
      throw new Error(`Cannot write content to directory "${normPath}".`);
    }

    const updated: VfsNode = {
      ...existing,
      content,
      sizeBytes: new Blob([content]).size,
      updatedAt: Date.now(),
    };

    await osDb.vfsNodes.put(updated);
    set((state) => ({
      nodes: { ...state.nodes, [normPath]: updated },
    }));

    eventBus.emit('vfs:changed', { path: normPath, operation: 'UPDATE' });
    return updated;
  },

  renameNode: async (path, newName) => {
    const normPath = normalizePath(path);
    const node = get().nodes[normPath];
    if (!node) throw new Error(`Path "${normPath}" not found.`);
    if (node.isSystemProtected) {
      throw new Error(`Cannot rename system-protected node "${node.name}".`);
    }

    const cleanName = newName.trim().replace(/\//g, '_');
    if (!cleanName || !node.parentPath) throw new Error('Invalid new name.');

    const newPath = `${node.parentPath}/${cleanName}`;
    if (get().nodes[newPath]) {
      throw new Error(`An item named "${cleanName}" already exists.`);
    }

    const updatedNode: VfsNode = {
      ...node,
      name: cleanName,
      path: newPath,
      mimeType: node.type === 'FILE' ? inferMimeType(cleanName) : undefined,
      updatedAt: Date.now(),
    };

    await osDb.vfsNodes.delete(normPath);
    await osDb.vfsNodes.put(updatedNode);

    set((state) => {
      const next = { ...state.nodes };
      delete next[normPath];
      next[newPath] = updatedNode;
      return { nodes: next };
    });

    eventBus.emit('vfs:changed', { path: newPath, operation: 'MOVE' });
    return updatedNode;
  },

  copyNode: async (sourcePath, targetDirPath) => {
    const normSource = normalizePath(sourcePath);
    const normTargetDir = normalizePath(targetDirPath);
    const source = get().nodes[normSource];
    const targetDir = get().nodes[normTargetDir];

    if (!source) throw new Error(`Source "${normSource}" does not exist.`);
    if (!targetDir || targetDir.type !== 'DIRECTORY') {
      throw new Error(`Destination "${normTargetDir}" is not a directory.`);
    }

    let copyName = source.name;
    let destPath = `${normTargetDir}/${copyName}`;
    if (get().nodes[destPath]) {
      const dotIdx = source.name.lastIndexOf('.');
      copyName =
        dotIdx > 0
          ? `${source.name.slice(0, dotIdx)}_copy${source.name.slice(dotIdx)}`
          : `${source.name}_copy`;
      destPath = `${normTargetDir}/${copyName}`;
    }

    if (source.type === 'FILE') {
      return get().createFile(normTargetDir, copyName, source.content ?? '', source.mimeType);
    } else {
      return get().createDirectory(normTargetDir, copyName);
    }
  },

  moveNode: async (sourcePath, targetDirPath) => {
    const normSource = normalizePath(sourcePath);
    const normTargetDir = normalizePath(targetDirPath);
    const source = get().nodes[normSource];
    const targetDir = get().nodes[normTargetDir];

    if (!source) throw new Error(`Source "${normSource}" does not exist.`);
    if (source.isSystemProtected) {
      throw new Error(`Cannot move system-protected node "${source.name}".`);
    }
    if (!targetDir || targetDir.type !== 'DIRECTORY') {
      throw new Error(`Destination "${normTargetDir}" is not a directory.`);
    }

    const newPath = `${normTargetDir}/${source.name}`;
    if (get().nodes[newPath]) {
      throw new Error(`Item "${source.name}" already exists in destination.`);
    }

    const moved: VfsNode = {
      ...source,
      path: newPath,
      parentPath: normTargetDir,
      updatedAt: Date.now(),
    };

    await osDb.vfsNodes.delete(normSource);
    await osDb.vfsNodes.put(moved);

    set((state) => {
      const next = { ...state.nodes };
      delete next[normSource];
      next[newPath] = moved;
      return { nodes: next };
    });

    eventBus.emit('vfs:changed', { path: newPath, operation: 'MOVE' });
    return moved;
  },

  moveToTrash: async (path) => {
    const normPath = normalizePath(path);
    const node = get().nodes[normPath];
    if (!node) return;
    if (node.isSystemProtected) {
      throw new Error(`Cannot delete system-protected folder "${node.name}".`);
    }

    const trashed: VfsNode = {
      ...node,
      isTrashed: true,
      trashedAt: Date.now(),
      originalPath: node.path,
    };

    await osDb.vfsNodes.put(trashed);
    set((state) => ({
      nodes: { ...state.nodes, [normPath]: trashed },
    }));

    eventBus.emit('vfs:changed', { path: normPath, operation: 'DELETE' });
    kernelLogger.info('VFS', `Moved item to Trash: ${normPath}`);
  },

  restoreFromTrash: async (path) => {
    const normPath = normalizePath(path);
    const node = get().nodes[normPath];
    if (!node || !node.isTrashed) return;

    const restored: VfsNode = {
      ...node,
      isTrashed: false,
      trashedAt: undefined,
      updatedAt: Date.now(),
    };

    await osDb.vfsNodes.put(restored);
    set((state) => ({
      nodes: { ...state.nodes, [normPath]: restored },
    }));

    eventBus.emit('vfs:changed', { path: normPath, operation: 'RESTORE' });
    kernelLogger.info('VFS', `Restored item from Trash: ${normPath}`);
  },

  deletePermanently: async (path) => {
    const normPath = normalizePath(path);
    const node = get().nodes[normPath];
    if (!node) return;
    if (node.isSystemProtected) {
      throw new Error(`Cannot permanently delete system-protected item "${node.name}".`);
    }

    await osDb.vfsNodes.delete(node.id);
    set((state) => {
      const next = { ...state.nodes };
      delete next[normPath];
      return { nodes: next };
    });

    eventBus.emit('vfs:changed', { path: normPath, operation: 'DELETE' });
  },

  emptyTrash: async () => {
    const trashedItems = get().listTrash();
    for (const item of trashedItems) {
      await osDb.vfsNodes.delete(item.id);
    }

    set((state) => {
      const next = { ...state.nodes };
      for (const item of trashedItems) {
        delete next[item.path];
      }
      return { nodes: next };
    });

    kernelLogger.info('VFS', `Emptied Trash (${trashedItems.length} items removed).`);
  },

  searchNodes: (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(get().nodes).filter(
      (n) =>
        !n.isTrashed &&
        (n.name.toLowerCase().includes(q) ||
          n.path.toLowerCase().includes(q) ||
          (n.content && n.content.toLowerCase().includes(q)))
    );
  },

  getStorageStats: () => {
    const all = Object.values(get().nodes);
    let totalFiles = 0;
    let totalDirectories = 0;
    let trashedItems = 0;
    let usedBytes = 0;

    for (const n of all) {
      if (n.isTrashed) {
        trashedItems += 1;
      } else if (n.type === 'FILE') {
        totalFiles += 1;
      } else {
        totalDirectories += 1;
      }
      usedBytes += n.sizeBytes;
    }

    return {
      totalFiles,
      totalDirectories,
      trashedItems,
      usedBytes,
      quotaBytes: 50 * 1024 * 1024, // 50 MB logical VFS sandbox quota
    };
  },

  exportSubtreeJson: (rootPath = '/KubekOS') => {
    const normRoot = normalizePath(rootPath);
    const matching = Object.values(get().nodes).filter(
      (n) => !n.isTrashed && (n.path === normRoot || n.path.startsWith(`${normRoot}/`))
    );
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        os: 'KubekOS v1.0',
        rootPath: normRoot,
        nodes: matching,
      },
      null,
      2
    );
  },

  importNodesJson: async (jsonString) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON file format.');
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('nodes' in parsed) ||
      !Array.isArray((parsed as { nodes: unknown }).nodes)
    ) {
      throw new Error('JSON file does not contain a valid KubekOS VFS "nodes" array.');
    }

    const rawNodes = (parsed as { nodes: unknown[] }).nodes;
    const validNodes: VfsNode[] = [];

    for (const item of rawNodes) {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as VfsNode).path === 'string' &&
        typeof (item as VfsNode).name === 'string' &&
        ((item as VfsNode).type === 'FILE' || (item as VfsNode).type === 'DIRECTORY')
      ) {
        const node = item as VfsNode;
        if (node.path.startsWith('/KubekOS')) {
          validNodes.push({
            ...node,
            sizeBytes: typeof node.content === 'string' ? new Blob([node.content]).size : 0,
            updatedAt: Date.now(),
          });
        }
      }
    }

    if (validNodes.length > 0) {
      await osDb.vfsNodes.bulkPut(validNodes);
      set((state) => {
        const next = { ...state.nodes };
        for (const n of validNodes) {
          next[n.path] = n;
        }
        return { nodes: next };
      });
    }

    return validNodes.length;
  },
}));
