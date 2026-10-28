import React, { useMemo, useState } from 'react';

import { Empty } from '../../../components/ui/Empty';
import { InlineHelpButton } from '../../../components/ui/InlineHelpButton';
import { UI_TOOLTIPS } from '../../../content/uiTooltips';
import { exportReportsRowsExcel, exportReportsSeriesCsv, generateReportsDocument } from './reports/reportsExport';
import { ReportsDocumentPanel } from './reports/ReportsDocumentPanel';
import { ReportsKpiGrid } from './reports/ReportsKpiGrid';
import { ReportGenerationModal, type ReportGenerationRequest } from './reports/ReportGenerationModal';
import { ReportsServiceActivityPanel } from './reports/ReportsServiceActivityPanel';
import { ReportsSummaryPanel } from './reports/ReportsSummaryPanel';
import { ReportsTableSection } from './reports/ReportsTableSection';
import { ReportsWorkflowPanel } from './reports/ReportsWorkflowPanel';
import type { ReportsViewMode } from './reports/reportsViewModel';
import { useReportsData } from './reports/useReportsData';
import { useReportsEvolution } from './reports/useReportsEvolution';
import { useReportsFilters } from './reports/useReportsFilters';

interface TabMeta {
  step: number;
  label: string;
  icon: string;
  accent: string;
  empty: string;
}

const TAB_META: Record<ReportsViewMode, TabMeta> = {
  synthese: {
    step: 1,
    label: 'Synthèse',
    icon: 'monitoring',
    accent: 'text-rdpc-blue',
    empty: "Aucune synthèse n'est encore disponible pour cette période.",
  },
  workflows: {
    step: 2,
    label: 'Traitement & délais',
    icon: 'network_node',
    accent: 'text-amber-600',
    empty: "Aucun indicateur de traitement n'est encore disponible pour cette période.",
  },
  services: {
    step: 3,
    label: 'Services',
    icon: 'groups',
    accent: 'text-emerald-600',
    empty: "Les comparatifs par service seront affichés ici dès que les agrégats par unité seront disponibles.",
  },
  documents: {
    step: 4,
    label: 'Activité documentaire',
    icon: 'description',
    accent: 'text-violet-600',
    empty: "Aucune activité documentaire n'est encore disponible pour cette période.",
  },
};

const TAB_ORDER: ReportsViewMode[] = ['synthese', 'workflows', 'services', 'documents'];

const TAB_HELP: Record<ReportsViewMode, string> = {
  synthese: UI_TOOLTIPS.reports.tabSynthese,
  documents: UI_TOOLTIPS.reports.tabDocuments,
  workflows: UI_TOOLTIPS.reports.tabWorkflows,
  services: UI_TOOLTIPS.reports.tabServices,
};

