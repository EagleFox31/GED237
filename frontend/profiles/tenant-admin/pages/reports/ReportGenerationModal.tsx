import React, { useEffect, useState } from 'react';

import type {
  ReportsGeneratedReportFormat,
  ReportsGeneratedReportType,
  ReportsReportDetailLevel,
} from './reportsExport';
import type { ReportsViewMode } from './reportsViewModel';

interface ReportScopeOption {
  id: string;
  label: string;
}

export interface ReportGenerationRequest {
  reportType: ReportsGeneratedReportType;
  format: ReportsGeneratedReportFormat;
  detailLevel: ReportsReportDetailLevel;
  periodLabel: string;
  scopeId: string;
  scopeLabel: string;
}

interface ReportGenerationModalProps {
  open: boolean;
  defaultViewMode: ReportsViewMode;
  defaultPeriodLabel: string;
  scopeOptions: ReportScopeOption[];
  onClose: () => void;
  onGenerate: (request: ReportGenerationRequest) => Promise<void> | void;
}

const REPORT_TYPE_OPTIONS: Array<{ value: ReportsGeneratedReportType; label: string; helper: string }> = [
  {
    value: 'monthly_activity',
    label: "Rapport d'activité documentaire",
    helper: 'Volumes, statuts, tendances et vigilance documentaire.',
  },
  {
    value: 'delays',
    label: 'Rapport des retards',
    helper: 'Retards estimés, blocages et points d’attente.',
  },
  {
    value: 'by_service',
    label: 'Rapport par service',
    helper: 'Charge documentaire et lecture comparative des unités.',
  },
  {
    value: 'workflows',
    label: 'Rapport du traitement',
    helper: 'Validations, signatures, retours et lenteurs visibles.',
  },
];

const FORMAT_OPTIONS: Array<{ value: ReportsGeneratedReportFormat; label: string; helper: string }> = [
  { value: 'excel', label: 'Excel', helper: 'Fichier de travail réutilisable.' },
  { value: 'csv', label: 'CSV', helper: 'Extraction simple et légère.' },
  { value: 'pdf', label: 'PDF', helper: "Version d impression ou de partage immédiat." },
];

const DETAIL_OPTIONS: Array<{ value: ReportsReportDetailLevel; label: string }> = [
  { value: 'synthese', label: 'Synthétique' },
  { value: 'standard', label: 'Standard' },
  { value: 'detaille', label: 'Détaillé' },
];

const DEFAULT_TYPE_BY_VIEW: Record<ReportsViewMode, ReportsGeneratedReportType> = {
  synthese: 'monthly_activity',
  documents: 'monthly_activity',
  workflows: 'workflows',
  services: 'by_service',
};

export const ReportGenerationModal: React.FC<ReportGenerationModalProps> = ({
  open,
  defaultViewMode,
  defaultPeriodLabel,
  scopeOptions,
  onClose,
  onGenerate,
}) => {
  const [reportType, setReportType] = useState<ReportsGeneratedReportType>(DEFAULT_TYPE_BY_VIEW[defaultViewMode]);
  const [format, setFormat] = useState<ReportsGeneratedReportFormat>('excel');
  const [detailLevel, setDetailLevel] = useState<ReportsReportDetailLevel>('standard');
  const [periodLabel, setPeriodLabel] = useState(defaultPeriodLabel);
  const [scopeId, setScopeId] = useState(scopeOptions[0]?.id ?? 'institution');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReportType(DEFAULT_TYPE_BY_VIEW[defaultViewMode]);
    setFormat('excel');
    setDetailLevel('standard');
    setPeriodLabel(defaultPeriodLabel);
    setScopeId(scopeOptions[0]?.id ?? 'institution');
  }, [defaultPeriodLabel, defaultViewMode, open, scopeOptions]);

  if (!open) return null;

  const selectedScope = scopeOptions.find((option) => option.id === scopeId) ?? scopeOptions[0];

  const handleSubmit = async () => {
    if (!selectedScope) return;
    setIsSubmitting(true);
    try {
      await onGenerate({
        reportType,
        format,
        detailLevel,
        periodLabel,
        scopeId: selectedScope.id,
        scopeLabel: selectedScope.label,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
      <div className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Génération de rapport
            </p>
            <h3 className="mt-2 text-3xl font-black uppercase italic tracking-tight text-slate-900">
              Générer un rapport
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Préparez un rapport propre à partager ou à exploiter sans quitter le centre de pilotage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-400 transition hover:text-slate-700"
            aria-label="Fermer la génération de rapport"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Type de rapport
            </span>
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportsGeneratedReportType)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-rdpc-blue"
            >
              {REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {REPORT_TYPE_OPTIONS.find((option) => option.value === reportType)?.helper}
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Période
            </span>
            <input
              value={periodLabel}
              onChange={(event) => setPeriodLabel(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-rdpc-blue"
              placeholder="Ex. 30 derniers jours"
            />
            <p className="text-xs text-slate-500">
              La période affichée ici sera reprise dans la couverture du rapport.
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Service ou direction
            </span>
            <select
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-rdpc-blue"
            >
              {scopeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Le rapport par service sait réutiliser ce périmètre plus finement que les autres vues.
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Format
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FORMAT_OPTIONS.map((option) => {
                const active = option.value === format;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormat(option.value)}
                    className={`rounded-[1.4rem] border px-4 py-3 text-left transition ${
                      active
                        ? 'border-rdpc-blue bg-blue-50 text-rdpc-blue'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-sm font-black uppercase tracking-wide">{option.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{option.helper}</span>
                  </button>
                );
              })}
            </div>
          </label>
        </div>

        <div className="mt-6">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Niveau de détail
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {DETAIL_OPTIONS.map((option) => {
              const active = option.value === detailLevel;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDetailLevel(option.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          <p className="font-bold text-slate-800">Ce qui sera préparé :</p>
          <ul className="mt-2 space-y-1.5">
            <li>Rapport : {REPORT_TYPE_OPTIONS.find((option) => option.value === reportType)?.label}</li>
            <li>Période : {periodLabel || 'Non précisée'}</li>
            <li>Périmètre : {selectedScope?.label ?? 'Institution entière'}</li>
            <li>Format : {FORMAT_OPTIONS.find((option) => option.value === format)?.label}</li>
            <li>Détail : {DETAIL_OPTIONS.find((option) => option.value === detailLevel)?.label}</li>
          </ul>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={isSubmitting}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting ? 'Préparation...' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  );
};
