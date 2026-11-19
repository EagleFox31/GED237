// Règle d'affichage de l'action « Archiver », partagée par la fiche document et l'aperçu de l'explorateur.

// Profils autorisés à archiver (parité avec « documents, archive » de backend/app/core/authz/policy.csv,
// super_admin via manage). Liste blanche : l'API fait foi, l'écran n'est jamais plus permissif qu'elle.
export const CAN_ARCHIVE_DOCUMENT: ReadonlySet<string> = new Set(['super', 'tenant']);
// Statuts de départ acceptés par l'API (ARCHIVABLE_SOURCE_STATUSES) ; sinon 409.
export const ARCHIVABLE_STATUSES: ReadonlySet<string> = new Set(['validated', 'signed']);

export const canArchiveDocument = (profileId: string | null | undefined, status: string | null | undefined): boolean =>
  !!profileId && !!status && CAN_ARCHIVE_DOCUMENT.has(profileId) && ARCHIVABLE_STATUSES.has(status);
