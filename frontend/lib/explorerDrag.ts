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

// ── Fichiers glissés depuis l'Explorateur Windows (V1.2, élément 20) ─────────────────────────
// Distincts du reclassement ci-dessus : ici `dataTransfer.types` contient « Files ».

/** Profils autorisés à importer (même règle que le bouton d'import de l'écran Documents). */
export const CAN_CREATE_DOCUMENT: ReadonlySet<string> = new Set(['super', 'tenant', 'manager', 'collab']);

/** Vrai si le glisser en cours vient du bureau (fichiers), pas de l'explorateur de l'application. */
export const isFileDrag = (types: readonly string[]): boolean =>
  types.includes('Files') && !types.includes(DOCUMENT_DRAG_TYPE);

export type FilesDropVerdict = { ok: true } | { ok: false; message: string };

/** Le collaborateur importe un fichier à la fois ; sans droit d'import, rien ne se dépose. */
export const filesDropVerdict = (profileId: string | undefined, count: number): FilesDropVerdict => {
  if (!profileId || !CAN_CREATE_DOCUMENT.has(profileId)) return { ok: false, message: 'Vous ne pouvez pas déposer ici.' };
  if (count === 0) return { ok: false, message: 'Glissez les fichiers, pas le dossier.' };
  if (profileId === 'collab' && count > 1) return { ok: false, message: 'Un fichier à la fois.' };
  return { ok: true };
};

/** Garde les vrais fichiers : un dossier glissé apparaît avec une taille nulle et sans type. */
export const droppedFiles = (list: ArrayLike<File>): File[] =>
  Array.from(list).filter((f) => f.size > 0 || f.type !== '');
