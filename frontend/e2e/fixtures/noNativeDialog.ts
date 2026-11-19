import type { Page } from '@playwright/test';

/**
 * Garde commune : aucune fenêtre native (alert / confirm / prompt) ne doit s'ouvrir pendant un test.
 * Les écrans utilisent ConfirmationModal / RejectReasonDialog. La fenêtre est fermée (sinon la page reste
 * bloquée) puis le test échoue à la fin avec la liste des fenêtres vues.
 * Un test qui attend une fenêtre native la gère lui-même (page.once('dialog')) : la garde s'efface alors.
 */
export function guardNativeDialogs(page: Page): () => string[] {
  const seen: string[] = [];
  page.on('dialog', (dialog) => {
    // Plus d'un écouteur = le test gère la fenêtre lui-même.
    if ((page as unknown as { listenerCount(e: string): number }).listenerCount('dialog') > 1) return;
    seen.push(`${dialog.type()}: ${dialog.message().slice(0, 120)}`);
    dialog.dismiss().catch(() => {});
  });
  return () => seen;
}

export function assertNoNativeDialog(seen: string[]): void {
  if (seen.length > 0) {
    throw new Error(`Fenêtre(s) native(s) ouverte(s) pendant le test (utiliser ConfirmationModal) :\n${seen.join('\n')}`);
  }
}
