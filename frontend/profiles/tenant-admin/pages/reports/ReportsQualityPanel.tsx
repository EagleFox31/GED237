import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Empty } from '../../../../components/ui/Empty';
import {
  qualityApi,
  type QualityAlert,
  type QualityAlertMeasure,
  type QualityDocument,
  type QualityIndicatorKey,
  type QualitySummary,
} from '../../../../services/resources/quality.api';

const PAGE_SIZE = 50;

const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${Math.round(value * 10) / 10} %`;

const card = 'rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm';

interface ReportsQualityPanelProps {
  /** Incrémenté par « Actualiser » de la page. */
  refreshKey: number;
}

/**
 * Onglet Qualité des rapports (#162) : documents incomplets par indicateur, et alertes
 * quand un indicateur dépasse un seuil (#183). Le serveur limite le périmètre (service du Manager).
 */
export const ReportsQualityPanel: React.FC<ReportsQualityPanelProps> = ({ refreshKey }) => {
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [selected, setSelected] = useState<QualityIndicatorKey | null>(null);
  const [docs, setDocs] = useState<{ items: QualityDocument[]; total: number; loading: boolean }>({
    items: [],
    total: 0,
    loading: false,
  });
  const docsSeq = useRef(0);
  const [alerts, setAlerts] = useState<QualityAlert[]>([]);

  useEffect(() => {
    let alive = true;
    setSummaryFailed(false);
    qualityApi
      .getQualitySummary()
      .then((data) => alive && setSummary(data))
      .catch(() => alive && setSummaryFailed(true));
    qualityApi
      .listQualityAlerts()
      .then((data) => alive && setAlerts(data))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const loadDocs = useCallback(async (indicator: QualityIndicatorKey, offset: number) => {
    const seq = ++docsSeq.current;
    setDocs((d) => ({ ...(offset === 0 ? { items: [], total: 0 } : d), loading: true }));
    try {
      const page = await qualityApi.getQualityDocuments(indicator, { limit: PAGE_SIZE, offset });
      if (seq !== docsSeq.current) return;
      setDocs((d) => ({ items: offset === 0 ? page.items : [...d.items, ...page.items], total: page.total, loading: false }));
    } catch {
      if (seq === docsSeq.current) setDocs((d) => ({ ...d, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (selected) void loadDocs(selected, 0);
  }, [selected, refreshKey, loadDocs]);

  const labelOf = (key: QualityIndicatorKey) => summary?.indicators.find((i) => i.key === key)?.label ?? key;

  if (summaryFailed && !summary) {
    return (
      <div className={card}>
        <Empty icon="fact_check" msg="Impossible de charger la qualité des documents." />
      </div>
    );
  }
  if (!summary) {
    return (
      <div className={`${card} flex items-center justify-center py-20`}>
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rdpc-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={card}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documents complets</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{percent(summary.quality_rate)}</p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">À compléter</p>
          <p className="mt-2 text-3xl font-black text-slate-800">
            {summary.documents_to_fix}
            <span className="ml-2 text-sm font-bold text-slate-400">sur {summary.total_documents}</span>
          </p>
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-700">Ce qui manque</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.indicators.map((indicator) => {
            const active = selected === indicator.key;
            return (
              <button
                key={indicator.key}
                type="button"
                aria-pressed={active}
                disabled={indicator.count === 0}
                onClick={() => setSelected(active ? null : indicator.key)}
                className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition-all disabled:cursor-default disabled:opacity-50 ${
                  active ? 'border-rdpc-blue bg-blue-50' : 'border-slate-100 hover:border-slate-300'
                }`}
              >
                <span className="text-sm font-bold text-slate-700">{indicator.label}</span>
                <span className="ml-3 shrink-0 text-right">
                  <span className="block text-lg font-black text-slate-900">{indicator.count}</span>
                  <span className="block text-[10px] font-bold text-slate-400">{percent(indicator.rate)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">
              {labelOf(selected)} · {docs.total}
            </p>
            {docs.items.length === 0 && !docs.loading ? (
              <p className="text-sm text-slate-400">Aucun document.</p>
            ) : (
              <ul aria-label={`Documents : ${labelOf(selected)}`} className="divide-y divide-slate-100">
                {docs.items.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="truncate font-bold text-slate-700">{doc.title}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {docs.items.length < docs.total && (
              <button
                type="button"
                disabled={docs.loading}
                onClick={() => void loadDocs(selected, docs.items.length)}
                className="mt-3 rounded-2xl border-2 border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:border-rdpc-blue hover:text-rdpc-blue disabled:opacity-50"
              >
                Voir plus
              </button>
            )}
          </div>
        )}
      </div>

      <QualityAlertsCard
        alerts={alerts}
        indicators={summary.indicators.map(({ key, label }) => ({ key, label }))}
        labelOf={labelOf}
        onCreated={(alert) => setAlerts((list) => [...list, alert])}
        onStopped={(id) => setAlerts((list) => list.filter((a) => a.id !== id))}
      />
    </div>
  );
};

