// LMV-1 : build servi avec VITE_API_URL relatif (/api/v1, comme l'image Docker), sans capture d'écran.
// Chrome < 125 et Firefox < 124 refusent `new WebSocket('/api/...')` : on reproduit ce refus.
// La maquette ne couvre pas tous les appels du tableau de bord : on ne vérifie ici que l'absence
// d'écran d'erreur et le repère de l'écran, pas la complétude de la maquette (rôle de screens.visual.ts).
import { expect, test, type Page } from '@playwright/test';
import { mockApi, signInAsTenantAdmin } from './api-mock';
import { ERROR_SCREEN_TITLE } from './screen-guard';

const openDashboard = async (page: Page) => {
  await mockApi(page);
  await signInAsTenantAdmin(page);
  await page.goto('dashboard');
  await expect(page.getByText('Résumé Des Workflows')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { name: ERROR_SCREEN_TITLE })).toHaveCount(0);
};

// Le substitut est verrouillé : sans cela, le routeWebSocket de la maquette le remplace et le test ne prouve rien.
const lockWebSocket = (page: Page, mode: 'old-browser' | 'always-throws') =>
  page.addInitScript((m) => {
    const seen: string[] = [];
    (window as unknown as { __wsUrls: string[] }).__wsUrls = seen;
    const Substitute = function SubstituteWebSocket(url: string | URL) {
      const href = String(url);
      seen.push(href);
      if (m === 'always-throws') throw new SyntaxError('WebSocket indisponible');
      // Comme Chrome < 125 : une adresse sans ws:// ou wss:// lève une SyntaxError.
      if (!/^wss?:\/\//.test(href)) throw new SyntaxError(`The URL '${href}' is invalid.`);
      // Pas de connexion réelle : un objet inerte suffit au hook.
      return { close: () => undefined };
    };
    Object.defineProperty(window, 'WebSocket', { value: Substitute, writable: false, configurable: false });
  }, mode);

test('API relative : le WebSocket reçoit une adresse absolue (navigateur ancien)', async ({ page }) => {
  await lockWebSocket(page, 'old-browser');
  await openDashboard(page);

  // Hôte et port de la page ; le basename /edossier n'entre pas dans l'adresse de l'API.
  const urls = await page.evaluate(() => (window as unknown as { __wsUrls: string[] }).__wsUrls);
  expect(urls).toEqual(['ws://127.0.0.1:4173/api/v1/notifications/ws?token=visual-capture-token']);
});

test('WebSocket refusé par le navigateur : la page reste affichée', async ({ page }) => {
  await lockWebSocket(page, 'always-throws');
  await openDashboard(page);
  await expect(page.getByRole('heading', { name: "Vue D'Ensemble" })).toBeVisible();
  // L'essai a bien eu lieu (une seule fois : pas de boucle).
  const urls = await page.evaluate(() => (window as unknown as { __wsUrls: string[] }).__wsUrls);
  expect(urls).toHaveLength(1);
});
