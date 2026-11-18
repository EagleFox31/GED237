// Filtre « Statut » de l'explorateur Documents : une option peut couvrir plusieurs statuts serveur
// (GET /documents/?status=a&status=b). « À corriger » regroupe les documents rejetés et renvoyés,
// ceux sur lesquels l'auteur doit agir.

export interface DocumentStatusFilterOption {
  value: string;
  label: string;
  statuses: readonly string[];
}

export const DOCUMENT_STATUS_FILTERS: readonly DocumentStatusFilterOption[] = [
  { value: '', label: 'Statut : Tous', statuses: [] },
  { value: 'draft', label: 'Brouillon', statuses: ['draft'] },
  { value: 'in_review', label: 'En Révision', statuses: ['in_review'] },
  { value: 'to_fix', label: 'À corriger (rejeté ou renvoyé)', statuses: ['rejected', 'returned'] },
  { value: 'validated', label: 'Validé', statuses: ['validated'] },
  { value: 'archived', label: 'Archivé', statuses: ['archived'] },
];

/** Statuts serveur d'une option du filtre ; valeur inconnue ou vide : aucun filtre. */
export function statusesForFilter(value: string): string[] {
  const option = DOCUMENT_STATUS_FILTERS.find((o) => o.value === value);
  return option ? [...option.statuses] : [];
}
