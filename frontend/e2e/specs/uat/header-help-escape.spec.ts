import { test, expect } from '../../fixtures/uat.fixture';

/** Fenêtre d'aide du bandeau : la touche « Esc » qu'elle annonce la ferme vraiment. */
test('Given aide ouverte, When Échap, Then la fenêtre se ferme', async ({ page, loginAs }) => {
  await loginAs('tenant_admin');
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  const title = page.getByRole('heading', { name: 'E-Dossier — Support' });
  await expect(title).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(title).toHaveCount(0);
});
