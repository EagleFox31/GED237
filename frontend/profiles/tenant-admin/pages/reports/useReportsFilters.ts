import { useState } from 'react';

import type { ReportsViewMode } from './reportsViewModel';

/** Onglets de la page : les vues du modèle de rapports, plus la qualité documentaire (données propres). */
export type ReportsTab = ReportsViewMode | 'qualite';

export interface ReportsFiltersState {
  viewMode: ReportsTab;
}

export function useReportsFilters() {
  const [filters, setFilters] = useState<ReportsFiltersState>({
    viewMode: 'synthese',
  });

  const setViewMode = (viewMode: ReportsTab) => {
    setFilters((current) => ({ ...current, viewMode }));
  };

  const resetFilters = () => {
    setFilters({ viewMode: 'synthese' });
  };

  return {
    filters,
    setViewMode,
    resetFilters,
  };
}
