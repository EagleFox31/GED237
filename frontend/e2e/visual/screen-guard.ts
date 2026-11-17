// Garde de LESSON-2026-035 : on ne capture qu'un écran dont on a prouvé qu'il est bien celui visé.
import { expect, type Locator, type Page } from '@playwright/test';

/** Titre de `components/ErrorBoundary.tsx`. */
export const ERROR_SCREEN_TITLE = 'Une erreur est survenue';

/**
 * Échoue si le repère métier de l'écran n'est pas visible, si l'écran d'erreur est affiché,
 * ou si l'application a appelé une route que la maquette ne connaît pas.
 */
export async function expectScreen(
  page: Page,
  marker: Locator,
  unmocked: readonly string[],
  timeout = 10_000,
): Promise<void> {
  await expect(marker, 'repère métier de l’écran visé').toBeVisible({ timeout });
  await expect(page.getByRole('heading', { name: ERROR_SCREEN_TITLE }), 'écran d’erreur affiché').toHaveCount(0);
  expect(unmocked, 'appels d’API absents de la maquette').toEqual([]);
}
