/**
 * KubekOS Kernel Event Bus
 * Type-safe publish-subscribe system for decoupled inter-service communication.
 */

import type { SystemEventHandler, SystemEventKey, SystemEventMap } from '@/types/os';

class KernelEventBus {
  private listeners = new Map<SystemEventKey, Set<SystemEventHandler<SystemEventKey>>>();

  public on<K extends SystemEventKey>(
    event: K,
    handler: SystemEventHandler<K>
  ): () => void {
    const existing = this.listeners.get(event) ?? new Set();
    existing.add(handler as SystemEventHandler<SystemEventKey>);
    this.listeners.set(event, existing);

    return () => {
      this.off(event, handler);
    };
  }

  public off<K extends SystemEventKey>(
    event: K,
    handler: SystemEventHandler<K>
  ): void {
    const existing = this.listeners.get(event);
    if (!existing) return;
    existing.delete(handler as SystemEventHandler<SystemEventKey>);
    if (existing.size === 0) {
      this.listeners.delete(event);
    }
  }

  public emit<K extends SystemEventKey>(
    event: K,
    payload: SystemEventMap[K]
  ): void {
    const existing = this.listeners.get(event);
    if (!existing) return;

    for (const handler of existing) {
      try {
        (handler as SystemEventHandler<K>)(payload);
      } catch (err) {
        console.error(`[KernelEventBus] Unhandled error in listener for "${event}":`, err);
      }
    }
  }

  public clearAll(): void {
    this.listeners.clear();
  }
}

export const eventBus = new KernelEventBus();
export { KernelEventBus };
