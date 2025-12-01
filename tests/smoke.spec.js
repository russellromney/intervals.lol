import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads and shows intervals.lol brand', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand-logo')).toHaveText('intervals.lol');
    await expect(page).toHaveTitle('intervals.lol');
  });

  test('can navigate to all tabs', async ({ page }) => {
    await page.goto('/');

    // Timers tab is active by default
    await expect(page.locator('.tab-btn.active')).toHaveText('Timers');

    // Navigate to History
    await page.click('text=History');
    await expect(page.locator('.tab-btn.active')).toHaveText('History');

    // Navigate to About
    await page.click('text=About');
    await expect(page.locator('.tab-btn.active')).toHaveText('About');

    // Back to Timers
    await page.click('text=Timers');
    await expect(page.locator('.tab-btn.active')).toHaveText('Timers');
  });

  test('can create a new timer', async ({ page }) => {
    await page.goto('/');

    // Click new timer button
    await page.click('text=New Timer');

    // Should be on edit page (check for workout name input)
    await expect(page.locator('.workout-name-input')).toBeVisible();

    // Fill in timer name
    await page.fill('.workout-name-input', 'Test Workout');

    // Add an interval
    await page.click('text=Add Interval');

    // Should have at least one interval row
    const intervalCount = await page.locator('.interval-row').count();
    expect(intervalCount).toBeGreaterThanOrEqual(1);

    // Save the timer
    await page.click('text=Save');

    // Should show "Saved!" message
    await expect(page.locator('text=Saved!')).toBeVisible();

    // Navigate back to library
    await page.click('text=Timers');

    // Should show the new timer in the library
    await expect(page.locator('.workout-card-name').first()).toContainText('Test Workout');
  });

  test('can toggle dark mode', async ({ page }) => {
    await page.goto('/');

    // Initially not in dark mode
    await expect(page.locator('.workout-timer-app')).not.toHaveClass(/dark-mode/);

    // Click dark mode toggle
    await page.click('.dark-mode-toggle');

    // Should now be in dark mode
    await expect(page.locator('.workout-timer-app')).toHaveClass(/dark-mode/);

    // Toggle back
    await page.click('.dark-mode-toggle');
    await expect(page.locator('.workout-timer-app')).not.toHaveClass(/dark-mode/);
  });

  test('settings page shows cloud sync section', async ({ page }) => {
    await page.goto('/settings');

    // Check cloud sync section exists
    await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeVisible();
    await expect(page.locator('input#backend-url')).toBeVisible();
    await expect(page.locator('input#passphrase')).toBeVisible();
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about');

    // Check about content exists
    await expect(page.locator('text=What is intervals.lol?')).toBeVisible();
    await expect(page.locator('text=Features')).toBeVisible();
  });
});
