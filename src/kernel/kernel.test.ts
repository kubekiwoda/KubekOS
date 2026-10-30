import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KernelEventBus } from './eventBus';
import { KernelLogger } from './logger';
import { KernelServiceRegistry } from './serviceRegistry';
import { useKernelStore } from './kernelStore';

describe('Phase 1 — Kernel Core & Foundation', () => {
  beforeEach(() => {
    useKernelStore.setState({
      bootPhase: 'OFF',
      activeUser: null,
      uptimeSeconds: 0,
    });
  });

  it('publishes and unsubscribes events accurately on KernelEventBus', () => {
    const bus = new KernelEventBus();
    const handler = vi.fn();

    const unsubscribe = bus.on('user:login', handler);
    bus.emit('user:login', { userId: 'u1', username: 'kubek' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ userId: 'u1', username: 'kubek' });

    unsubscribe();
    bus.emit('user:login', { userId: 'u1', username: 'kubek' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('records structured logs in KernelLogger and notifies subscribers', () => {
    const logger = new KernelLogger();
    const sub = vi.fn();
    logger.subscribe(sub);

    const entry = logger.info('KERNEL', 'Test boot message', { stage: 1 });
    expect(entry.level).toBe('INFO');
    expect(entry.subsystem).toBe('KERNEL');
    expect(entry.message).toBe('Test boot message');
    expect(logger.getEntries()).toHaveLength(1);
    expect(sub).toHaveBeenCalledTimes(1);
  });

  it('initializes and shuts down registered services in KernelServiceRegistry', async () => {
    const registry = new KernelServiceRegistry();
    const initMock = vi.fn().mockResolvedValue(undefined);
    const shutdownMock = vi.fn().mockResolvedValue(undefined);

    registry.register({
      id: 'vfs',
      name: 'Virtual Filesystem',
      version: '1.0.0',
      status: 'UNINITIALIZED',
      init: initMock,
      shutdown: shutdownMock,
    });

    await registry.initializeAll();
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(registry.get('vfs')?.status).toBe('RUNNING');

    await registry.shutdownAll();
    expect(shutdownMock).toHaveBeenCalledTimes(1);
    expect(registry.get('vfs')?.status).toBe('STOPPED');
  });

  it('manages user login, lock, logout, and theme tokens in useKernelStore', () => {
    const store = useKernelStore.getState();

    store.loginUser('user-admin');
    expect(useKernelStore.getState().bootPhase).toBe('READY');
    expect(useKernelStore.getState().activeUser?.username).toBe('kubek');

    store.setAccentColor('emerald');
    expect(useKernelStore.getState().preferences.accentColor).toBe('emerald');

    store.lockSession();
    expect(useKernelStore.getState().bootPhase).toBe('LOCKED');

    store.logoutUser();
    expect(useKernelStore.getState().bootPhase).toBe('LOGIN');
    expect(useKernelStore.getState().activeUser).toBeNull();
  });
});
