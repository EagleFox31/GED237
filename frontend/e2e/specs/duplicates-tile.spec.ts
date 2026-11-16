import { test, expect } from '../fixtures/auth.fixture';

/**
 * Item CDC 19 : la tuile « Doublons refusés » ouvre le journal d'audit
 * déjà filtré sur l'action « Doublon refuse ». Le journal est simulé
 * pour rester indépendant des données de la pile.
 */
const row = (id: string, action: string, label: string) => ({
  id,
  tenant_id: null,
  user_id: null,
  user_name: 'Agent Test',
  user_matricule: 'T001',
  table_name: 'documents',
  table_label: 'Documents',
  record_id: `${id}-record-0000`,
  resource_label: `fichier-${id}.pdf`,
  action,
  action_label: label,
  old_data: null,
  new_data: null,
  ip_address: null,
  user_agent: null,
  created_at: '2026-11-10T09:00:00+00:00',
});

test.describe('Feature: tuile doublons → journal', () => {
  test('Given tenant_admin, When clic sur la tuile doublons, Then journal filtré sur les doublons', async ({ loginAs, page }) => {
    await page.route('**/audit/logs*', (route) =>
      route.fulfill({
        json: [row('a1', 'dup_detected', 'Doublon refuse'), row('b2', 'upload', 'Depot de document')],
      }),
    );
    await loginAs('tenant_admin');
    await expect(page.getByText('Doublons refusés')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Voir les doublons refusés dans le journal' }).click();

    await expect(page).toHaveURL(/\/audit\?action=dup_detected/);
    await expect(page.getByText('fichier-a1.pdf').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('fichier-b2.pdf')).toHaveCount(0);
  });
});
