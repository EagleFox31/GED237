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
