import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * SC-A11Y — Accessibilité automatisée (axe-core, WCAG 2.1 A/AA) sur les écrans d'entrée.
 *
 * Bloquant : violations d'impact `critical` et `serious` uniquement. Les impacts moindres
 * sont joints au rapport pour suivi, sans faire échouer la PR.
 */
const BLOCKING = new Set(['critical', 'serious']);

const audit = async (page: Page, label: string) => {
  // Page stabilisée avant mesure : axe calcule le contraste sur les couleurs rendues, donc un
  // fondu en cours (animate-in) ou un bouton encore désactivé pendant le chargement faussent le ratio.
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  await test.info().attach(`axe-${label}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const blocking = results.violations
    .filter((v) => BLOCKING.has(v.impact ?? ''))
    .map((v) => `${v.impact} ${v.id} (${v.nodes.length}) — ${v.help} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(blocking, `Violations bloquantes sur ${label}`).toEqual([]);
};

test.describe('Feature: Accessibilité (SC-A11Y)', () => {
  test('SC-A11Y-01 — Given page de connexion, Then aucune violation bloquante', async ({ loginPage, page }) => {
    await loginPage.goto();
    await audit(page, 'login');
  });

  test('SC-A11Y-02 — Given admin connecté, When tableau de bord, Then aucune violation bloquante', async ({ loginAs, page }) => {
    await loginAs('tenant_admin');
    await audit(page, 'dashboard');
  });
});
