import { test, expect, apiAs } from '../../fixtures/uat.fixture';

/**
 * Cloche du bandeau : la liste passe par le cookie de session (plus de jeton en sessionStorage).
 * Sans temps réel (WebSocket en V1.1), une notification créée après la connexion apparaît
 * à l'ouverture de la cloche, sans recharger la page.
 */
test.describe('Cloche de notifications', () => {
  test('une tâche de visa assignée apparaît dans la cloche, sans rechargement', async ({ page, loginAs, request, runId }) => {
    await loginAs('manager');
    const bell = page.getByRole('button', { name: /^Notifications/ });
    await expect(bell).toBeVisible();

    const adminApi = await apiAs(request, 'tenant_admin');
    const managerApi = await apiAs(request, 'manager');
    const title = `Cloche ${runId}`;
    const created = await adminApi.uploadDocument(`cloche-${runId}.txt`, title, 'Notification de la cloche');
    await adminApi.submitForVisa(created.id, (await managerApi.me()).id, 'Visa du manager');

    // Ouvrir la cloche relit la liste ; l'événement d'assignation peut arriver juste après l'appel.
    await expect(async () => {
      await bell.click();
      try {
        await expect(page.getByText(title, { exact: false })).toBeVisible({ timeout: 2_000 });
      } catch (error) {
        await bell.click(); // referme : le prochain essai rouvre et relit la liste
        throw error;
      }
    }).toPass({ timeout: 20_000 });
    await expect(bell).toHaveAccessibleName(/non lues?$/);
  });
});
