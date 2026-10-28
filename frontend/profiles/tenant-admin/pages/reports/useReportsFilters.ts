import { useState } from 'react';

import type { ReportsViewMode } from './reportsViewModel';

export interface ReportsFiltersState {
  viewMode: ReportsViewMode;
}

export function useReportsFilters() {
  const [filters, setFilters] = useState<ReportsFiltersState>({
    viewMode: 'synthese',
  });

  const setViewMode = (viewMode: ReportsViewMode) => {
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
