import { test, expect } from '../../fixtures/uat.fixture';

/**
 * Recherche du bandeau portée par l'URL (?q=) sur /spaces : aucune touche perdue en frappe rapide (#163),
 * et l'URL reste la source quand elle change d'ailleurs (lien direct, retour arrière du navigateur).
 */
test.describe('Recherche du bandeau — saisie portée par l’URL', () => {
  test('frappe rapide : aucune touche perdue, URL à jour', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');
    const search = page.locator('[data-global-search]');

    await search.click();
    await page.keyboard.type('budget2026');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(search).toHaveValue('budget20');
    await expect(page).toHaveURL(/[?&]q=budget20(&|$)/);

    await search.fill('');
    await expect(page).not.toHaveURL(/[?&]q=/);
  });

  test('sur /spaces, la recherche dans tous les documents reste à un clic (Lot 14, P5)', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');
    const search = page.locator('[data-global-search]');

    await search.fill('courrier');
    await expect(page).toHaveURL(/[?&]q=courrier(&|$)/);
    // La frappe filtre la page ; aucune liste de résultats tant que l'utilisateur ne le demande pas.
    const everywhere = page.getByRole('button', { name: /Chercher « courrier » dans tous les documents/ });
    await expect(everywhere).toBeVisible();
    await expect(page.getByText(/^\d+ résultats?$|Aucun document trouvé/)).toHaveCount(0);

    await everywhere.click();
    await expect(page.getByText(/^\d+ résultats?$|Aucun document trouvé/).first()).toBeVisible({ timeout: 10_000 });
    // Le filtre de la page reste en place.
    await expect(page).toHaveURL(/\/spaces\?(.*&)?q=courrier(&|$)/);

    // Nouvelle frappe : retour au filtre de la page, le bouton est de nouveau proposé.
    await search.fill('courriers');
    await expect(page.getByRole('button', { name: /Chercher « courriers » dans tous les documents/ })).toBeVisible();
  });

  test('lien direct et navigation : le champ suit l’URL', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces?q=courrier');
    const search = page.locator('[data-global-search]');
    await expect(search).toHaveValue('courrier');

    await page.goto('spaces?q=note');
    await expect(search).toHaveValue('note');
  });

  test('lettre tapée puis effacée avant le rendu, puis retour arrière : le champ suit l’URL', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');
    const search = page.locator('[data-global-search]');
    await expect(search).toHaveValue('');

    // Deux saisies dans la même tâche : React et le routeur les regroupent, l'URL ne change pas.
    await search.evaluate((el: HTMLInputElement) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      for (const value of ['x', '']) {
        setValue.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await expect(search).toHaveValue('');
    await expect(page).not.toHaveURL(/[?&]q=/);

    // Retour arrière dans l'application (sans rechargement) vers une entrée ?q=note.
    await page.evaluate(() => {
      const base = window.location.pathname;
      window.history.pushState(window.history.state, '', `${base}?q=note`);
      window.history.pushState(window.history.state, '', `${base}?q=autre`);
    });
    await page.goBack();
    await expect(page).toHaveURL(/[?&]q=note(&|$)/);
    await expect(search).toHaveValue('note');
  });
});
