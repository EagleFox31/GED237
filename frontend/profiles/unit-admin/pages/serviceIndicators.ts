// Indicateurs du tableau de bord d'un admin de service (#213), sans React, testés par
// `npm run test:unit`. Pour ce rôle, /analytics/tenant ne compte que son service et ses
// sous-services ; `storage_quota_mb` reste celui de l'institution, donc aucun pourcentage.
import type { TenantMetrics } from '../../../types';

export interface ServiceIndicator {
  label: string;
  value: number;
  icon: string;
}

export const serviceIndicators = (metrics: TenantMetrics): ServiceIndicator[] => {
  const rows: ServiceIndicator[] = [
    { label: 'Agents', value: metrics.users?.total ?? 0, icon: 'group' },
    { label: 'Documents', value: metrics.documents?.total ?? 0, icon: 'description' },
    { label: 'Workflows en attente', value: metrics.workflows?.pending ?? 0, icon: 'pending_actions' },
    { label: 'Workflows complétés', value: metrics.workflows?.completed ?? 0, icon: 'task_alt' },
  ];
  // Absent tant que l'API ne le fournit pas : on n'affiche pas un faux zéro.
  if (metrics.duplicates) {
    rows.push({ label: 'Doublons refusés', value: metrics.duplicates.refused ?? 0, icon: 'content_copy' });
  }
  return rows;
};
