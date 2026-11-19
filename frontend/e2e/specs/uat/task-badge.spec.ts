import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Lot 13 point 3 : pastille du nombre de tâches en attente sur l'entrée « Tâches » du menu,
 * relue aussitôt après une décision, sans message d'erreur si la lecture échoue.
 * La liste des tâches est simulée : seul le comportement du menu est vérifié ici.
 */

const PENDING = /\/api\/v1\/workflows\/pending(\?|$)/;
const fakeTask = (id: string) => ({ id, step_order: 1, label: `Visa ${id}`, status: 'current', document_id: id, document: { title: `Doc ${id}` } });

test.describe('Pastille des tâches (L13-3)', () => {
  test('admin institution : entrée « Tâches & Validations » avec le nombre exact, relu après une décision', async ({ loginAs, page }) => {
    let tasks = [fakeTask('a'), fakeTask('b')];
    await page.route(PENDING, (route) => route.fulfill({ json: tasks }));

    await loginAs('tenant_admin');
    const entry = page.getByRole('navigation').getByRole('button', { name: /Tâches & Validations/ });
    await expect(entry.getByTestId('task-badge')).toHaveText(/^2/);

    // Une décision prise ailleurs : l'écran émet l'événement, le menu relit le nombre.
    tasks = [];
    await page.evaluate(() => window.dispatchEvent(new Event('ged:tasks-changed')));
    await expect(entry.getByTestId('task-badge')).toHaveCount(0);
  });

  test('lecture en échec : ni pastille ni message d’erreur', async ({ loginAs, page }) => {
    await page.route(PENDING, (route) => route.abort());
    await loginAs('reader');
    await expect(page.getByRole('navigation').getByRole('button', { name: /Tâches/ })).toBeVisible();
    await expect(page.getByTestId('task-badge')).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(page.getByText(/workflows en attente impossible|Connexion au serveur impossible/i)).toHaveCount(0);
  });
});
