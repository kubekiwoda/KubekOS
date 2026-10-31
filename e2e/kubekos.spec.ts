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

  test('launches KubekCraft from App Center, creates a 3D world, mines/places blocks, crafts, saves, and persists across refresh', async ({
    page,
  }) => {
    await page.goto('/');

    const loginScreen = page.getByTestId('login-screen');
    await expect(loginScreen).toBeVisible({ timeout: 10000 });
    await page.getByTestId('login-submit-button').click();
    await expect(page.getByTestId('desktop-root')).toBeVisible();

    // Open App Center from desktop icon and launch KubekCraft
    await page.getByTestId('desktop-icon-app-store').dblclick();
    await expect(page.getByTestId('window-app-store')).toBeVisible();
    await page.getByTestId('app-store-open-kubekcraft').click();

    await expect(page.getByTestId('window-kubekcraft')).toBeVisible();
    await expect(page.getByTestId('kubekcraft-main-menu')).toBeVisible();

    // Create a new world
    await page.getByTestId('kubekcraft-menu-create-world').click();
    await expect(page.getByTestId('kubekcraft-create-world-screen')).toBeVisible();
    await page.getByTestId('kubekcraft-world-name-input').fill('Playwright Voxel World');
    await page.getByTestId('kubekcraft-world-seed-input').fill('E2E-SEED-777');
    await page.getByTestId('kubekcraft-confirm-create-world').click();

    // Verify 3D viewport and HUD render
    await expect(page.getByTestId('kubekcraft-3d-viewport')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('kubekcraft-hotbar')).toBeVisible();
    await expect(page.getByTestId('kubekcraft-coords')).toBeVisible();

    // Mine and place blocks
    await page.getByTestId('kubekcraft-mine-target-btn').click();
    await page.getByTestId('kubekcraft-hotbar-slot-2').click();
    await page.getByTestId('kubekcraft-place-target-btn').click();

    // Open Inventory & Crafting modal
    await page.getByTestId('kubekcraft-open-inventory-btn').click();
    await expect(page.getByTestId('kubekcraft-inventory-modal')).toBeVisible();
    await page.getByTestId('kubekcraft-close-inventory-btn').click();

    // Save and quit to main menu
    await page.getByTestId('kubekcraft-pause-btn').click();
    await expect(page.getByTestId('kubekcraft-pause-overlay')).toBeVisible();
    await page.getByTestId('kubekcraft-save-and-quit-btn').click();
    await expect(page.getByTestId('kubekcraft-main-menu')).toBeVisible();

    // Close KubekCraft window, reload browser, and verify world persists
    await page.getByTestId('window-close-kubekcraft').click();
    await page.reload();

    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('login-submit-button').click();
    await page.getByTestId('taskbar-app-kubekcraft').click();

    await expect(page.getByTestId('kubekcraft-main-menu')).toBeVisible();
    await expect(page.getByTestId('kubekcraft-menu-quick-play')).toContainText(
      'Playwright Voxel World'
    );
  });
});
