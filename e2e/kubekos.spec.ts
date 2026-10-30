import { test, expect } from '@playwright/test';

test.describe('KubekOS End-to-End Desktop Flow', () => {
  test('completes boot sequence, logs into desktop, launches apps, and interacts with VFS', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Wait for Login Screen after Boot Sequence completes
    const loginScreen = page.getByTestId('login-screen');
    await expect(loginScreen).toBeVisible({ timeout: 10000 });

    // 2. Sign in as default Administrator profile
    const submitBtn = page.getByTestId('login-submit-button');
    await submitBtn.click();

    // 3. Verify Desktop Environment and Taskbar are active
    const desktopRoot = page.getByTestId('desktop-root');
    await expect(desktopRoot).toBeVisible();
    await expect(page.getByTestId('taskbar')).toBeVisible();

    // 4. Open File Explorer from Taskbar and create a new folder
    await page.getByTestId('taskbar-app-file-explorer').click();
    await expect(page.getByTestId('window-file-explorer')).toBeVisible();

    await page.getByTestId('vfs-new-folder-btn').click();
    const promptInput = page.getByTestId('vfs-prompt-input');
    await promptInput.fill('E2E_Verified_Folder');
    await page.getByTestId('vfs-prompt-confirm').click();

    await expect(page.getByTestId('vfs-item-E2E_Verified_Folder')).toBeVisible();

    // 5. Open Command Palette via Taskbar trigger and launch Calculator
    await page.getByTestId('command-palette-trigger').click();
    const paletteInput = page.getByTestId('command-palette-input');
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill('Calculator');
    await page.getByTestId('palette-item-app-calculator').click();

    await expect(page.getByTestId('window-calculator')).toBeVisible();
    await page.getByTestId('calc-btn-7').click();
    await page.getByTestId('calc-btn-+').click();
    await page.getByTestId('calc-btn-5').click();
    await page.getByTestId('calc-btn-=').click();
    await expect(page.getByTestId('calculator-display')).toHaveText('12');
  });
});
