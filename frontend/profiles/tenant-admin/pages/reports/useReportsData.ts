import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ClassificationReview, TenantMetrics } from '../../../../types';
import { api } from '../../../../services/api';
import type {
  ReportsDocumentActivityResponse,
  ReportsServiceActivityResponse,
  ReportsWorkflowActivityResponse,
} from '../../../../services/resources/reports.api';
import { buildReportsViewModel } from './reportsViewModel';

export function useReportsData() {
  const [tenantMetrics, setTenantMetrics] = useState<TenantMetrics | null>(null);
  const [documentStats, setDocumentStats] = useState<any | null>(null);
  const [workflowStats, setWorkflowStats] = useState<any | null>(null);
  const [classificationReviews, setClassificationReviews] = useState<ClassificationReview[]>([]);
  const [documentActivity, setDocumentActivity] = useState<ReportsDocumentActivityResponse | null>(null);
  const [documentActivityError, setDocumentActivityError] = useState<string | null>(null);
  const [workflowActivity, setWorkflowActivity] = useState<ReportsWorkflowActivityResponse | null>(null);
  const [workflowActivityError, setWorkflowActivityError] = useState<string | null>(null);
  const [serviceActivity, setServiceActivity] = useState<ReportsServiceActivityResponse | null>(null);
  const [serviceActivityError, setServiceActivityError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDocumentActivityError(null);
    setWorkflowActivityError(null);
    setServiceActivityError(null);
    try {
      const [
        tenantMetricsResult,
        documentStatsResult,
        workflowStatsResult,
        reviewsResult,
        documentActivityResult,
        workflowActivityResult,
        serviceActivityResult,
      ] = await Promise.allSettled([
        api.getTenantAnalytics(),
        api.getDocumentStats(),
        api.getWorkflowStats(),
        api.getClassificationReviews(),
        api.getReportsDocumentActivity(),
        api.getReportsWorkflowActivity(),
        api.getReportsServiceActivity(),
      ]);

      if (
        tenantMetricsResult.status !== 'fulfilled'
        || documentStatsResult.status !== 'fulfilled'
        || workflowStatsResult.status !== 'fulfilled'
        || reviewsResult.status !== 'fulfilled'
      ) {
        throw new Error('core_reports_loading_failed');
      }

      setTenantMetrics(tenantMetricsResult.value ?? null);
      setDocumentStats(documentStatsResult.value ?? null);
      setWorkflowStats(workflowStatsResult.value ?? null);
      setClassificationReviews(Array.isArray(reviewsResult.value) ? reviewsResult.value : []);

      if (documentActivityResult.status === 'fulfilled') {
        setDocumentActivity(documentActivityResult.value ?? null);
      } else {
        console.error('Failed to load document activity snapshot:', documentActivityResult.reason);
        setDocumentActivity(null);
        setDocumentActivityError("Impossible de charger le détail de l'activité documentaire.");
      }

      if (workflowActivityResult.status === 'fulfilled') {
        setWorkflowActivity(workflowActivityResult.value ?? null);
      } else {
        console.error('Failed to load workflow activity snapshot:', workflowActivityResult.reason);
        setWorkflowActivity(null);
        setWorkflowActivityError("Impossible de charger le détail des circuits de traitement.");
      }

      if (serviceActivityResult.status === 'fulfilled') {
        setServiceActivity(serviceActivityResult.value ?? null);
      } else {
        console.error('Failed to load service activity snapshot:', serviceActivityResult.reason);
        setServiceActivity(null);
        setServiceActivityError("Impossible de charger le détail des services.");
      }
    } catch (loadError) {
      console.error('Failed to load reports page data:', loadError);
      setError('Impossible de charger les rapports pour le moment.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const viewModel = useMemo(
    () =>
      buildReportsViewModel({
        tenantMetrics,
        documentStats,
        workflowStats,
        documentActivity,
        workflowActivity,
        serviceActivity,
        classificationReviews,
      }),
    [classificationReviews, documentActivity, documentStats, serviceActivity, tenantMetrics, workflowActivity, workflowStats],
  );

  return {
    isLoading,
    error,
    reload: load,
    tenantMetrics,
    documentStats,
    workflowStats,
    documentActivity,
    documentActivityError,
    workflowActivity,
    workflowActivityError,
    serviceActivity,
    serviceActivityError,
    classificationReviews,
    viewModel,
  };
}
