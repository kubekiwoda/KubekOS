/**
 * KubekOS Kernel Service Registry
 * Manages initialization, lifecycle, and health of core OS services.
 */

import type { KernelService } from '@/types/os';
import { kernelLogger } from './logger';

class KernelServiceRegistry {
  private services = new Map<string, KernelService>();

  public register(service: KernelService): void {
    if (this.services.has(service.id)) {
      kernelLogger.warn('KERNEL', `Service "${service.id}" is already registered. Overwriting.`);
    }
    this.services.set(service.id, service);
    kernelLogger.debug('KERNEL', `Registered service: ${service.name} (${service.version})`);
  }

  public get(id: string): KernelService | undefined {
    return this.services.get(id);
  }

  public getAll(): KernelService[] {
    return Array.from(this.services.values());
  }

  public async initializeAll(): Promise<void> {
    for (const service of this.services.values()) {
      try {
        service.status = 'INITIALIZING';
        kernelLogger.info('KERNEL', `Initializing service: ${service.name}`);
        await service.init();
        service.status = 'RUNNING';
      } catch (err) {
        service.status = 'ERROR';
        const errorMessage = err instanceof Error ? err.message : String(err);
        kernelLogger.error('KERNEL', `Service initialization failed: ${service.name}`, {
          serviceId: service.id,
          error: errorMessage,
        });
        throw err;
      }
    }
  }

  public async shutdownAll(): Promise<void> {
    const reversed = Array.from(this.services.values()).reverse();
    for (const service of reversed) {
      if (service.shutdown && service.status === 'RUNNING') {
        try {
          await service.shutdown();
          service.status = 'STOPPED';
        } catch (err) {
          kernelLogger.error('KERNEL', `Error stopping service: ${service.name}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  public reset(): void {
    this.services.clear();
  }
}

export const serviceRegistry = new KernelServiceRegistry();
export { KernelServiceRegistry };
