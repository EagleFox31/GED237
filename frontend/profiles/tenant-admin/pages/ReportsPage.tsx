import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Empty } from '../../../components/ui/Empty';
import { useAuthStore } from '../../../stores/authStore';
import { InlineHelpButton } from '../../../components/ui/InlineHelpButton';
import { UI_TOOLTIPS } from '../../../content/uiTooltips';
import { exportReportsRowsExcel, exportReportsSeriesCsv, generateReportsDocument } from './reports/reportsExport';
import { ReportsDocumentPanel } from './reports/ReportsDocumentPanel';
import { ReportsKpiGrid } from './reports/ReportsKpiGrid';
import { OfficialReportModal } from './reports/OfficialReportModal';
import type { OfficialReportKind } from '../../../services/resources/officialReports.api';
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

// Manager : vue limitée à son service, sans la synthèse ni les compteurs de l'institution.
const UNIT_TAB_ORDER: ReportsViewMode[] = TAB_ORDER.filter((tab) => tab !== 'synthese');

const TAB_HELP: Record<ReportsViewMode, string> = {
  synthese: UI_TOOLTIPS.reports.tabSynthese,
  documents: UI_TOOLTIPS.reports.tabDocuments,
  workflows: UI_TOOLTIPS.reports.tabWorkflows,
  services: UI_TOOLTIPS.reports.tabServices,
};

/** Rapport proposé pour la copie officielle selon l'onglet ouvert. */
const OFFICIAL_KIND: Record<ReportsViewMode, OfficialReportKind> = {
  synthese: 'evolution',
  workflows: 'workflow-activity',
  services: 'service-activity',
  documents: 'document-activity',
};

const ReportsPage: React.FC = () => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isOfficialOpen, setIsOfficialOpen] = useState(false);
  // Stable : le dialogue (DialogFrame) relance sa mise au point si onClose change.
  const closeOfficial = useCallback(() => setIsOfficialOpen(false), []);

  const { filters, setViewMode } = useReportsFilters();
  const isUnitScope = useAuthStore((s) => s.userProfile?.id) === 'manager';
  const tabOrder = isUnitScope ? UNIT_TAB_ORDER : TAB_ORDER;
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
  } = useReportsData(isUnitScope ? 'unit' : 'tenant');
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

  const activeTab = tabOrder.includes(filters.viewMode) ? filters.viewMode : tabOrder[0]!;
  // Garde l'état des filtres cohérent avec l'onglet affiché (ex. Synthèse demandée par un Manager).
  useEffect(() => {
    if (activeTab !== filters.viewMode) setViewMode(activeTab);
  }, [activeTab, filters.viewMode, setViewMode]);
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
    const currentIndex = tabOrder.indexOf(activeTab);
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabOrder.length;
    else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = tabOrder.length - 1;
    else return;
    e.preventDefault();
    const nextTab = tabOrder[nextIndex]!;
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
              onClick={() => setIsOfficialOpen(true)}
              title={UI_TOOLTIPS.reports.officialCopy}
              aria-describedby="official-copy-hint"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">verified</span>
              Copie officielle
            </button>
            {/* Le title ne s'affiche ni au clavier ni au toucher : même texte lu par les lecteurs d'écran. */}
            <span id="official-copy-hint" className="sr-only">{UI_TOOLTIPS.reports.officialCopy}</span>
            {!isUnitScope && (
              <>
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
              </>
            )}
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
          {tabOrder.map((tab, index) => {
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
                  {index + 1}
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
                  kpis={isUnitScope ? [] : viewModel.documentKpis}
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
                  kpis={isUnitScope ? [] : viewModel.workflowKpis}
                  activity={workflowActivity}
                  loading={isLoading}
                  error={workflowActivityError}
                />
              )}

              {activeTab === 'services' && (
                <>
                  {!isUnitScope && <ReportsKpiGrid items={viewModel.serviceKpis} />}
                  <ReportsServiceActivityPanel
                    activity={serviceActivity}
                    loading={isLoading}
                    error={serviceActivityError}
                  />
                </>
              )}

              {activeTab !== 'synthese' && !isUnitScope ? (
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
      {isOfficialOpen && (
        <OfficialReportModal defaultKind={OFFICIAL_KIND[activeTab]} onClose={closeOfficial} />
      )}
    </div>
  );
};

export default ReportsPage;
