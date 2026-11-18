import type { Page, Route } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * Remplacements pendant une absence (L4). Le contrat vient de l'API /delegations (PR backend
 * séparée) : les réponses sont simulées ici pour tester l'écran seul, sans dépendre de sa fusion.
 */

const DENIED = 'Accès réservé aux administrateurs.';
const DELEGATIONS_API = /\/api\/v1\/delegations(\/|\?|$)/;
const USERS_API = /\/api\/v1\/users\/?(\?|$)/;
const PENDING_API = /\/api\/v1\/workflows\/pending(\?|$)/;

const ABSENT = { id: '11111111-1111-4111-8111-111111111111', full_name: 'Awa Absente' };
const INTERIM = { id: '22222222-2222-4222-8222-222222222222', full_name: 'Paul Intérim' };

const delegation = (over: Record<string, unknown> = {}) => ({
  id: 'd-1',
  org_unit_id: 'ou-1',
  delegator: ABSENT,
  delegate: INTERIM,
  starts_at: '2026-11-20T08:00:00+01:00',
  ends_at: '2026-11-27T08:00:00+01:00',
  revoked_at: null,
  created_by: null,
  created_at: '2026-11-19T10:00:00+01:00',
  status: 'active',
  ...over,
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** UUID du compte connecté, lu dans le profil de session. */
const myUserId = (page: Page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('user_profile') || '{}').userId as string | undefined);

test.describe('Remplacements pendant une absence (L4)', () => {
  test('DLG-01 — Given lecteur, When /delegations, Then retour à /documents avec message', async ({ loginAs, page }) => {
    await loginAs('reader');
    await page.goto('delegations');
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByText(DENIED)).toBeVisible();
  });

  test('DLG-02 — Given manager, When il crée un remplacement, Then dates avec fuseau envoyées et liste rechargée', async ({ loginAs, page }) => {
    const created: Record<string, string>[] = [];
    let list = [delegation({ id: 'd-0', status: 'scheduled' })];
    await page.route(USERS_API, (route) => json(route, [ABSENT, INTERIM].map((u) => ({ ...u, is_active: true }))));
    await page.route(DELEGATIONS_API, async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        created.push(request.postDataJSON());
        list = [...list, delegation()];
        return json(route, list[list.length - 1], 201);
      }
      return json(route, list);
    });

    await loginAs('manager');
    await page.goto('delegations');
    await expect(page.getByRole('heading', { level: 1, name: /remplacements/i })).toBeVisible();
    await expect(page.getByTestId('delegation-row')).toHaveCount(1);

    await page.getByLabel('Agent absent').selectOption(ABSENT.id);
    await page.getByLabel('Remplacé par').selectOption(ABSENT.id);
    await expect(page.getByText('deux personnes différentes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();

    await page.getByLabel('Remplacé par').selectOption(INTERIM.id);
    await page.getByLabel('Début').fill('2026-11-20T08:00');
    await page.getByLabel('Fin').fill('2026-11-27T08:00');
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByTestId('delegation-row')).toHaveCount(2);
    expect(created).toHaveLength(1);
    const body = created[0] ?? {};
    expect(body).toMatchObject({ delegator_id: ABSENT.id, delegate_id: INTERIM.id });
    expect(body.starts_at).toMatch(/^2026-11-20T08:00:00[+-]\d{2}:\d{2}$/);
    expect(body.ends_at).toMatch(/^2026-11-27T08:00:00[+-]\d{2}:\d{2}$/);
  });

  test('DLG-03 — Given chevauchement refusé (409), When enregistrer, Then le motif du serveur s’affiche', async ({ loginAs, page }) => {
    const detail = 'Awa Absente a déjà un remplaçant sur cette période.';
    await page.route(USERS_API, (route) => json(route, [ABSENT, INTERIM]));
    await page.route(DELEGATIONS_API, (route) =>
      route.request().method() === 'POST' ? json(route, { detail }, 409) : json(route, []),
    );

    await loginAs('manager');
    await page.goto('delegations');
    await page.getByLabel('Agent absent').selectOption(ABSENT.id);
    await page.getByLabel('Remplacé par').selectOption(INTERIM.id);
    await page.getByLabel('Début').fill('2026-11-20T08:00');
    await page.getByLabel('Fin').fill('2026-11-27T08:00');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText(detail)).toBeVisible();
  });

  test('DLG-04 — Given remplacement en cours, When annuler puis confirmer, Then révocation demandée', async ({ loginAs, page }) => {
    const revoked: string[] = [];
    await page.route(USERS_API, (route) => json(route, [ABSENT, INTERIM]));
    await page.route(DELEGATIONS_API, (route) => {
      const url = route.request().url();
      if (route.request().method() === 'POST' && url.endsWith('/revoke')) {
        revoked.push(url);
        return json(route, delegation({ status: 'revoked' }));
      }
      return json(route, revoked.length ? [delegation({ status: 'revoked' })] : [delegation()]);
    });

    await loginAs('tenant_admin');
    await page.goto('delegations');
    await page.getByRole('button', { name: `Annuler le remplacement de ${ABSENT.full_name}` }).click();
    await page.getByRole('button', { name: 'Annuler le remplacement', exact: true }).click();

    await expect.poll(() => revoked.length).toBe(1);
    expect(revoked[0]).toContain('/delegations/d-1/revoke');
    await expect(page.getByTestId('delegation-row').getByText('Annulé')).toBeVisible();
    await expect(page.getByRole('button', { name: /Annuler le remplacement de/ })).toHaveCount(0);
  });

  test('DLG-05 — Given intérim et absence, When Mes tâches, Then « Au nom de » et bandeau de renvoi', async ({ loginAs, page }) => {
    await loginAs('manager');
    const me = await myUserId(page);
    expect(me, 'le profil de session porte l’UUID du compte').toBeTruthy();
    const myself = { id: me as string, full_name: 'Moi' };

    await page.route(DELEGATIONS_API, (route) =>
      json(route, [
        delegation({ id: 'in', delegate: myself }),
        delegation({ id: 'out', delegator: myself, delegate: INTERIM }),
      ]),
    );
    const task = (id: string, assigned_to: string) => ({
      id,
      document_id: `doc-${id}`,
      step_order: 1,
      label: `Visa ${id}`,
      assigned_to,
      status: 'current',
      expected_action_type: 'visa',
      completed_at: null,
      comment: null,
      created_at: '2026-11-20T09:00:00+01:00',
      document: { id: `doc-${id}`, title: `Note ${id}`, status: 'in_review', current_version_id: null, created_at: '2026-11-20T09:00:00+01:00' },
    });
    await page.route(PENDING_API, (route) => json(route, [task('a', ABSENT.id), task('b', me as string)]));

    await page.goto('tasks');
    await expect(page.getByTestId('task-on-behalf')).toHaveCount(1);
    await expect(page.getByTestId('task-on-behalf')).toHaveText(`Au nom de ${ABSENT.full_name}`);
    await expect(page.getByTestId('delegation-outgoing')).toContainText(`Vos tâches vont à ${INTERIM.full_name}`);
  });
});
