import { test, expect } from '../../fixtures/uat.fixture';

/**
 * Rattachement hiérarchique (#277) : bloc « Rattachement » de la fiche agent (écran Utilisateurs)
 * et page « Mon équipe » (menu du compte).
 * Données jetables : un chef rattaché à l'administrateur, un agent rattaché au chef.
 * Le seed partagé n'est pas modifié (seuls les comptes créés ici portent un rattachement).
 */
test.describe('Rattachement hiérarchique', () => {
  test('fiche agent et page Mon équipe', async ({ page, loginAs, adminApi, runId }) => {
    const admin = await adminApi.me();
    const chiefMatricule = `CHEF-${runId}`.toUpperCase();
    const agentMatricule = `N1-${runId}`.toUpperCase();
    const chief = await adminApi.createUser({
      matricule: chiefMatricule,
      password: 'Equipe@2025',
      roleCode: 'manager',
      tenantId: admin.tenant_id,
      reportsToUserId: admin.id,
    });
    await adminApi.createUser({
      matricule: agentMatricule,
      password: 'Equipe@2025',
      roleCode: 'reader',
      tenantId: admin.tenant_id,
      reportsToUserId: chief.id,
    });
    const chiefName = `Recette ${chiefMatricule}`;
    const agentName = `Recette ${agentMatricule}`;

    await loginAs('tenant_admin');

    // Fiche de l'agent : il rend compte au chef, personne ne lui rend compte.
    await page.goto(`users?q=${encodeURIComponent(agentMatricule)}`);
    await page.getByRole('button', { name: new RegExp(agentMatricule) }).first().click();
    const agentBlock = page.getByTestId('reporting-block');
    await expect(agentBlock.getByTestId('reporting-chain')).toContainText(chiefName);
    await expect(agentBlock).toContainText('Personne ne lui rend compte.');

    // Fiche du chef : l'agent apparaît dans son équipe.
    await page.goto(`users?q=${encodeURIComponent(chiefMatricule)}`);
    await page.getByRole('button', { name: new RegExp(chiefMatricule) }).first().click();
    await expect(page.getByTestId('reporting-block').getByTestId('reporting-team')).toContainText(agentName);

    // Mon équipe (administrateur) : le chef est un N-1 direct, l'agent n'y figure pas.
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: 'Mon équipe' }).click();
    await expect(page).toHaveURL(/\/my-team/);
    await expect(page.getByRole('heading', { name: 'Mon équipe' })).toBeVisible();
    const team = page.getByTestId('reporting-team');
    await expect(team).toContainText(chiefName);
    await expect(team).not.toContainText(agentName);
  });
});
