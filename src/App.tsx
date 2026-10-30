/**
 * KubekOS Root Application Shell
 * Coordinates Boot Sequence -> Login Screen -> Active Desktop Environment.
 */

import React, { useEffect } from 'react';
import { useKernelStore } from '@/kernel/kernelStore';
import { useVfsStore } from '@/vfs/vfsStore';
import { BootScreen } from '@/components/os/BootScreen';
import { LoginScreen } from '@/components/os/LoginScreen';
import { DesktopEnvironment } from '@/desktop/DesktopEnvironment';

export const App: React.FC = () => {
  const bootPhase = useKernelStore((state) => state.bootPhase);
  const startBootSequence = useKernelStore((state) => state.startBootSequence);
  const incrementUptime = useKernelStore((state) => state.incrementUptime);
  const initializeVfs = useVfsStore((state) => state.initializeVfs);

  useEffect(() => {
    if (bootPhase === 'OFF') {
      void startBootSequence(async () => {
        await initializeVfs();
      });
    }
  }, [bootPhase, startBootSequence, initializeVfs]);

  useEffect(() => {
    if (bootPhase !== 'READY') return;
    const interval = setInterval(() => {
      incrementUptime();
    }, 1000);
    return () => clearInterval(interval);
  }, [bootPhase, incrementUptime]);

  if (bootPhase === 'OFF' || bootPhase === 'BOOTING') {
    return <BootScreen />;
  }

  if (bootPhase === 'LOGIN' || bootPhase === 'LOCKED') {
    return <LoginScreen />;
  }

  return <DesktopEnvironment />;
};

export default App;
