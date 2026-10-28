import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../../../../services/api';
import type {
  ReportsEvolutionResponse,
  ReportsSeriesKey,
  ReportsEvolutionSeries,
  ReportsEvolutionTotals,
} from '../../../../services/resources/reports.api';

export type ReportsEvolutionGranularity = 'day' | 'week' | 'month';

interface ReportsEvolutionViewModel {
  selectedSeries: ReportsSeriesKey;
  points: Array<{ label: string; value: number }>;
  summaryChart: Array<{
    label: string;
    documents_created: number;
    documents_auto_classified: number;
    documents_needing_review: number;
  }>;
  totalValue: number;
  strongestBucketLabel: string | null;
  strongestBucketValue: number;
  topUnits: Array<{ id?: string | null; label: string; value: number }>;
  periodLabel: string;
  title: string;
  helper: string;
  totalLabel: string;
  topUnitsLabel: string;
}

const EMPTY_SERIES: ReportsEvolutionSeries = {
  documents_created: [],
  documents_auto_classified: [],
  documents_needing_review: [],
  imports_completed: [],
  workflow_steps_completed: [],
  workflow_steps_rejected: [],
};

const EMPTY_TOTALS: ReportsEvolutionTotals = {
  documents_created: 0,
  documents_auto_classified: 0,
  documents_needing_review: 0,
  imports_completed: 0,
  workflow_steps_completed: 0,
  workflow_steps_rejected: 0,
};

const EMPTY_BREAKDOWNS = {
  org_units: {
    documents_created: [],
    documents_auto_classified: [],
    documents_needing_review: [],
  },
  domains: [],
  activities: [],
  imports: [],
};

const pad = (value: number) => String(value).padStart(2, '0');
const toDateInput = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const getRangeForGranularity = (granularity: ReportsEvolutionGranularity) => {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  if (granularity === 'day') {
    dateFrom.setDate(dateFrom.getDate() - 29);
  } else if (granularity === 'week') {
    dateFrom.setDate(dateFrom.getDate() - (7 * 11));
  } else {
    dateFrom.setMonth(dateFrom.getMonth() - 11);
    dateFrom.setDate(1);
  }

  return {
    dateFrom: toDateInput(dateFrom),
    dateTo: toDateInput(dateTo),
  };
};

const formatPeriodLabel = (granularity: ReportsEvolutionGranularity) => {
  if (granularity === 'day') return '30 derniers jours';
  if (granularity === 'week') return '12 dernières semaines';
  return '12 derniers mois';
};

const SERIES_META: Record<ReportsSeriesKey, {
  title: string;
  helper: string;
  totalLabel: string;
  topUnitsLabel: string;
}> = {
  documents_created: {
    title: 'Évolution des créations',
    helper: 'Nombre de documents créés sur la période sélectionnée.',
    totalLabel: 'Documents créés',
    topUnitsLabel: 'Unités les plus actives',
  },
  documents_auto_classified: {
    title: 'Évolution du classement automatique',
    helper: 'Nombre de documents classés automatiquement sur la période sélectionnée.',
    totalLabel: 'Documents classés automatiquement',
    topUnitsLabel: 'Unités les mieux classées automatiquement',
  },
  documents_needing_review: {
    title: 'Évolution des documents à revoir',
    helper: 'Nombre de documents orientés vers une reprise manuelle sur la période sélectionnée.',
    totalLabel: 'Documents à revoir',
    topUnitsLabel: 'Unités les plus touchées',
  },
};

const buildSummaryChart = (series: ReportsEvolutionSeries) => {
  const buckets = new Map<string, {
    label: string;
    documents_created: number;
    documents_auto_classified: number;
    documents_needing_review: number;
  }>();

  const ensureBucket = (label: string) => {
    const existing = buckets.get(label);
    if (existing) return existing;
    const created = {
      label,
      documents_created: 0,
      documents_auto_classified: 0,
      documents_needing_review: 0,
    };
    buckets.set(label, created);
    return created;
  };

  for (const point of series.documents_created ?? []) {
    ensureBucket(point.bucket_label).documents_created = point.value;
  }
  for (const point of series.documents_auto_classified ?? []) {
    ensureBucket(point.bucket_label).documents_auto_classified = point.value;
  }
  for (const point of series.documents_needing_review ?? []) {
    ensureBucket(point.bucket_label).documents_needing_review = point.value;
  }

  return Array.from(buckets.values());
};

export function useReportsEvolution() {
  const [granularity, setGranularity] = useState<ReportsEvolutionGranularity>('day');
  const [selectedSeries, setSelectedSeries] = useState<ReportsSeriesKey>('documents_created');
  const [data, setData] = useState<ReportsEvolutionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (requestedGranularity: ReportsEvolutionGranularity) => {
    setIsLoading(true);
    setError(null);
    try {
      const range = getRangeForGranularity(requestedGranularity);
      const response = await api.getReportsEvolution({
        granularity: requestedGranularity,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      });
      setData(response ?? null);
    } catch (loadError) {
      console.error('Failed to load reports evolution:', loadError);
      setError("Impossible de charger l'évolution pour le moment.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(granularity);
  }, [granularity, load]);

  const reload = useCallback(async () => {
    await load(granularity);
  }, [granularity, load]);

  const viewModel = useMemo<ReportsEvolutionViewModel>(() => {
    const series = data?.series ?? EMPTY_SERIES;
    const totals = data?.totals ?? EMPTY_TOTALS;
    const breakdowns = data?.breakdowns ?? EMPTY_BREAKDOWNS;
    const selectedPoints = series[selectedSeries] ?? [];
    const points = selectedPoints.map((point) => ({
      label: point.bucket_label,
      value: point.value,
    }));

    const strongestPoint = points.reduce<{ label: string | null; value: number }>(
      (current, point) => (point.value > current.value ? point : current),
      { label: null, value: 0 },
    );

    return {
      selectedSeries,
      points,
      summaryChart: buildSummaryChart(series),
      totalValue: totals[selectedSeries] ?? 0,
      strongestBucketLabel: strongestPoint.label,
      strongestBucketValue: strongestPoint.value,
      topUnits: breakdowns.org_units[selectedSeries] ?? [],
      periodLabel: formatPeriodLabel(granularity),
      title: SERIES_META[selectedSeries].title,
      helper: SERIES_META[selectedSeries].helper,
      totalLabel: SERIES_META[selectedSeries].totalLabel,
      topUnitsLabel: SERIES_META[selectedSeries].topUnitsLabel,
    };
  }, [data, granularity, selectedSeries]);

  return {
    granularity,
    setGranularity,
    selectedSeries,
    setSelectedSeries,
    isLoading,
    error,
    reload,
    data,
    viewModel,
  };
}
