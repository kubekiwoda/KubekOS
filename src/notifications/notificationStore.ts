/**
 * KubekOS Notification Center & Quick Settings Store
 * Manages system alerts, notification history, and quick toggles.
 */

import { create } from 'zustand';
import type { NotificationPriority, SystemNotification } from '@/types/os';
import { eventBus } from '@/kernel/eventBus';
import { kernelLogger } from '@/kernel/logger';

interface NotificationStoreState {
  notifications: SystemNotification[];
  isCenterOpen: boolean;

  pushNotification: (params: {
    title: string;
    message: string;
    sourceAppId?: string;
    priority?: NotificationPriority;
    actionLabel?: string;
    actionAppId?: string;
  }) => SystemNotification;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setCenterOpen: (open: boolean) => void;
  toggleCenter: () => void;
}

const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'notif-welcome',
    title: 'Welcome to KubekOS v1.0',
    message: 'Press Ctrl + K anytime to open the global Command Palette.',
    sourceAppId: 'about-kubekos',
    priority: 'NORMAL',
    timestamp: Date.now() - 15000,
    read: false,
    actionLabel: 'About KubekOS',
    actionAppId: 'about-kubekos',
  },
];

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  notifications: INITIAL_NOTIFICATIONS,
  isCenterOpen: false,

  pushNotification: ({
    title,
    message,
    sourceAppId,
    priority = 'NORMAL',
    actionLabel,
    actionAppId,
  }) => {
    const newNotif: SystemNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      sourceAppId,
      priority,
      timestamp: Date.now(),
      read: false,
      actionLabel,
      actionAppId,
    };

    set((state) => ({
      notifications: [newNotif, ...state.notifications].slice(0, 100),
    }));

    eventBus.emit('notification:pushed', { notificationId: newNotif.id });
    kernelLogger.info('NOTIFICATION', `Notification pushed: "${title}"`);
    return newNotif;
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },

  setCenterOpen: (open) => set({ isCenterOpen: open }),

  toggleCenter: () => set((state) => ({ isCenterOpen: !state.isCenterOpen })),
}));
