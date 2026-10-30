/**
 * KubekOS Kernel Logger
 * Structured ring-buffer logger for system diagnostics and System Monitor inspection.
 */

import type { LogEntry, LogLevel } from '@/types/os';
import { eventBus } from './eventBus';

const MAX_LOG_ENTRIES = 500;

class KernelLogger {
  private entries: LogEntry[] = [];
  private subscribers = new Set<(entries: readonly LogEntry[]) => void>();

  public log(
    level: LogLevel,
    subsystem: LogEntry['subsystem'],
    message: string,
    details?: Record<string, unknown>
  ): LogEntry {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      subsystem,
      message,
      details,
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.shift();
    }

    if (level === 'ERROR' || level === 'FATAL') {
      eventBus.emit('kernel:error', {
        message,
        subsystem,
        fatal: level === 'FATAL',
      });
    }

    this.notifySubscribers();
    return entry;
  }

  public debug(
    subsystem: LogEntry['subsystem'],
    message: string,
    details?: Record<string, unknown>
  ): LogEntry {
    return this.log('DEBUG', subsystem, message, details);
  }

  public info(
    subsystem: LogEntry['subsystem'],
    message: string,
    details?: Record<string, unknown>
  ): LogEntry {
    return this.log('INFO', subsystem, message, details);
  }

  public warn(
    subsystem: LogEntry['subsystem'],
    message: string,
    details?: Record<string, unknown>
  ): LogEntry {
    return this.log('WARN', subsystem, message, details);
  }

  public error(
    subsystem: LogEntry['subsystem'],
    message: string,
    details?: Record<string, unknown>
  ): LogEntry {
    return this.log('ERROR', subsystem, message, details);
  }

  public getEntries(): readonly LogEntry[] {
    return [...this.entries];
  }

  public clear(): void {
    this.entries = [];
    this.notifySubscribers();
  }

  public subscribe(callback: (entries: readonly LogEntry[]) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(): void {
    const snapshot = this.getEntries();
    for (const sub of this.subscribers) {
      sub(snapshot);
    }
  }
}

export const kernelLogger = new KernelLogger();
export { KernelLogger };
