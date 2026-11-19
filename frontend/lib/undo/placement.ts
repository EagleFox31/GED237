import type { Document } from '../../types';

/**
 * Emplacement d'un document (contrat serveur #151) : ces sept champs suffisent à le remettre en place.
 * Annuler un déplacement = PATCH /documents/{id} avec les valeurs d'avant, null compris.
 */
export const PLACEMENT_KEYS = [
  'classification_domain_id',
  'classification_activity_id',
  'classification_year',
  'classification_scope',
  'classification_target_org_unit_id',
  'classification_target_user_id',
  'classification_status',
] as const;

export type PlacementKey = (typeof PLACEMENT_KEYS)[number];
export type Placement = { [K in PlacementKey]: Document[K] | null };

export function placementOf(doc: Document): Placement {
  return Object.fromEntries(PLACEMENT_KEYS.map((key) => [key, doc[key] ?? null])) as Placement;
}

/**
 * Patch de retour à l'emplacement d'avant. Le serveur accepte `null` pour chacun de ces champs
 * (contrat #151) ; le type `Document` ne le dit pas pour scope et status, d'où la conversion.
 */
export function restorePlacementPatch(before: Placement): Partial<Document> {
  return before as unknown as Partial<Document>;
}

/** Unité où l'explorateur range le document (même règle que l'affichage des dossiers). */
export function unitOf(doc: Document): string | null {
  return doc.classification_target_org_unit_id || doc.org_unit_id || null;
}

/**
 * Patch « déposer dans le dossier `unitId` ». `null` si le document y est déjà.
 * Un document rangé chez une personne passe au niveau service de l'unité cible.
 */
export function moveToUnitPatch(doc: Document, unitId: string): Partial<Document> | null {
  if (unitOf(doc) === unitId) return null;
  const scope = doc.classification_scope && doc.classification_scope !== 'person' ? doc.classification_scope : 'service';
  return {
    classification_target_org_unit_id: unitId,
    classification_scope: scope,
    classification_target_user_id: null,
  };
}

/**
 * « Annuler » n'est proposé que si le retour est sûr :
 * pas vers ou depuis l'espace d'une personne (le propriétaire change, 403 possible au retour),
 * et seulement si le document avait déjà une unité cible.
 */
export function canUndoMove(before: Placement, patch: Partial<Document>): boolean {
  return (
    Boolean(before.classification_target_org_unit_id) &&
    before.classification_scope !== 'person' &&
    patch.classification_scope !== 'person'
  );
}
