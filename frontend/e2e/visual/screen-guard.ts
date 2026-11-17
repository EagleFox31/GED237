// Garde de LESSON-2026-035 : on ne capture qu'un écran dont on a prouvé qu'il est bien celui visé.
import { expect, type Locator, type Page } from '@playwright/test';

/** Titre de `components/ErrorBoundary.tsx`. */
export const ERROR_SCREEN_TITLE = 'Une erreur est survenue';

/** Message de chaque clause : les tests de la garde vérifient que c'est la bonne qui refuse. */
export const GUARD_MESSAGES = {
  marker: 'repère métier de l’écran visé',
  errorScreen: 'écran d’erreur affiché',
  unmocked: 'appels d’API absents de la maquette',
} as const;

/** Clause 3 seule : aussi rejouée après chaque capture, pour les appels partis après le repère. */
export function expectAllMocked(unmocked: readonly string[]): void {
  expect(unmocked, GUARD_MESSAGES.unmocked).toEqual([]);
}

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
  await expect(marker, GUARD_MESSAGES.marker).toBeVisible({ timeout });
  await expect(page.getByRole('heading', { name: ERROR_SCREEN_TITLE }), GUARD_MESSAGES.errorScreen).toHaveCount(0);
  expectAllMocked(unmocked);
}
