import { test, expect } from '../fixtures/authenticated.fixture';
import { RulesPage } from '../pages/rules.page';

/**
 * SC-ADM-RULES — Création des règles de classement automatique
 *
 * Le tenant_admin doit créer les règles IFTTT qui guideront le moteur
 * au moment de l'upload. Sans ces règles, aucun document n'est tagué
 * automatiquement et tout tombe dans "Documents à revoir".
 *
 * Ce spec crée 6 règles couvrant les grandes familles métier (RH, Finances,
 * Juridique, Informatique, Direction, Marketing) avec pour chacune :
 *   - un mot-clé OCR déclencheur
 *   - un tag apposé automatiquement
 *
 * Idempotent : si une règle du même nom existe déjà (run précédent), le spec
 * passe à la suivante sans échouer.
 */

const RULES = [
  { name: 'Classement RH',          keyword: 'paie',      tag: 'RH' },
  { name: 'Classement Finances',    keyword: 'facture',   tag: 'Finances' },
  { name: 'Classement Juridique',   keyword: 'contrat',   tag: 'Juridique' },
  { name: 'Classement Informatique', keyword: 'incident', tag: 'Informatique' },
  { name: 'Classement Direction',   keyword: 'comex',     tag: 'Direction' },
  { name: 'Classement Marketing',   keyword: 'campagne',  tag: 'Marketing' },
];

test.describe.serial('Feature: Règles de classement automatique (SC-ADM-RULES)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'authed-chromium',
      'Ce spec nécessite le projet authed-chromium (session setup).',
    );
  });

  test('Given tenant_admin, When il ouvre /rules, Then la page se charge', async ({ page }) => {
    const rp = new RulesPage(page);
    await rp.goto();
    await rp.expectPageVisible();
    await rp.expectLoaded();
  });

  for (const rule of RULES) {
    test(`SC-ADM-RULES — créer la règle "${rule.name}"`, async ({ page }) => {
      const rp = new RulesPage(page);
      await rp.goto();
      await rp.expectLoaded();

      const existing = page.locator(`h3:has-text("${rule.name}")`);
      if (await existing.first().isVisible().catch(() => false)) {
        test.info().annotations.push({ type: 'skip-reason', description: 'règle déjà existante' });
        return;
      }

      await rp.openCreateModal();
      await rp.fillRuleForm(rule.name, rule.keyword, rule.tag);
      await rp.submitRule();
      await rp.expectModalClosed();

      await expect(page.locator(`h3:has-text("${rule.name}")`).first())
        .toBeVisible({ timeout: 10_000 });
    });
  }

  test('SC-ADM-RULES — les 6 règles sont listées', async ({ page }) => {
    const rp = new RulesPage(page);
    await rp.goto();
    await rp.expectLoaded();

    for (const rule of RULES) {
      await expect(page.locator(`h3:has-text("${rule.name}")`).first())
        .toBeVisible({ timeout: 10_000 });
    }
  });
});
