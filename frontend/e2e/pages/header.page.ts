import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Header (components/Header.tsx).
 * Covers: search bar, notifications dropdown, user profile.
 */
export class HeaderPage {
  readonly page: Page;

  // Search
  readonly searchInput: Locator;
  readonly searchSpinner: Locator;
  readonly searchResultsDropdown: Locator;
  readonly searchResultItems: Locator;
  readonly searchNoResults: Locator;
  readonly searchResultCount: Locator;

  // Notifications
  readonly notificationBell: Locator;
  readonly unreadDot: Locator;
  readonly notificationDropdown: Locator;
  readonly notificationItems: Locator;
  readonly notificationEmpty: Locator;
  readonly markAllReadButton: Locator;
  readonly notificationTitle: Locator;

  // User profile
  readonly userName: Locator;
  readonly userAvatar: Locator;

  // Settings & Help
  readonly settingsButton: Locator;
  readonly helpButton: Locator;

  constructor(page: Page) {
    // Search
    this.searchInput = page.getByPlaceholder(/rechercher avec le moteur avancé/i);
    this.searchSpinner = page.locator('span.animate-spin:has-text("sync")');
    this.searchResultsDropdown = page.locator('.absolute.top-full').filter({ hasText: /résultats|aucun document trouvé/i });
    this.searchResultItems = page.locator('.absolute.top-full .hover\\:bg-slate-50');
    this.searchNoResults = page.getByText('Aucun document trouvé pour cette recherche.');
    this.searchResultCount = page.locator('text=/\\d+ RÉSULTATS/');

    // Notifications
    this.notificationBell = page.locator('button:has(span:text("notifications"))');
    this.unreadDot = page.locator('button:has(span:text("notifications")) .bg-red-500');
    this.notificationDropdown = page.locator('.absolute.top-full.right-0.w-80');
    this.notificationItems = this.notificationDropdown.locator('.border-b.border-slate-50.cursor-pointer');
    this.notificationEmpty = page.getByText('Aucune notification');
    this.markAllReadButton = page.getByText('Tout marquer comme lu');
    this.notificationTitle = page.locator('.absolute.top-full.right-0 .text-\\[10px\\].font-black:has-text("Notifications")');

    // User
    this.userName = page.getByText('Abena Mvondo');
    this.userAvatar = page.locator('img[alt="Avatar"]');

    // Actions
    this.settingsButton = page.locator('button:has(span:text("settings"))');
    this.helpButton = page.locator('button:has(span:text("help_outline"))');

    this.page = page;
  }

  // --- Search ---

  async search(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce (500ms) + API call
    await this.page.waitForTimeout(800);
  }

  async expectSearchResultsVisible() {
    await expect(this.searchResultsDropdown).toBeVisible({ timeout: 10_000 });
  }

  async expectSearchResultCount(min: number) {
    await this.expectSearchResultsVisible();
    const count = await this.searchResultItems.count();
    expect(count).toBeGreaterThanOrEqual(min);
  }

  async expectNoSearchResults() {
    await expect(this.searchNoResults).toBeVisible({ timeout: 10_000 });
  }

  async clickSearchResult(index: number) {
    await this.searchResultItems.nth(index).click();
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  // --- Notifications ---

  async openNotifications() {
    await this.notificationBell.click();
    await expect(this.notificationDropdown).toBeVisible();
  }

  async closeNotifications() {
    // Click outside to close
    await this.page.locator('header').click({ position: { x: 5, y: 5 } });
  }

  async expectUnreadDotVisible() {
    await expect(this.unreadDot).toBeVisible();
  }

  async expectUnreadDotHidden() {
    await expect(this.unreadDot).toBeHidden();
  }

  async getNotificationCount() {
    return this.notificationItems.count();
  }

  async expectNoNotifications() {
    await expect(this.notificationEmpty).toBeVisible();
  }

  async markFirstAsRead() {
    await this.notificationItems.first().click();
  }

  async markAllAsRead() {
    await this.markAllReadButton.click();
  }

  async expectNotificationContains(text: string) {
    await expect(this.notificationDropdown.getByText(text)).toBeVisible();
  }

  async getUnreadNotificationCount() {
    // Unread items have bg-blue-50/30
    return this.notificationDropdown.locator('.bg-blue-50\\/30').count();
  }
}
