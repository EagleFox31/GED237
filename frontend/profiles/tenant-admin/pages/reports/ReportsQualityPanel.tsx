import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Empty } from '../../../../components/ui/Empty';
import { InlineHelpButton } from '../../../../components/ui/InlineHelpButton';
import { createSingleFlight } from '../../../../lib/singleFlight';
import {
  qualityApi,
  type QualityAlert,
  type QualityAlertMeasure,
  type QualityDocument,
  type QualityIndicatorKey,
  type QualitySummary,
} from '../../../../services/resources/quality.api';
import { formatDate } from '../../../../types';
import {
  alertFormProblem,
  alertsMessage,
  documentHref,
  documentsMessage,
  formatCount,
  formatPercent,
  thresholdText,
  type ListLoad,
} from './qualityView';

const PAGE_SIZE = 50;

const card = 'rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm';

interface ReportsQualityPanelProps {
  /** Incrémenté par « Actualiser » de la page. */
  refreshKey: number;
  /** Affiché quand l'institution n'a encore aucun document. */
  emptyMessage: string;
  /** Lecture en cours (indicateurs ou alertes) ; stable (setState de la page). */
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Onglet Qualité des rapports (#162) : documents incomplets par indicateur, et alertes
 * quand un indicateur dépasse un seuil (#183). Le serveur limite le périmètre (service du Manager).
 */
export const ReportsQualityPanel: React.FC<ReportsQualityPanelProps> = ({ refreshKey, emptyMessage, onLoadingChange }) => {
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [selected, setSelected] = useState<QualityIndicatorKey | null>(null);
  const [docs, setDocs] = useState<{ items: QualityDocument[]; total: number; load: ListLoad }>({
    items: [],
    total: 0,
    load: 'ready',
  });
  const docsSeq = useRef(0);
  const [alerts, setAlerts] = useState<QualityAlert[]>([]);
  const [alertsLoad, setAlertsLoad] = useState<ListLoad>('loading');

  useEffect(() => {
    let alive = true;
    setSummaryFailed(false);
    setSummaryLoading(true);
    setAlertsLoad('loading');
    qualityApi
      .getQualitySummary()
      .then((data) => alive && setSummary(data))
      .catch(() => alive && setSummaryFailed(true))
      .finally(() => alive && setSummaryLoading(false));
    qualityApi
      .listQualityAlerts()
      .then((data) => {
        if (!alive) return;
        setAlerts(data);
        setAlertsLoad('ready');
      })
      // L'erreur HTTP passe par le bus global ; ici on évite seulement d'afficher « Aucune alerte. ».
      .catch(() => alive && setAlertsLoad('failed'));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const loading = summaryLoading || alertsLoad === 'loading';
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);
  // Onglet quitté : la page ne doit pas garder « Actualiser » en rotation.
  useEffect(() => () => onLoadingChange?.(false), [onLoadingChange]);

  const loadDocs = useCallback(async (indicator: QualityIndicatorKey, offset: number) => {
    const seq = ++docsSeq.current;
    setDocs((d) => ({ ...(offset === 0 ? { items: [], total: 0 } : d), load: 'loading' }));
    try {
      const page = await qualityApi.getQualityDocuments(indicator, { limit: PAGE_SIZE, offset });
      if (seq !== docsSeq.current) return;
      setDocs((d) => ({ items: offset === 0 ? page.items : [...d.items, ...page.items], total: page.total, load: 'ready' }));
    } catch {
      if (seq === docsSeq.current) setDocs((d) => ({ ...d, load: 'failed' }));
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

  const docsNotice = documentsMessage(docs.load, docs.items.length);
  const alertsCard = (
    <QualityAlertsCard
      alerts={alerts}
      load={alertsLoad}
      indicators={summary.indicators.map(({ key, label }) => ({ key, label }))}
      labelOf={labelOf}
      refreshKey={refreshKey}
      onCreated={(alert) => setAlerts((list) => [...list, alert])}
      onStopped={(id) => setAlerts((list) => list.filter((a) => a.id !== id))}
    />
  );

  if (summary.total_documents === 0) {
    return (
      <div className="space-y-6">
        <div className={card}>
          <Empty icon="fact_check" msg={emptyMessage} />
        </div>
        {alertsCard}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={card}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documents complets</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{formatPercent(summary.quality_rate)}</p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">À compléter</p>
          <p className="mt-2 text-3xl font-black text-slate-800">
            {formatCount(summary.documents_to_fix)}
            <span className="ml-2 text-sm font-bold text-slate-400">sur {formatCount(summary.total_documents)}</span>
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
                // Indicateur retombé à 0 après « Actualiser » : il reste cliquable pour refermer sa liste.
                disabled={indicator.count === 0 && !active}
                onClick={() => setSelected(active ? null : indicator.key)}
                className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition-all disabled:cursor-default disabled:opacity-50 ${
                  active ? 'border-rdpc-blue bg-blue-50' : 'border-slate-100 hover:border-slate-300'
                }`}
              >
                <span className="text-sm font-bold text-slate-700">{indicator.label}</span>
                <span className="ml-3 shrink-0 text-right">
                  <span className="block text-lg font-black text-slate-900">{formatCount(indicator.count)}</span>
                  <span className="block text-[10px] font-bold text-slate-400">{formatPercent(indicator.rate)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-6 border-t border-slate-100 pt-4" aria-busy={docs.load === 'loading'}>
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">
              {labelOf(selected)} · {formatCount(docs.total)}
            </p>
            {docsNotice ? (
              <p className={`text-sm ${docs.load === 'failed' ? 'font-bold text-amber-700' : 'text-slate-400'}`}>
                {docsNotice}
              </p>
            ) : (
              <ul aria-label={`Documents : ${labelOf(selected)}`} className="divide-y divide-slate-100">
                {docs.items.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <Link
                      to={documentHref(doc.id)}
                      className="truncate font-bold text-slate-700 hover:text-rdpc-blue hover:underline"
                    >
                      {doc.title}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-400">{doc.created_at ? formatDate(doc.created_at) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            {docs.items.length > 0 && docs.load === 'failed' && (
              <p className="mt-3 text-sm font-bold text-amber-700">Suite indisponible pour le moment.</p>
            )}
            {docs.items.length < docs.total && (
              <button
                type="button"
                disabled={docs.load === 'loading'}
                onClick={() => void loadDocs(selected, docs.items.length)}
                className="mt-3 rounded-2xl border-2 border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:border-rdpc-blue hover:text-rdpc-blue disabled:opacity-50"
              >
                Voir plus
              </button>
            )}
          </div>
        )}
      </div>

      {alertsCard}
    </div>
  );
};

interface QualityAlertsCardProps {
  alerts: QualityAlert[];
  load: ListLoad;
  indicators: Array<{ key: QualityIndicatorKey; label: string }>;
  labelOf: (key: QualityIndicatorKey) => string;
  /** « Actualiser » de la page : efface un refus (409) devenu peut-être caduc. */
  refreshKey: number;
  onCreated: (alert: QualityAlert) => void;
  onStopped: (id: string) => void;
}

const QualityAlertsCard: React.FC<QualityAlertsCardProps> = ({
  alerts,
  load,
  indicators,
  labelOf,
  refreshKey,
  onCreated,
  onStopped,
}) => {
  const [name, setName] = useState('');
  const [indicator, setIndicator] = useState<QualityIndicatorKey | ''>('');
  const [measure, setMeasure] = useState<QualityAlertMeasure>('count');
  const [threshold, setThreshold] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);
  // Un verrou par action : un double clic ne part qu'une fois, mais une création en cours
  // ne rend pas « Oui, arrêter » muet (et inversement).
  const [createFlight] = useState(createSingleFlight);
  const [stopFlight] = useState(createSingleFlight);
  // Focus rendu après « Non » (bouton « Arrêter » de la ligne) ou après un arrêt (titre de la carte),
  // pour qu'il ne retombe pas en haut de la page.
  const [refocusStopId, setRefocusStopId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setRefused(null);
  }, [refreshKey]);

  useEffect(() => {
    if (!refocusStopId) return;
    document.getElementById(`quality-stop-${refocusStopId}`)?.focus();
    setRefocusStopId(null);
  }, [refocusStopId]);

  const cancelStop = (id: string) => {
    setConfirmStopId(null);
    setRefocusStopId(id);
  };

  const problem = alertFormProblem({ name, indicator, measure, threshold });
  // Le motif ne s'affiche qu'une fois la saisie commencée : un formulaire vierge ne gronde pas.
  const started = name !== '' || indicator !== '' || threshold !== '';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (problem !== null || indicator === '') return; // indicator === '' : rétrécissement TS
    const input = { name: name.trim(), indicator, measure, threshold: Number(threshold) };
    void createFlight
      .run(async () => {
        setSubmitting(true);
        setRefused(null);
        try {
          const result = await qualityApi.createQualityAlert(input);
          if ('refused' in result) {
            setRefused(result.refused);
          } else {
            onCreated(result.alert);
            setName('');
            setThreshold('');
          }
        } finally {
          setSubmitting(false);
        }
      })
      .catch(() => undefined); // Erreur HTTP déjà affichée par le bus global.
  };

  const stop = (id: string) => {
    void stopFlight
      .run(async () => {
        setStopping(id);
        try {
          await qualityApi.stopQualityAlert(id);
          setConfirmStopId(null);
          onStopped(id);
          headingRef.current?.focus();
        } finally {
          setStopping(null);
        }
      })
      .catch(() => undefined); // Erreur HTTP déjà affichée par le bus global.
  };

  const field =
    'mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-rdpc-blue focus:outline-none';
  const fieldLabel = 'text-[11px] font-bold text-slate-500';
  const notice = alertsMessage(load, alerts.length);

  return (
    <div className={card}>
      <div className="mb-4 flex items-center gap-2">
        <h3 ref={headingRef} tabIndex={-1} className="text-sm font-black uppercase tracking-widest text-slate-700 focus:outline-none">
          Mes alertes
        </h3>
        <InlineHelpButton
          label="Aide sur les alertes"
          content="Vous recevez une notification quand le seuil est atteint, puis quand il redescend."
        />
      </div>

      {notice && (
        <p className={`mb-4 text-sm ${load === 'failed' ? 'font-bold text-amber-700' : 'text-slate-400'}`}>{notice}</p>
      )}
      {alerts.length > 0 && (
        <ul aria-label="Mes alertes" className="mb-4 divide-y divide-slate-100">
          {alerts.map((alert) => (
            <li key={alert.id} aria-label={alert.name} className="flex items-center justify-between gap-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-700">{alert.name}</p>
                <p className="text-xs text-slate-400">{thresholdText(labelOf(alert.indicator), alert.threshold, alert.measure)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {alert.alerting_since && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-600">
                    Seuil atteint
                  </span>
                )}
                {confirmStopId === alert.id ? (
                  <>
                    <span className="text-xs font-bold text-slate-600">Arrêter cette alerte ?</span>
                    <button
                      type="button"
                      autoFocus
                      disabled={stopping === alert.id}
                      aria-label={`Confirmer l’arrêt de ${alert.name}`}
                      onClick={() => stop(alert.id)}
                      className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Oui, arrêter
                    </button>
                    <button
                      type="button"
                      disabled={stopping === alert.id}
                      onClick={() => cancelStop(alert.id)}
                      className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Non
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    id={`quality-stop-${alert.id}`}
                    aria-label={`Arrêter ${alert.name}`}
                    onClick={() => setConfirmStopId(alert.id)}
                    className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-red-600"
                  >
                    Arrêter
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Refus du serveur (alertes coupées) : inutile de laisser remplir le formulaire. */}
      {refused ? (
        <p role="alert" className="text-sm font-bold text-amber-700">
          {refused}
        </p>
      ) : (
        // noValidate : `alertFormProblem` est la seule règle du seuil (celle de l'API) ; le navigateur
        // ne bloque pas en silence une valeur qu'elle accepte, comme 0,05 %.
        <form onSubmit={submit} aria-label="Nouvelle alerte" noValidate>
          <div className="flex flex-wrap items-end gap-3">
            <label className={`${fieldLabel} min-w-[10rem] flex-1`}>
              Nom
              <input
                aria-label="Nom de l'alerte"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
              />
            </label>
            <label className={fieldLabel}>
              Indicateur
              <select
                aria-label="Indicateur"
                value={indicator}
                onChange={(e) => setIndicator(e.target.value as QualityIndicatorKey | '')}
                className={field}
              >
                <option value="">Choisir…</option>
                {indicators.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${fieldLabel} w-24`}>
              Seuil
              <input
                aria-label="Seuil"
                type="number"
                min={measure === 'rate' ? 0 : 1}
                max={measure === 'rate' ? 100 : undefined}
                step={measure === 'rate' ? 'any' : 1}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className={field}
              />
            </label>
            <label className={fieldLabel}>
              Unité
              <select
                aria-label="Unité du seuil"
                value={measure}
                onChange={(e) => setMeasure(e.target.value as QualityAlertMeasure)}
                className={field}
              >
                <option value="count">documents</option>
                <option value="rate">%</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={problem !== null || submitting}
              aria-describedby={started && problem ? 'quality-alert-problem' : undefined}
              className="rounded-xl bg-rdpc-blue px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-black disabled:opacity-50"
            >
              Créer
            </button>
          </div>
          <p id="quality-alert-problem" aria-live="polite" className="mt-2 min-h-[1rem] text-xs font-medium text-slate-500">
            {started ? problem : null}
          </p>
        </form>
      )}
    </div>
  );
};
