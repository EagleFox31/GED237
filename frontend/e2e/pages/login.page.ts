import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Login page.
 * Matches the real HTML in components/LoginPage.tsx
 */
export class LoginPage {
  readonly page: Page;

  // Step 1 — Credentials
  readonly institutionSelect: Locator;
  readonly matriculeInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  // Step 2 — OTP (6 individual inputs)
  readonly otpInputs: Locator;
  readonly confirmButton: Locator;
  readonly backButton: Locator;

  // Demo profiles
  readonly demoSection: Locator;

  constructor(page: Page) {
    this.page = page;

    // Step 1 — real selectors from LoginPage.tsx
    this.institutionSelect = page.locator('#institution');
    this.matriculeInput = page.locator('#matricule');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('form button[type="submit"]');
    this.errorMessage = page.locator('p.text-red-500');

    // Step 2 — 6 OTP digit inputs with id="otp-0" through "otp-5"
    this.otpInputs = page.locator('[id^="otp-"]');
    this.confirmButton = page.locator('form button[type="submit"]');
    this.backButton = page.getByText('Utiliser une autre méthode');

    // Demo profiles grid
    this.demoSection = page.getByText('Espace Démo Interactif');
  }

  async goto() {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await this.page.goto('', { waitUntil: 'load', timeout: 10_000 });
        return;
      } catch (error) {
        lastError = error;
        if (attempt === 5) {
          throw error;
        }
        await this.page.waitForTimeout(750 * attempt);
      }
    }
    throw lastError;
  }

  // --- Step 1: Credentials ---

  async selectInstitution(institution: string) {
    await this.institutionSelect.waitFor({ state: 'visible' });
    const tagName = await this.institutionSelect.evaluate((element) => element.tagName.toLowerCase());
    if (tagName === 'select') {
      await this.institutionSelect.selectOption({ label: institution });
      return;
    }
    await this.institutionSelect.fill(institution);
  }

  async fillCredentials(institution: string, matricule: string, password: string) {
    await this.selectInstitution(institution);
    await this.matriculeInput.fill(matricule);
    await this.passwordInput.fill(password);
  }

  async submitLogin() {
    await this.submitButton.click();
  }

  async expectLoginPageVisible() {
    await expect(this.matriculeInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.institutionSelect).toBeVisible();
  }

  async expectErrorVisible(message?: string) {
    await expect(this.errorMessage).toBeVisible({ timeout: 10_000 });
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  // --- Step 2: OTP ---

  async waitForOtpStep() {
    const otpFirstInput = this.page.locator('#otp-0');
    await Promise.race([
      otpFirstInput.waitFor({ state: 'visible', timeout: 10_000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 10_000 }).then(async () => {
        const errorText = (await this.errorMessage.textContent())?.trim() || 'Unknown login error';
        throw new Error(`Login failed before OTP step: ${errorText}`);
      }),
    ]);
    await expect(otpFirstInput).toBeVisible();
  }

  async expectOtpPreFilled() {
    // In dev mode, the OTP is auto-filled from the login response
    for (let i = 0; i < 6; i++) {
      await expect(this.page.locator(`#otp-${i}`)).not.toHaveValue('');
    }
  }

  async fillOtp(code: string) {
    const digits = code.split('');
    for (let i = 0; i < 6; i++) {
      await this.page.locator(`#otp-${i}`).fill(digits[i] || '');
    }
  }

  async submitOtp() {
    await this.confirmButton.click();
  }

  async goBackToLogin() {
    await this.backButton.click();
  }

  // --- Dashboard arrival ---

  async expectDashboardVisible() {
    // After OTP success, AuthStore flips isLoggedIn and AppLayout mounts.
    // The Navigate redirect (/ → /dashboard) may take a tick; wait for either
    // the URL to include /dashboard OR the authenticated shell (sidebar) to appear.
    await Promise.race([
      expect(this.page).toHaveURL(/dashboard/, { timeout: 15_000 }),
      expect(this.page.locator('aside, nav').first()).toBeVisible({ timeout: 15_000 }),
    ]);
    // Ensure login form is gone (proves we left the auth screen).
    await expect(this.matriculeInput).not.toBeVisible({ timeout: 5_000 });
  }

  // --- Demo Profiles ---

  async selectDemoProfile(label: string) {
    await this.page.getByText(label, { exact: true }).click();
  }

  async expectFieldsPreFilled() {
    await expect(this.matriculeInput).not.toHaveValue('');
    await expect(this.passwordInput).not.toHaveValue('');
  }
}
