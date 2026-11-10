import { test, expect } from '../../fixtures/uat.fixture';

/**
 * UAT — SC-ADM-05 : définir une règle de classement automatique (Administrateur Ministère).
 * Écran réel : /classement (onglet « Règles de classement »), pas /rules (aiguillage des circuits).
 *
 * Pré-condition du guide (« une catégorie existe ») : le seed ne crée aucune donnée de classement,
 * la spec crée donc son armoire (domaine) et son tiroir (activité) via l'API.
 * Post-condition vérifiée par l'API : un nouveau document dont le nom correspond est classé
 * dans l'armoire et le tiroir de la règle (classement synchrone à l'upload).
 */

test.describe('SC-ADM-05 — Règle de classement automatique', () => {
  test('créer une règle active, la simuler (A1), puis constater le classement d’un nouveau document', async ({
    page,
    loginAs,
    adminApi,
    runId,
  }) => {
    const domain = await adminApi.createDomain(`uat-fin-${runId}`, `Finances UAT ${runId}`);
    const activity = await adminApi.createActivity(domain.id, `uat-fac-${runId}`, `Factures UAT ${runId}`);
    const keyword = `factureuat${runId}`;
    const ruleName = `Factures → Comptabilité ${runId}`;

    await loginAs('tenant_admin');
    await page.goto('classement');
    // Les étapes du plan de classement sont des boutons (pas des onglets ARIA).
    await page.getByRole('button', { name: /Règles de classement$/ }).click();

    // Étapes 2 à 7 : nouvelle règle, nom, condition, action, activation, sauvegarde.
    await page.getByRole('button', { name: /Nouvelle Règle/i }).click();
    await page.getByLabel('Nom règle classement').fill(ruleName);
    await page.getByLabel('Mots-clés nom fichier').fill(keyword);
    await page.getByLabel('Armoire de destination').selectOption({ label: domain.name });
    await page.getByLabel('Tiroir de destination').selectOption({ label: activity.name });
    await expect(page.getByLabel('Règle active dès l’enregistrement')).toBeChecked();
    await page.getByRole('button', { name: /Créer la règle/i }).click();
    await expect(page.getByText('Règle de classement créée.')).toBeVisible();

    const created = (await adminApi.listRules()).find((r) => r.name === ruleName);
    expect(created, 'la règle est persistée côté serveur').toBeDefined();
    expect(created!.is_active).toBe(true);

    // A1 : simuler sans impact réel.
    await page.getByRole('button', { name: /Simulateur$/ }).click();
    await page.getByLabel('Nom du fichier').fill(`${keyword}-2026.pdf`);
    await page.getByRole('button', { name: /Lancer la simulation/i }).click();
    await expect(page.getByText('Résultat du test')).toBeVisible();
    await expect(page.getByText('Classifié', { exact: true })).toBeVisible();

    // Post-condition : un nouveau document correspondant déclenche le classement.
    const doc = await adminApi.uploadDocument(
      `${keyword}-avril.txt`,
      `Facture avril ${runId}`,
      `Facture fournisseur ${runId}`,
    );
    expect(doc.classification_status).toBe('classified');
    expect(doc.classification_domain_id).toBe(domain.id);
    expect(doc.classification_activity_id).toBe(activity.id);
  });
});
