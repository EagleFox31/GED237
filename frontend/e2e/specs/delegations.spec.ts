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

const ABSENT = { id: '11111111-1111-4111-8111-111111111111', full_name: 'Awa Absente', org_unit_id: 'ou-1' };
const INTERIM = { id: '22222222-2222-4222-8222-222222222222', full_name: 'Paul Intérim', org_unit_id: 'ou-1' };
/** Agent d'un autre service : jamais proposé comme remplaçant d'Awa (le serveur refuserait). */
const ELSEWHERE = { id: '33333333-3333-4333-8333-333333333333', full_name: 'Zoé Autre service', org_unit_id: 'ou-2' };
/** Lecteur du même service : ne peut pas valider, donc jamais proposé comme remplaçant. */
const READER = { id: '44444444-4444-4444-8444-444444444444', full_name: 'Léa Lectrice', org_unit_id: 'ou-1', role: 'reader' };

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
    await page.route(USERS_API, (route) => json(route, [
      ...[ABSENT, INTERIM].map((u) => ({ ...u, is_active: true })),
      { ...ELSEWHERE, is_active: true },
      { ...READER, is_active: true },
    ]));
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

    const standIn = page.getByLabel('Remplacé par');
    await expect(standIn).toBeDisabled();
    await page.getByLabel('Agent absent').selectOption(ABSENT.id);
    // Seuls les agents du même service qui peuvent valider, sans l'absente elle-même.
    await expect(standIn.locator('option')).toHaveText(['Choisir…', INTERIM.full_name]);
    await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();

    await standIn.selectOption(INTERIM.id);
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

  test('DLG-06 — Given journal d’audit, When « Au nom de quelqu’un », Then la liste et l’export sont filtrés par le serveur', async ({ loginAs, page }) => {
    const log = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      tenant_id: 't-1',
      user_id: INTERIM.id,
      user_name: INTERIM.full_name,
      table_name: 'documents',
      record_id: `doc-${id}`,
      resource_label: `Note ${id}`,
      action: 'UPDATE',
      old_data: null,
      new_data: null,
      ip_address: null,
      user_agent: null,
      created_at: '2026-11-20T09:00:00+01:00',
      ...over,
    });
    const onBehalf = log('b', { on_behalf_of: ABSENT.id, on_behalf_of_name: ABSENT.full_name });
    const listCalls: URL[] = [];
    await page.route(/\/api\/v1\/audit\/logs(\?|$)/, (route) => {
      const url = new URL(route.request().url());
      listCalls.push(url);
      return json(route, url.searchParams.get('on_behalf') === 'true' ? [onBehalf] : [log('a'), onBehalf]);
    });
    const exportCalls: URL[] = [];
    await page.route(/\/api\/v1\/audit\/logs\/export(\?|$)/, (route) => {
      exportCalls.push(new URL(route.request().url()));
      return route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: { 'Content-Disposition': 'attachment; filename="journal-audit.csv"' },
        body: '﻿Date;Action\n',
      });
    });

    await loginAs('auditor');
    await page.goto('audit');
    await expect(page.getByText('Note a')).toBeVisible();
    expect(listCalls[listCalls.length - 1]?.searchParams.has('on_behalf')).toBe(false);

    const toggle = page.getByRole('button', { name: /Au nom de quelqu'un/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Note a')).toHaveCount(0);
    await expect(page.getByText('Note b')).toBeVisible();
    await expect(page.getByTestId('audit-on-behalf')).toContainText(ABSENT.full_name);
    expect(listCalls[listCalls.length - 1]?.searchParams.get('on_behalf')).toBe('true');

    const exportButton = page.getByRole('button', { name: /Exporter/ });
    await expect(exportButton).toBeEnabled();
    const download = page.waitForEvent('download');
    await exportButton.click();
    await download;
    expect(exportCalls).toHaveLength(1);
    expect(exportCalls[0]?.searchParams.get('on_behalf')).toBe('true');
  });
});
