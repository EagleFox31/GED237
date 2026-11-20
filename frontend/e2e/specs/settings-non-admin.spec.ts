import { test, expect } from '../fixtures/auth.fixture';

/**
 * Page Paramètres (bouton ⚙️ du bandeau, /settings/display) selon le profil.
 * Un agent non administrateur ne garde que ses réglages personnels (apparence, guide des rôles) :
 * ni l'onglet « Configuration Système », ni la liste des unités, ni le titre « Paramètres Organisation ».
 * Confort d'interface : le contrôle d'accès fait foi côté API.
 */

const ORG_UNITS_API = /\/api\/v1\/org-units\/?(\?|$)/;
const ORG_TITLE = /Paramètres\s*Organisation/i;
const CONFIG_TAB = 'Configuration Système';

test.describe('Paramètres : réglages personnels pour les non-admins (SET-01..03)', () => {
  test('SET-01 — Given lecteur, When ⚙️ Paramètres, Then « Mes paramètres » sans partie organisation', async ({ loginAs, page }) => {
    await loginAs('reader');
    const orgUnitCalls: string[] = [];
    page.on('request', (req) => {
      if (ORG_UNITS_API.test(new URL(req.url()).pathname)) orgUnitCalls.push(req.url());
    });

    await page.goto('settings/display');

    await expect(page.getByRole('heading', { name: /Mes\s*paramètres/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: ORG_TITLE })).toHaveCount(0);
    await expect(page.getByRole('button', { name: CONFIG_TAB })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Unités Organisationnelles/i })).toHaveCount(0);
    // Le réglage personnel reste disponible.
    await expect(page.getByRole('button', { name: /Apparence/i })).toBeVisible();
    expect(orgUnitCalls, 'no org units fetch for a reader').toHaveLength(0);
  });

  test('SET-02 — Given collaborateur, When /settings/display, Then pas d’onglet Configuration', async ({ loginAs, page }) => {
    await loginAs('collaborator');
    await page.goto('settings/display');
    await expect(page.getByRole('heading', { name: /Mes\s*paramètres/i })).toBeVisible();
    await expect(page.getByRole('button', { name: CONFIG_TAB })).toHaveCount(0);
  });

  test('SET-03 — Given admin institution, When /settings/display, Then partie organisation inchangée', async ({ loginAs, page }) => {
    await loginAs('tenant_admin');
    await page.goto('settings/display');
    await expect(page.getByRole('heading', { name: ORG_TITLE })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Unités Organisationnelles/i })).toBeVisible();
    // La checklist de déploiement (statuts non réels) n'est plus proposée.
    await expect(page.getByRole('button', { name: CONFIG_TAB })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Checklist de déploiement/i })).toHaveCount(0);
  });
});
