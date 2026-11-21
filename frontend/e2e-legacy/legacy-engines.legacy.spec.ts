import { test, expect, type Page } from '@playwright/test';

/**
 * LMV-1 — deux écarts propres aux postes anciens, sur la vraie API (gestion-projet/innovateur/labo-multi-versions.md).
 *  P0 : « Copier le chemin » en HTTP sur le réseau local. Hors contexte sécurisé, navigator.clipboard
 *       n'existe pas : le chemin doit quand même partir dans le presse-papiers.
 *  P1 : modale « Nouveau Document » à 1366×768 sur un moteur sans dvh : le titre et « Envoyer »
 *       doivent rester à l'écran.
 * Le contrôle du presse-papiers ne dépend pas du correctif : il relève le texte porté par
 * l'événement copy (champ sélectionné, sélection de la page ou clipboardData.setData).
 */

const ADMIN = { code: 'MINFI', institution: 'Ministère des Finances (MINFI)', matricule: 'MINFI001', password: 'Minfi@2025' };

async function login(page: Page) {
  await page.goto('');
  const institution = page.locator('#institution');
  await institution.waitFor({ state: 'visible' });
  if ((await institution.evaluate((el) => el.tagName.toLowerCase())) === 'select') {
    const option = institution.locator('option', { hasText: `(${ADMIN.code})` }).first();
    await option.waitFor({ state: 'attached' });
    await institution.selectOption({ label: ((await option.textContent()) || '').trim() });
  } else {
    await institution.fill(ADMIN.institution);
  }
  await page.locator('#matricule').fill(ADMIN.matricule);
  await page.locator('#password').fill(ADMIN.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('#otp-0')).toBeVisible({ timeout: 15_000 });
  // ENVIRONMENT=development : le code est prérempli depuis la réponse de connexion.
  await expect(page.locator('#otp-5')).not.toHaveValue('');
  // #matricule a déjà disparu à l'écran du code : attendre la réponse OTP puis la sortie de cet écran,
  // sinon le goto suivant part avant que la session soit enregistrée (retour à la connexion).
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/verify-otp') && r.ok(), { timeout: 15_000 }),
    page.locator('form button[type="submit"]').click(),
  ]);
  await expect(page.locator('#otp-0')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('#matricule')).toHaveCount(0);
}

// Erreurs JS de la page (API absente du moteur, chunk non chargé) : écrites en cas d'échec.
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (err) => errors.push(`pageerror ${err.name}: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console ${msg.text().slice(0, 300)}`);
  });
});

// En cas d'échec, l'adresse, le début du texte de la page et les erreurs JS aident à lire le journal.
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const text = await page.locator('body').innerText().catch(() => '');
  console.log(`diag : url=${page.url()} texte=${text.replace(/\s+/g, ' ').slice(0, 400)}`);
  for (const line of (pageErrors.get(page) || []).slice(0, 8)) console.log(`diag : ${line}`);
});

test('P0 : « Copier le chemin » en HTTP sur le réseau local copie le chemin', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string | null };
    w.__copied = null;
    const setData = DataTransfer.prototype.setData;
    DataTransfer.prototype.setData = function (format: string, data: string) {
      if (format === 'text/plain' || format === 'text') w.__copied = data;
      return setData.call(this, format, data);
    };
    window.addEventListener('copy', () => {
      if (w.__copied !== null) return;
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      let text = '';
      if (el && typeof el.value === 'string' && typeof el.selectionStart === 'number') {
        text = el.value.slice(el.selectionStart, el.selectionEnd ?? el.value.length);
      }
      if (!text) text = String(document.getSelection() || '');
      w.__copied = text;
    });
  });

  await login(page);
  await page.goto('spaces');

  const context = await page.evaluate(() => ({ secure: window.isSecureContext, clipboard: 'clipboard' in navigator && !!navigator.clipboard }));
  expect(context.secure, 'la page doit être servie hors contexte sécurisé (HTTP sur une IP)').toBe(false);
  console.log(`contexte : isSecureContext=${context.secure} navigator.clipboard=${context.clipboard}`);

  await page.getByRole('button', { name: /Direction des Affaires Financi[eè]res/ }).first().click({ button: 'right', timeout: 20_000 });
  await page.getByRole('menu').getByRole('menuitem', { name: 'Copier le chemin' }).click();

  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __copied: string | null }).__copied), {
      message: 'le chemin du dossier doit partir dans le presse-papiers',
      timeout: 5_000,
    })
    .toMatch(/Affaires Financi[eè]res/);
});

test('P1 : modale « Nouveau Document » à 1366×768, titre et « Envoyer » à l’écran', async ({ page }) => {
  await login(page);
  await page.goto('documents');
  await page.getByRole('button', { name: /nouveau document/i }).click({ timeout: 20_000 });

  const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Nouveau Document' });
  const title = modal.getByRole('heading', { name: 'Nouveau Document' });
  const submit = modal.getByRole('button', { name: /envoyer|créer le document/i });
  await expect(title).toBeVisible();
  await expect(submit).toBeVisible();

  const dvh = await page.evaluate(() => CSS.supports('height', '100dvh'));
  const viewport = page.viewportSize() || { width: 1366, height: 768 };
  await submit.scrollIntoViewIfNeeded();
  const s = await submit.boundingBox();
  await title.scrollIntoViewIfNeeded();
  const t = await title.boundingBox();
  console.log(`dvh=${dvh} viewport=${viewport.height} titre.y=${t?.y} envoyer.bas=${s ? s.y + s.height : 'n/a'}`);

  expect(t, 'titre mesurable').not.toBeNull();
  expect(s, '« Envoyer » mesurable').not.toBeNull();
  expect(t!.y, 'le titre ne doit pas sortir par le haut').toBeGreaterThanOrEqual(0);
  expect(s!.y + s!.height, '« Envoyer » ne doit pas sortir par le bas').toBeLessThanOrEqual(viewport.height);
});