interface QualityAlertsCardProps {
  alerts: QualityAlert[];
  indicators: Array<{ key: QualityIndicatorKey; label: string }>;
  labelOf: (key: QualityIndicatorKey) => string;
  onCreated: (alert: QualityAlert) => void;
  onStopped: (id: string) => void;
}

const QualityAlertsCard: React.FC<QualityAlertsCardProps> = ({ alerts, indicators, labelOf, onCreated, onStopped }) => {
  const [name, setName] = useState('');
  const [indicator, setIndicator] = useState<QualityIndicatorKey | ''>('');
  const [measure, setMeasure] = useState<QualityAlertMeasure>('count');
  const [threshold, setThreshold] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  const value = Number(threshold);
  const valid =
    name.trim() !== '' && indicator !== '' && value > 0 && (measure === 'count' || value <= 100);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return; // valid implique un indicateur choisi (rétrécissement TS)
    setSubmitting(true);
    setRefused(null);
    try {
      const result = await qualityApi.createQualityAlert({ name: name.trim(), indicator, measure, threshold: value });
      if ('refused' in result) {
        setRefused(result.refused);
      } else {
        onCreated(result.alert);
        setName('');
        setThreshold('');
      }
    } catch {
      // Erreur HTTP déjà affichée par le bus global.
    } finally {
      setSubmitting(false);
    }
  };

  const stop = async (id: string) => {
    setStopping(id);
    try {
      await qualityApi.stopQualityAlert(id);
      onStopped(id);
    } catch {
      // Erreur HTTP déjà affichée par le bus global.
    } finally {
      setStopping(null);
    }
  };

  const field =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-rdpc-blue focus:outline-none';

  return (
    <div className={card}>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Mes alertes</h3>
        <span
          className="material-symbols-outlined cursor-help text-[18px] text-slate-400 hover:text-rdpc-blue"
          role="img"
          aria-label="Vous recevez une notification quand le seuil est atteint, puis quand il redescend."
          title="Vous recevez une notification quand le seuil est atteint, puis quand il redescend."
        >
          help
        </span>
      </div>

      {alerts.length === 0 ? (
        <p className="mb-4 text-sm text-slate-400">Aucune alerte.</p>
      ) : (
        <ul aria-label="Mes alertes" className="mb-4 divide-y divide-slate-100">
          {alerts.map((alert) => (
            <li key={alert.id} aria-label={alert.name} className="flex items-center justify-between gap-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-700">{alert.name}</p>
                <p className="text-xs text-slate-400">
                  {labelOf(alert.indicator)} ≥ {alert.threshold}
                  {alert.measure === 'rate' ? ' %' : ' documents'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {alert.alerting_since && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-600">
                    Seuil atteint
                  </span>
                )}
                <button
                  type="button"
                  disabled={stopping === alert.id}
                  onClick={() => void stop(alert.id)}
                  className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-red-600 disabled:opacity-50"
                >
                  Arrêter
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} aria-label="Nouvelle alerte" className="flex flex-wrap items-end gap-3">
        <input
          aria-label="Nom de l'alerte"
          placeholder="Nom"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${field} min-w-[10rem] flex-1`}
        />
        <select
          aria-label="Indicateur"
          value={indicator}
          onChange={(e) => setIndicator(e.target.value as QualityIndicatorKey | '')}
          className={field}
        >
          <option value="">Indicateur…</option>
          {indicators.map((i) => (
            <option key={i.key} value={i.key}>
              {i.label}
            </option>
          ))}
        </select>
        <input
          aria-label="Seuil"
          type="number"
          min={0}
          max={measure === 'rate' ? 100 : undefined}
          step="any"
          placeholder="Seuil"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className={`${field} w-24`}
        />
        <select
          aria-label="Unité du seuil"
          value={measure}
          onChange={(e) => setMeasure(e.target.value as QualityAlertMeasure)}
          className={field}
        >
          <option value="count">documents</option>
          <option value="rate">%</option>
        </select>
        <button
          type="submit"
          disabled={!valid || submitting}
          className="rounded-xl bg-rdpc-blue px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-black disabled:opacity-50"
        >
          Créer
        </button>
      </form>
      {refused && (
        <p role="alert" className="mt-3 text-sm font-bold text-amber-700">
          {refused}
        </p>
      )}
    </div>
  );
};
