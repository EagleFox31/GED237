// Tableau de bord du manager (#278, partie A) : chiffres de GET /analytics/manager.
// Sans React, testé par `npm run test:unit`.

export type ManagerMetrics = {
  documents?: { total?: number; needs_review?: number; storage_used_mb?: number | string };
  active_workflows?: number;
};

export type ManagerTiles = { total: number; needsReview: number; activeWorkflows: number; storageMb: number };

const FR_INTEGER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const FR_ONE_DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** `storage_used_mb` peut arriver en chaîne (#264) : nombre ou chaîne acceptés, sinon 0. */
export const toMegabytes = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const count = (value: number | undefined): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const managerTiles = (metrics: ManagerMetrics): ManagerTiles => ({
  total: count(metrics.documents?.total),
  needsReview: count(metrics.documents?.needs_review),
  activeWorkflows: count(metrics.active_workflows),
  storageMb: toMegabytes(metrics.documents?.storage_used_mb),
});

/** « 1 234 » : séparateur de milliers français. */
export const formatCount = (value: number): string => FR_INTEGER.format(value);

/** « 350 Mo » sous 1 Go, « 1,2 Go » au-delà (1 Go = 1 024 Mo). */
export const formatStorage = (megabytes: number): string =>
  megabytes >= 1024 ? `${FR_ONE_DECIMAL.format(megabytes / 1024)} Go` : `${FR_INTEGER.format(megabytes)} Mo`;

/** Message selon le code HTTP ; null pour 403 (les tuiles ne s'affichent pas, sans message). */
export const managerMetricsError = (status: number | undefined): string | null =>
  status === 403 ? null : 'Chiffres indisponibles pour le moment.';

export const NO_UNIT_MESSAGE = "Vous n'êtes rattaché à aucun service. Contactez votre administrateur.";