const ReportsPage: React.FC = () => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const { filters, setViewMode } = useReportsFilters();
  const {
    isLoading,
    error,
    reload,
    documentActivity,
    documentActivityError,
    workflowActivity,
    workflowActivityError,
    serviceActivity,
    serviceActivityError,
    viewModel,
  } = useReportsData();
  const {
    granularity,
    setGranularity,
    selectedSeries,
    setSelectedSeries,
    isLoading: isEvolutionLoading,
    error: evolutionError,
    reload: reloadEvolution,
    viewModel: evolutionViewModel,
  } = useReportsEvolution();

  const activeTab = filters.viewMode;
  const activeMeta = TAB_META[activeTab];
  const isRefreshing = isLoading || isEvolutionLoading;

  const currentRows = useMemo(
    () => viewModel.rowsByMode[activeTab] ?? [],
    [activeTab, viewModel.rowsByMode],
  );

  const reportScopeOptions = useMemo(
    () => [
      { id: 'institution', label: 'Institution entière' },
      ...(serviceActivity?.services ?? []).map((service) => ({
        id: service.id,
        label: service.label,
      })),
    ],
    [serviceActivity],
  );
  const inDocumentsView = activeTab === 'documents';
  const defaultReportPeriodLabel = inDocumentsView ? evolutionViewModel.periodLabel : 'Période actuelle';

  const handleGenerateReport = async (request: ReportGenerationRequest) => {
    const workflowRows = viewModel.rowsByMode.workflows ?? [];
    const servicesRows = viewModel.rowsByMode.services ?? [];

    let rows = viewModel.rowsByMode.synthese ?? [];
    let seriesTitle: string | undefined;
    let seriesPoints: Array<{ label: string; value: number }> = [];

    if (request.reportType === 'monthly_activity') {
      rows = viewModel.rowsByMode.documents ?? [];
      seriesTitle = evolutionViewModel.title;
      seriesPoints = evolutionViewModel.points;
    } else if (request.reportType === 'delays') {
      rows = workflowRows.filter((row) => row.status === 'attention' || row.status === 'info');
      if (rows.length === 0) rows = workflowRows;
    } else if (request.reportType === 'by_service') {
      rows = request.scopeId === 'institution'
        ? servicesRows
        : servicesRows.filter((row) => row.indicator === request.scopeLabel);
    } else if (request.reportType === 'workflows') {
      rows = workflowRows;
    }

    await generateReportsDocument({
      reportType: request.reportType,
      format: request.format,
      detailLevel: request.detailLevel,
      periodLabel: request.periodLabel,
      scopeLabel: request.scopeLabel,
      rows,
      seriesTitle,
      seriesPoints,
    });
  };

  const handleExport = () => {
    if (inDocumentsView) {
      exportReportsSeriesCsv(evolutionViewModel.points, selectedSeries);
      return;
    }
    void exportReportsRowsExcel(currentRows, activeTab);
  };

  const handleRefresh = () => {
    void reload();
    void reloadEvolution();
  };

  const handleTablistKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TAB_ORDER.length;
    else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = TAB_ORDER.length - 1;
    else return;
    e.preventDefault();
    const nextTab = TAB_ORDER[nextIndex]!;
    setViewMode(nextTab);
    document.getElementById(`tab-reports-${nextTab}`)?.focus();
  };

  return (
    <div className="p-8 pb-8 flex flex-col h-full min-h-0 animate-in fade-in duration-500">
      <header className="mb-6 shrink-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 min-w-0">
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-4xl text-rdpc-blue shrink-0">monitoring</span>
              <span className="break-words">Rapports &amp; Statistiques</span>
            </h1>
            <InlineHelpButton
              content={TAB_HELP[activeTab]}
              label={`Aide sur l'onglet ${activeMeta.label}`}
              className="shrink-0 pt-1"
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title={UI_TOOLTIPS.reports.refresh}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden>refresh</span>
              Actualiser
            </button>
            <button
              type="button"
              onClick={handleExport}
              title={UI_TOOLTIPS.reports.exportTable}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>download</span>
              Exporter la vue
            </button>
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              title={UI_TOOLTIPS.reports.generateReport}
              className="inline-flex items-center gap-2 rounded-2xl bg-rdpc-blue px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition-colors hover:bg-black"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>description</span>
              Générer un rapport
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 h-full min-h-0">
        <div
          role="tablist"
          aria-label="Vues des rapports"
          className="flex gap-2.5 border-b-2 border-slate-200 shrink-0 overflow-x-auto custom-scrollbar"
          onKeyDown={handleTablistKeyDown}
        >
          {TAB_ORDER.map((tab) => {
            const meta = TAB_META[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                id={`tab-reports-${tab}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`panel-reports-${tab}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setViewMode(tab)}
                className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2.5 whitespace-nowrap ${
                  isActive
                    ? 'text-rdpc-blue border-b-4 border-rdpc-blue mb-[-2px]'
                    : 'text-slate-400 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    isActive ? 'bg-rdpc-blue text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                  aria-hidden="true"
                >
                  {meta.step}
                </span>
                <span className={`material-symbols-outlined text-base ${meta.accent}`} aria-hidden="true">{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
        </div>

        <div
          id={`panel-reports-${activeTab}`}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`tab-reports-${activeTab}`}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 focus:outline-none"
        >
          {error ? (
            <div className="rounded-[2rem] border border-red-100 bg-red-50 px-6 py-10 text-center">
              <p className="text-base font-bold text-red-600">{error}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {activeTab === 'synthese' && (
                <ReportsSummaryPanel
                  status={viewModel.summaryStatus}
                  kpis={viewModel.kpis}
                  actions={viewModel.summaryActions}
                  chart={evolutionViewModel.summaryChart}
                  chartLabel={evolutionViewModel.periodLabel}
                  chartLoading={isEvolutionLoading}
                  chartError={evolutionError}
                />
              )}

              {activeTab === 'documents' && (
                <ReportsDocumentPanel
                  kpis={viewModel.documentKpis}
                  granularity={granularity}
                  onGranularityChange={setGranularity}
                  selectedSeries={selectedSeries}
                  onSeriesChange={setSelectedSeries}
                  onRefresh={() => void reloadEvolution()}
                  points={evolutionViewModel.points}
                  totalValue={evolutionViewModel.totalValue}
                  topUnits={evolutionViewModel.topUnits}
                  periodLabel={evolutionViewModel.periodLabel}
                  totalLabel={evolutionViewModel.totalLabel}
                  topUnitsLabel={evolutionViewModel.topUnitsLabel}
                  timeseriesLoading={isEvolutionLoading}
                  timeseriesError={evolutionError}
                  activity={documentActivity}
                  activityLoading={isLoading}
                  activityError={documentActivityError}
                />
              )}

              {activeTab === 'workflows' && (
                <ReportsWorkflowPanel
                  kpis={viewModel.workflowKpis}
                  activity={workflowActivity}
                  loading={isLoading}
                  error={workflowActivityError}
                />
              )}

              {activeTab === 'services' && (
                <>
                  <ReportsKpiGrid items={viewModel.serviceKpis} />
                  <ReportsServiceActivityPanel
                    activity={serviceActivity}
                    loading={isLoading}
                    error={serviceActivityError}
                  />
                </>
              )}

              {activeTab !== 'synthese' ? (
                isLoading ? (
                  <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                    <div className="flex items-center justify-center py-20">
                      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rdpc-blue" />
                    </div>
                  </div>
                ) : currentRows.length === 0 ? (
                  <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                    <Empty icon="monitoring" msg={activeMeta.empty} />
                  </div>
                ) : (
                  <ReportsTableSection rows={currentRows} viewMode={activeTab} loading={isLoading} />
                )
              ) : null}
            </div>
          )}
        </div>
      </div>

      <ReportGenerationModal
        open={isReportModalOpen}
        defaultViewMode={activeTab}
        defaultPeriodLabel={defaultReportPeriodLabel}
        scopeOptions={reportScopeOptions}
        onClose={() => setIsReportModalOpen(false)}
        onGenerate={handleGenerateReport}
      />
    </div>
  );
};

export default ReportsPage;
