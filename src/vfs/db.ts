/**
 * KubekOS IndexedDB Persistence Layer (Dexie.js)
 * Manages schema versioning, safe migrations, and storage tables for VFS, Calendar, and Settings.
 */

import Dexie, { type Table } from 'dexie';
import type { VfsNode } from '@/types/os';

export interface CalendarEventRecord {
  id: string;
  title: string;
  dateIso: string; // YYYY-MM-DD
  time: string; // HH:mm
  category: 'WORK' | 'PERSONAL' | 'SYSTEM';
  notes: string;
  createdAt: number;
}

export interface KeyValueSettingRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export class KubekOsDatabase extends Dexie {
  public vfsNodes!: Table<VfsNode, string>;
  public calendarEvents!: Table<CalendarEventRecord, string>;
  public kvSettings!: Table<KeyValueSettingRecord, string>;

  constructor() {
    super('KubekOS_PersistentDB');

    this.version(1).stores({
      vfsNodes: 'id, &path, parentPath, name, type, isTrashed',
      calendarEvents: 'id, dateIso, category',
      kvSettings: 'key',
    });
  }
}

export const osDb = new KubekOsDatabase();
