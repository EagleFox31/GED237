import { test, expect } from '../../fixtures/uat.fixture';

/**
 * Extrait surligné de la recherche du bandeau (HighlightedExcerpt) : le contenu lu d'un scan peut
 * contenir du HTML, qui doit s'afficher comme du texte. Seul `<mark>…</mark>` exact devient un surlignage.
 * La réponse de GET /search est simulée : le rendu React est vérifié dans le navigateur, pas dans
 * e2e/unit (cf. LESSON-2026-067).
 */
const [INJECTED, NO_MATCH, DOUBTFUL] = ['Extrait avec HTML', 'Extrait sans le mot', 'Extrait avec marqueur douteux'];
const HITS = [
  {
    document_id: '00000000-0000-4000-8000-000000000001',
    title: INJECTED,
    status: 'validated',
    highlight: '<img src=x onerror="window.__excerptXss=1"> <mark>budget</mark> <script>window.__excerptXss=2</script><b>gras</b>',
  },
  {
    document_id: '00000000-0000-4000-8000-000000000002',
    title: NO_MATCH,
    status: 'validated',
    highlight: 'Début du texte sans le mot',
  },
  {
    document_id: '00000000-0000-4000-8000-000000000003',
    title: DOUBTFUL,
    status: 'validated',
    highlight: '<mark>a</mark> <mark onclick="window.__excerptXss=3">b',
  },
];

test.describe('Recherche du bandeau — extrait surligné', () => {
  test('HTML du contenu affiché comme du texte, seul le mot trouvé surligné', async ({ page, loginAs }) => {
    await page.route(
      (url) => url.pathname.endsWith('/search'),
      (route) => (route.request().resourceType() === 'fetch'
        ? route.fulfill({ json: { hits: HITS } })
        : route.continue()),
    );
    await loginAs('tenant_admin');

    await page.locator('[data-global-search]').fill('budget');
    const result = (title: string) => page.getByRole('button', { name: `Ouvrir ${title}` });
    await expect(result(INJECTED)).toBeVisible({ timeout: 10_000 });

    // HTML injecté : rendu en texte, aucune balise créée, aucun script exécuté.
    const injected = result(INJECTED).getByTestId('search-excerpt');
    await expect(injected).toContainText('<img src=x onerror="window.__excerptXss=1">');
    await expect(injected).toContainText('<script>window.__excerptXss=2</script><b>gras</b>');
    await expect(injected.locator('img, script, b')).toHaveCount(0);
    await expect(injected.locator('mark')).toHaveText(['budget']);

    // Extrait sans mot trouvé : rien n'est affiché.
    await expect(result(NO_MATCH).getByTestId('search-excerpt')).toHaveCount(0);

    // Marqueur avec attribut : texte brut, un seul surlignage.
    const doubtful = result(DOUBTFUL).getByTestId('search-excerpt');
    await expect(doubtful).toContainText('<mark onclick="window.__excerptXss=3">b');
    await expect(doubtful.locator('mark')).toHaveText(['a']);

    expect(await page.evaluate(() => (window as unknown as { __excerptXss?: number }).__excerptXss)).toBeUndefined();
  });
});
