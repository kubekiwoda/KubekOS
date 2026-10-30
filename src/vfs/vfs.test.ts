import { describe, it, expect, beforeEach } from 'vitest';
import { useVfsStore, resolvePath } from './vfsStore';
import { executeTerminalCommandLine } from '@/apps/TerminalApp';
import { evaluateArithmeticExpression } from '@/apps/CalculatorApp';

describe('Phase 4 & 5 — Virtual Filesystem, Terminal & Core Apps', () => {
  beforeEach(async () => {
    await useVfsStore.getState().initializeVfs();
  });

  it('resolves relative and absolute VFS paths safely inside /KubekOS', () => {
    expect(resolvePath('/KubekOS/Documents', 'Notes')).toBe('/KubekOS/Documents/Notes');
    expect(resolvePath('/KubekOS/Documents/Notes', '..')).toBe('/KubekOS/Documents');
    expect(resolvePath('/KubekOS', '../../../etc/passwd')).toBe('/KubekOS/etc/passwd');
  });

  it('creates, reads, updates, renames, copies, trashes, and restores files in VFS', async () => {
    const vfs = useVfsStore.getState();

    const created = await vfs.createFile(
      '/KubekOS/Documents',
      'phase5_spec.md',
      '# Initial Content'
    );
    expect(created.path).toBe('/KubekOS/Documents/phase5_spec.md');

    await vfs.writeFile(created.path, '# Updated Content');
    expect(useVfsStore.getState().getNode(created.path)?.content).toBe('# Updated Content');

    const renamed = await vfs.renameNode(created.path, 'phase5_renamed.md');
    expect(renamed.path).toBe('/KubekOS/Documents/phase5_renamed.md');

    const copied = await vfs.copyNode(renamed.path, '/KubekOS/Downloads');
    expect(copied.path).toBe('/KubekOS/Downloads/phase5_renamed.md');

    await vfs.moveToTrash(renamed.path);
    expect(useVfsStore.getState().getNode(renamed.path)?.isTrashed).toBe(true);

    await vfs.restoreFromTrash(renamed.path);
    expect(useVfsStore.getState().getNode(renamed.path)?.isTrashed).toBe(false);
  });

  it('prevents deleting system-protected root directories', async () => {
    const vfs = useVfsStore.getState();
    await expect(vfs.moveToTrash('/KubekOS/System')).rejects.toThrow(/system-protected/i);
  });

  it('executes built-in Terminal commands against the Virtual Filesystem', async () => {
    let cwd = '/KubekOS';
    const setCwd = (next: string) => {
      cwd = next;
    };

    const pwdOut = await executeTerminalCommandLine('pwd', cwd, setCwd, () => {});
    expect(pwdOut).toBe('/KubekOS');

    await executeTerminalCommandLine('cd Documents', cwd, setCwd, () => {});
    expect(cwd).toBe('/KubekOS/Documents');

    const lsOut = await executeTerminalCommandLine('ls', cwd, setCwd, () => {});
    expect(lsOut).toContain('Projects/');
    expect(lsOut).toContain('Notes/');
  });

  it('evaluates arithmetic expressions safely without eval()', () => {
    expect(evaluateArithmeticExpression('12 + 8 * 2')).toBe(28);
    expect(evaluateArithmeticExpression('100 / 4 - 5')).toBe(20);
    expect(() => evaluateArithmeticExpression('10 / 0')).toThrow(/Division by zero/);
  });
});
