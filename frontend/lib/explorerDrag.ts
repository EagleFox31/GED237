// Glisser-déposer de l'explorateur (#299) : déposer un document sur un dossier ouvre « Classer »
// avec ce service comme cible. Ce n'est jamais un déplacement direct : le classement garde ses
// règles et sa piste d'audit. Logique pure, testée par `npm run test:unit` (e2e/specs/explorer-drag.spec.ts).

/** Type propre à l'application : un fichier venu du bureau ou un texte glissé ne déclenche rien. */
export const DOCUMENT_DRAG_TYPE = 'application/x-ged-document';

/** Vrai si le glisser en cours porte un document de l'explorateur. */
export const isDocumentDrag = (types: readonly string[]): boolean => types.includes(DOCUMENT_DRAG_TYPE);

/** Même règle que l'entrée « Classer » du menu : seul un document à classer ou à revoir se glisse. */
export const canClassify = (status?: string | null): boolean =>
  !status || status === 'pending' || status === 'needs_review';

/** Service où le document est rangé aujourd'hui (même règle que l'affichage de l'explorateur). */
export const currentUnitOf = (doc: {
  classification_target_org_unit_id?: string | null;
  org_unit_id?: string | null;
}): string | null => doc.classification_target_org_unit_id || doc.org_unit_id || null;

/** Cible du classement, ou null si le dépôt ne change rien (même dossier, cible vide). */
export const dropTargetUnit = (currentUnitId: string | null, folderUnitId: string | null | undefined): string | null =>
  folderUnitId && folderUnitId !== currentUnitId ? folderUnitId : null;
