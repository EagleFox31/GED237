import { test, expect, API_URL } from '../../fixtures/uat.fixture';

/**
 * #162 : onglet Qualité des rapports (documents incomplets par indicateur).
 * #183 : alertes de qualité ; un 409 (alertes désactivées sur le serveur) s'affiche en clair, à la place du formulaire.
 */
test.describe('Rapports — qualité documentaire', () => {
  test('un document sans catégorie apparaît sous « Sans catégorie »', async ({ page, loginAs, adminApi, runId }) => {
    const title = `Qualité ${runId}`;
    await adminApi.uploadDocument(`qualite-${runId}.txt`, title, `Qualité ${runId}`);

    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();
    await expect(page.getByText('Documents complets')).toBeVisible();
    // Qualité a ses propres données : ni « Générer un rapport », ni « Exporter la vue ».
    await expect(page.getByRole('button', { name: /Générer un rapport/ })).toHaveCount(0);
    await page.locator('summary[aria-label="Télécharger"]').click();
    await expect(page.getByRole('button', { name: 'Exporter la vue' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copie officielle', exact: true })).toBeVisible();
    await page.locator('summary[aria-label="Télécharger"]').click();

    await page.getByRole('button', { name: /Sans catégorie/ }).click();
    const list = page.getByRole('list', { name: 'Documents : Sans catégorie' });
    const link = list.getByRole('link', { name: title, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /\/documents\?open=/);
  });

  test('alerte refusée (409) : message simple, le formulaire disparaît', async ({ page, loginAs }) => {
    const detail = 'Les alertes qualité sont désactivées sur ce serveur.';
    await page.route('**/analytics/quality/alerts', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 409, json: { detail } })
        : route.fallback(),
    );
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();

    const form = page.getByRole('form', { name: 'Nouvelle alerte' });
    await form.getByLabel("Nom de l'alerte").fill('Refusée');
    await form.getByLabel('Indicateur').selectOption('missing_category');
    await form.getByLabel('Seuil', { exact: true }).fill('5');
    await form.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Les alertes ne sont pas activées.' })).toBeVisible();
    await expect(page.getByText(detail)).toHaveCount(0);
    await expect(form).toHaveCount(0);

    // « Actualiser » efface le refus : le serveur a pu activer les alertes entre-temps.
    await page.getByRole('button', { name: 'Actualiser', exact: true }).click();
    await expect(form).toBeVisible();
    await expect(page.getByText('Les alertes ne sont pas activées.')).toHaveCount(0);
  });

  test('créer puis arrêter une alerte', async ({ page, request, loginAs, adminToken, runId }) => {
    // Sonde : le corps est validé avant le contrôle d'activation, il doit donc être valide ; supprimée aussitôt.
    const headers = { Authorization: `Bearer ${adminToken}` };
    const probe = await request.post(`${API_URL}/analytics/quality/alerts`, {
      headers,
      data: { name: `sonde ${runId}`, indicator: 'missing_year', measure: 'count', threshold: 1 },
    });
    if (probe.status() === 201) {
      await request.delete(`${API_URL}/analytics/quality/alerts/${(await probe.json()).id}`, { headers });
    }
    test.skip(probe.status() === 409, 'alertes qualité désactivées sur ce serveur (QUALITY_ALERTS_ENABLED=false)');

    const name = `Alerte ${runId}`;
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();

    const form = page.getByRole('form', { name: 'Nouvelle alerte' });
    await form.getByLabel("Nom de l'alerte").fill(name);
    await form.getByLabel('Indicateur').selectOption('missing_year');
    await form.getByLabel('Seuil', { exact: true }).fill('50');
    await form.getByLabel('Unité du seuil').selectOption('rate');
    await form.getByRole('button', { name: 'Créer' }).click();

    const row = page.getByRole('list', { name: 'Mes alertes' }).getByLabel(name, { exact: true });
    await expect(row).toContainText(/Sans année : à partir de 50\s%/);

    // « Arrêter » demande une confirmation sur la ligne ; « Non » garde l'alerte.
    await row.getByRole('button', { name: `Arrêter ${name}` }).click();
    await expect(row).toContainText('Arrêter cette alerte ?');
    await row.getByRole('button', { name: 'Non' }).click();
    // Le focus revient sur « Arrêter », pas en haut de la page.
    await expect(row.getByRole('button', { name: `Arrêter ${name}` })).toBeFocused();

    await row.getByRole('button', { name: `Arrêter ${name}` }).click();
    await row.getByRole('button', { name: `Confirmer l’arrêt de ${name}` }).click();
    await expect(row).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Mes alertes' })).toBeFocused();
  });

  test('liste en panne puis alerte créée à 0,05 % : la liste se dit incomplète', async ({ page, loginAs, runId }) => {
    const posted: Array<Record<string, unknown>> = [];
    const name = `Partielle ${runId}`;
    await page.route(/\/analytics\/quality\/alerts\/?(\?|$)/, async (route) => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ status: 500, json: { detail: 'panne simulée' } });
      if (request.method() !== 'POST') return route.fallback();
      const body = request.postDataJSON() as Record<string, unknown>;
      posted.push(body);
      return route.fulfill({
        status: 201,
        json: { ...body, id: 'qa-p', scope: {}, is_active: true, created_at: '2026-11-20T08:00:00Z', alerting_since: null },
      });
    });
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();
    await expect(page.getByText('Alertes indisponibles pour le moment.')).toBeVisible();

    // 0,05 % est accepté par l'API : le navigateur ne doit pas le bloquer en silence (min HTML).
    const form = page.getByRole('form', { name: 'Nouvelle alerte' });
    await form.getByLabel("Nom de l'alerte").fill(name);
    await form.getByLabel('Indicateur').selectOption('missing_year');
    await form.getByLabel('Unité du seuil').selectOption('rate');
    await form.getByLabel('Seuil', { exact: true }).fill('0.05');
    await form.getByRole('button', { name: 'Créer' }).click();

    await expect(page.getByRole('list', { name: 'Mes alertes' }).getByRole('listitem')).toHaveCount(1);
    expect(posted).toHaveLength(1);
    expect(posted[0]?.threshold).toBe(0.05);
    await expect(page.getByText('Liste incomplète : les autres alertes n’ont pas pu être lues.')).toBeVisible();
  });

  test('« Oui, arrêter » pendant une création : l’arrêt part quand même', async ({ page, loginAs }) => {
    let deletes = 0;
    let releasePost: () => void = () => undefined;
    const existing = {
      id: 'qa-e',
      name: 'Existante',
      indicator: 'missing_year',
      measure: 'count',
      threshold: 3,
      scope: {},
      is_active: true,
      created_at: '2026-11-20T08:00:00Z',
      alerting_since: null,
    };
    await page.route(/\/analytics\/quality\/alerts(\/[^/?]+)?\/?(\?|$)/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') return route.fulfill({ status: 200, json: [existing] });
      if (method === 'DELETE') {
        deletes += 1;
        return route.fulfill({ status: 204 });
      }
      if (method !== 'POST') return route.fallback();
      // La création reste en cours tant que l'arrêt n'est pas vérifié.
      await new Promise<void>((resolve) => {
        releasePost = resolve;
      });
      return route.fulfill({ status: 201, json: { ...existing, id: 'qa-n', name: 'Nouvelle' } });
    });
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();

    const form = page.getByRole('form', { name: 'Nouvelle alerte' });
    await form.getByLabel("Nom de l'alerte").fill('Nouvelle');
    await form.getByLabel('Indicateur').selectOption('missing_year');
    await form.getByLabel('Seuil', { exact: true }).fill('3');
    await form.getByRole('button', { name: 'Créer' }).click();

    const list = page.getByRole('list', { name: 'Mes alertes' });
    const row = list.getByLabel('Existante', { exact: true });
    await row.getByRole('button', { name: 'Arrêter Existante' }).click();
    await row.getByRole('button', { name: 'Confirmer l’arrêt de Existante' }).click();
    await expect(row).toHaveCount(0);
    expect(deletes).toBe(1);

    releasePost();
    await expect(list.getByLabel('Nouvelle', { exact: true })).toBeVisible();
  });

  test('indicateur retombé à 0 après « Actualiser » : sa liste se referme encore', async ({ page, loginAs }) => {
    let reads = 0;
    await page.route(/\/analytics\/quality\/?(\?|$)/, (route) => {
      reads += 1;
      const count = reads === 1 ? 2 : 0;
      return route.fulfill({
        status: 200,
        json: {
          total_documents: 10,
          documents_to_fix: count,
          quality_rate: 100 - count * 10,
          indicators: [{ key: 'missing_year', label: 'Sans année', count, rate: count * 10 }],
        },
      });
    });
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();

    const indicator = page.getByRole('button', { name: /^Sans année/ });
    await indicator.click();
    await expect(indicator).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Actualiser', exact: true }).click();
    await expect(indicator).toContainText('0');
    await expect(indicator).toBeEnabled();
    await indicator.click();
    await expect(indicator).toHaveAttribute('aria-pressed', 'false');
    await expect(indicator).toBeDisabled();
  });

  test('alertes illisibles : message de panne, pas « Aucune alerte. »', async ({ page, loginAs }) => {
    await page.route(/\/analytics\/quality\/alerts\/?(\?|$)/, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 500, json: { detail: 'panne simulée' } })
        : route.fallback(),
    );
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();

    await expect(page.getByText('Alertes indisponibles pour le moment.')).toBeVisible();
    await expect(page.getByText('Aucune alerte.')).toHaveCount(0);
  });

  test('double clic sur « Créer » : une seule alerte demandée', async ({ page, loginAs, runId }) => {
    let posts = 0;
    const name = `Double ${runId}`;
    await page.route(/\/analytics\/quality\/alerts\/?(\?|$)/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') return route.fulfill({ status: 200, json: [] });
      if (method !== 'POST') return route.fallback();
      posts += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return route.fulfill({
        status: 201,
        json: {
          id: 'qa-1',
          name,
          indicator: 'missing_year',
          measure: 'count',
          threshold: 3,
          scope: {},
          is_active: true,
          created_at: '2026-11-20T08:00:00Z',
          alerting_since: null,
        },
      });
    });
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();

    const form = page.getByRole('form', { name: 'Nouvelle alerte' });
    await form.getByLabel("Nom de l'alerte").fill(name);
    await form.getByLabel('Indicateur').selectOption('missing_year');
    await form.getByLabel('Seuil', { exact: true }).fill('3');
    await form.getByRole('button', { name: 'Créer' }).dblclick();

    await expect(page.getByRole('list', { name: 'Mes alertes' }).getByRole('listitem')).toHaveCount(1);
    expect(posts).toBe(1);
  });

  test('menu « Télécharger » : Échap ou un clic à côté le referme', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('reports');
    const summary = page.locator('summary[aria-label="Télécharger"]');
    const official = page.getByRole('button', { name: 'Copie officielle', exact: true });

    await summary.click();
    await expect(official).toBeVisible();
    await official.focus();
    await page.keyboard.press('Escape');
    await expect(official).toBeHidden();
    await expect(summary).toBeFocused();

    await summary.click();
    await expect(official).toBeVisible();
    await page.getByRole('heading', { name: /Rapports/ }).click();
    await expect(official).toBeHidden();
  });

  test('formulaire d’alerte : libellés visibles et motif quand « Créer » est grisé', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();
    const form = page.getByRole('form', { name: 'Nouvelle alerte' });
    const create = form.getByRole('button', { name: 'Créer' });
    const problem = form.locator('#quality-alert-problem');
    const seuil = form.getByLabel('Seuil', { exact: true });

    await expect(form.getByText('Seuil', { exact: true })).toBeVisible();
    await expect(problem).toHaveText('');
    await form.getByLabel("Nom de l'alerte").fill('Motif');
    await expect(problem).toHaveText('Choisissez un indicateur.');
    await form.getByLabel('Indicateur').selectOption('missing_year');
    await seuil.fill('0');
    await expect(problem).toHaveText('Seuil : un nombre entier à partir de 1.');
    await expect(create).toBeDisabled();
    await expect(seuil).toHaveAttribute('min', '1');
    await seuil.fill('2');
    await expect(create).toBeEnabled();
    await expect(problem).toHaveText('');
  });

  test('aucun document : le panneau le dit, les alertes restent', async ({ page, loginAs }) => {
    await page.route(/\/analytics\/quality\/?(\?|$)/, (route) =>
      route.fulfill({ status: 200, json: { total_documents: 0, documents_to_fix: 0, quality_rate: null, indicators: [] } }),
    );
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();
    await expect(page.getByText('Aucun document à contrôler.')).toBeVisible();
    await expect(page.getByText('Documents complets')).toHaveCount(0);
    await expect(page.getByRole('form', { name: 'Nouvelle alerte' })).toBeVisible();
  });
});
