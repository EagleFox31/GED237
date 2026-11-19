// Accueil (Lot 13, V1.1) : documents de l'utilisateur rejetés ou renvoyés, sur lesquels il doit agir.

/** Liste Documents filtrée sur « À corriger » (rejeté ou renvoyé). */
export const TO_FIX_ROUTE = '/documents?status=to_fix';

/** Profils qui déposent des documents et peuvent donc en recevoir à corriger. */
export const TO_FIX_PROFILES: readonly string[] = ['tenant', 'unit', 'manager', 'collab'];

/** Libellé du bandeau d'accueil ; null quand il n'y a rien à corriger. */
export function toFixLabel(counters: { rejected?: number; returned?: number } | null | undefined): string | null {
  const total = (counters?.rejected ?? 0) + (counters?.returned ?? 0);
  if (total <= 0) return null;
  return total === 1 ? '1 document à corriger' : `${total} documents à corriger`;
}
