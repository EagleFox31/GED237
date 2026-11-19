// Règles de la corbeille côté écran, sans React, testées par `npm run test:unit`.
// Miroir de `trash_service.PROTECTED_STATUSES` (#152) : un document signé ou archivé
// n'est jamais supprimé pour de bon, le serveur le refuse ; l'écran ne le propose donc pas.
import type { Document } from '../types';

const PROTECTED_STATUSES: ReadonlyArray<Document['status']> = ['signed', 'archived'];

export const isPurgeProtected = (doc: Pick<Document, 'status'>): boolean =>
  PROTECTED_STATUSES.includes(doc.status);

/**
 * « Vider » n'a de sens que s'il reste au moins un document effaçable. Tant que toutes les
 * pages ne sont pas chargées, on ne peut pas l'exclure : on laisse le bouton.
 */
export const canEmptyTrash = (items: ReadonlyArray<Pick<Document, 'status'>>, total: number): boolean =>
  items.length < total || items.some((doc) => !isPurgeProtected(doc));

/**
 * 404 sur restaurer ou supprimer : le document n'est plus dans la corbeille de l'utilisateur
 * (déjà traité ailleurs, ou hors de son périmètre, #247). La ligne n'a plus lieu d'être.
 */
export const isGoneFromTrash = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 404;

/**
 * Décision PO : un document retiré par quelqu'un d'autre (un administrateur) ne se restaure
 * que par un administrateur (`documents:delete`). Miroir du 403 de POST /restore.
 */
export const isRestoreReservedToAdmin = (
  doc: Pick<Document, 'deleted_by'>,
  myUserId: string | undefined,
  canDelete: boolean,
): boolean => !canDelete && Boolean(doc.deleted_by) && doc.deleted_by !== myUserId;

export const RESTORE_RESERVED_HELP = 'Retiré par un administrateur. Demandez-lui de le restaurer.';

export type IdenticalDocument = { id: string; title: string };

/**
 * Restaurer réussit toujours. Le serveur signale en plus un document actif au même fichier
 * (`identical_document`), seulement s'il est lisible par l'utilisateur. Réponse sans ce champ
 * (serveur plus ancien) ou incomplète : rien à signaler.
 */
export const identicalAfterRestore = (body: unknown): IdenticalDocument | null => {
  const found = (body as { identical_document?: unknown } | null | undefined)?.identical_document;
  if (!found || typeof found !== 'object') return null;
  const { id, title } = found as { id?: unknown; title?: unknown };
  return typeof id === 'string' && id && typeof title === 'string' ? { id, title } : null;
};
