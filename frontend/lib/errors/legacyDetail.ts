// Messages anglais encore renvoyés par d'anciennes routes du backend (HTTPException « detail »),
// remplacés par une phrase claire pour l'utilisateur. Logique pure, testée par
// e2e/unit/legacy-detail.spec.ts.
//
// Un document hors du périmètre de l'utilisateur répond 404 comme un document absent (#263) :
// le message ne doit révéler ni l'un ni l'autre cas.
export const DOCUMENT_UNAVAILABLE = "Ce document n'existe plus ou n'est pas accessible.";

const LEGACY_DETAILS: Readonly<Record<string, string>> = {
  'Document not found': DOCUMENT_UNAVAILABLE,
};

/** Message à afficher pour un `detail` du backend : traduit s'il est connu, inchangé sinon. */
export function publicDetail(detail: string | undefined): string | undefined {
  if (!detail) return detail;
  return LEGACY_DETAILS[detail.trim()] ?? detail;
}
