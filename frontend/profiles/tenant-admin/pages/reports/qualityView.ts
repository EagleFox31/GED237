// Règles d'affichage de l'onglet Qualité, sans React, testées par `npm run test:unit`.

import type { QualityAlertMeasure } from '../../../../services/resources/quality.api';

/** État d'une liste chargée du serveur : une panne ne doit pas se lire « aucun élément ». */
export type ListLoad = 'loading' | 'ready' | 'failed';

/** Nombre au format français (séparateur de milliers). */
export const formatCount = (value: number): string => value.toLocaleString('fr-FR');

/** Pourcentage au format français, une décimale au plus : « 12,5 % ». */
export const formatPercent = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? '—'
    : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}\u00a0%`;

/** Message à la place de la liste des documents, ou `null` quand la liste s'affiche. */
export const documentsMessage = (load: ListLoad, count: number): string | null => {
  if (count > 0) return null;
  if (load === 'failed') return 'Liste indisponible pour le moment.';
  if (load === 'ready') return 'Aucun document.';
  return null;
};

/** Message à la place de la liste des alertes, ou `null` quand la liste s'affiche. */
export const alertsMessage = (load: ListLoad, count: number): string | null => {
  if (count > 0) return null;
  if (load === 'failed') return 'Alertes indisponibles pour le moment.';
  if (load === 'ready') return 'Aucune alerte.';
  return 'Chargement…';
};

/** Seuil d'une alerte en clair : « Sans catégorie : à partir de 10 documents ». */
export const thresholdText = (label: string, threshold: number, measure: QualityAlertMeasure): string =>
  `${label} : à partir de ${measure === 'rate' ? formatPercent(threshold) : `${formatCount(threshold)} documents`}`;

/** Lien vers la fiche d'un document (même forme que la recherche de l'en-tête). */
export const documentHref = (id: string): string => `/documents?open=${encodeURIComponent(id)}`;

/**
 * Ce qui empêche de créer l'alerte, en clair, ou `null` si le formulaire est prêt.
 * Même règle que l'API (seuil > 0, 100 au plus en pourcentage) ; un nombre de documents est entier.
 */
export const alertFormProblem = (input: {
  name: string;
  indicator: string;
  measure: QualityAlertMeasure;
  threshold: string;
}): string | null => {
  if (!input.name.trim()) return 'Donnez un nom à l’alerte.';
  if (!input.indicator) return 'Choisissez un indicateur.';
  const value = Number(input.threshold);
  if (input.measure === 'rate') {
    return input.threshold.trim() && value > 0 && value <= 100 ? null : 'Seuil : un pourcentage entre 0 et 100.';
  }
  return input.threshold.trim() && Number.isInteger(value) && value >= 1 ? null : 'Seuil : un nombre entier à partir de 1.';
};
