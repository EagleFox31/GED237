import React, { useCallback, useEffect, useState } from 'react';

import { formatDate } from '../../../../types';
import { officialReportsApi } from '../../../../services';
import type {
  OfficialCopy,
  OfficialReportFormat,
  OfficialReportIssue,
  OfficialReportKind,
  OfficialReportRequest,
  OfficialReportSchedule,
  ReportFrequency,
} from '../../../../services/resources/officialReports.api';
import { InlineHelpButton } from '../../../../components/ui/InlineHelpButton';
import { downloadBlob } from './reportsExport';

type Section = 'issue' | 'register' | 'schedules';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'issue', label: 'Émettre' },
  { id: 'register', label: 'Registre' },
  { id: 'schedules', label: 'Programmés' },
];

export const KIND_LABELS: Record<OfficialReportKind, string> = {
  evolution: 'Évolution',
  'document-activity': 'Activité documentaire',
  'workflow-activity': 'Traitement & délais',
  'service-activity': 'Services',
};

const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
};

const PAGE_SIZE = 20;

const fieldClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-rdpc-blue focus:outline-none';
const labelClass = 'mb-1 block text-xs font-bold text-slate-500';

interface OfficialReportModalProps {
  onClose: () => void;
  /** Rapport proposé à l'ouverture (onglet affiché). */
  defaultKind?: OfficialReportKind;
}

/**
 * Copies officielles (#161) : émission numérotée, registre avec réimpression, et rapports
 * programmés (#180). Les refus du serveur s'affichent tels quels via le bus d'erreurs.
 */
export const OfficialReportModal: React.FC<OfficialReportModalProps> = ({ onClose, defaultKind = 'evolution' }) => {
  const [section, setSection] = useState<Section>('issue');
  const [kind, setKind] = useState<OfficialReportKind>(defaultKind);
  const [format, setFormat] = useState<OfficialReportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const [issues, setIssues] = useState<OfficialReportIssue[]>([]);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [schedules, setSchedules] = useState<OfficialReportSchedule[]>([]);
  const [scheduleName, setScheduleName] = useState('');
  const [frequency, setFrequency] = useState<ReportFrequency>('monthly');

  const request = (): OfficialReportRequest => ({
    kind,
    format,
    ...(kind === 'evolution' && dateFrom ? { date_from: dateFrom } : {}),
    ...(kind === 'evolution' && dateTo ? { date_to: dateTo } : {}),
  });

  const loadIssues = useCallback(async (append = false, skip = 0) => {
    try {
      const page = await officialReportsApi.listIssues(skip, PAGE_SIZE);
      setIssues((current) => (append ? [...current, ...page.items] : page.items));
      setIssuesTotal(page.total);
    } catch {
      /* erreur déjà affichée par le bus global */
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      setSchedules(await officialReportsApi.listSchedules());
    } catch {
      /* erreur déjà affichée par le bus global */
    }
  }, []);

  useEffect(() => {
    if (section === 'register') loadIssues();
    if (section === 'schedules') loadSchedules();
  }, [section, loadIssues, loadSchedules]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const deliver = (copy: OfficialCopy, verb: string) => {
    downloadBlob(copy.blob, copy.filename);
    setNotice(`${verb} : ${copy.number || copy.filename}`);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
    } catch {
      /* erreur déjà affichée par le bus global (detail du serveur tel quel) */
    } finally {
      setBusy(false);
    }
  };

  const issue = () => run(async () => deliver(await officialReportsApi.issue(request()), 'Copie émise'));

  const reprint = (item: OfficialReportIssue) =>
    run(async () => deliver(await officialReportsApi.reprint(item.id), 'Copie réimprimée'));

  const schedule = () =>
    run(async () => {
      const created = await officialReportsApi.createSchedule(scheduleName.trim(), frequency, request());
      setSchedules((current) => [...current, created]);
      setScheduleName('');
      setNotice(`Programmé : ${created.name}`);
    });

  const stop = (item: OfficialReportSchedule) =>
    run(async () => {
      await officialReportsApi.stopSchedule(item.id);
      setSchedules((current) => current.filter((s) => s.id !== item.id));
    });

  const reportChoice = (withDates: boolean) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className={labelClass}>Rapport</span>
        <select className={fieldClass} value={kind} onChange={(e) => setKind(e.target.value as OfficialReportKind)}>
          {(Object.keys(KIND_LABELS) as OfficialReportKind[]).map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
      </label>
      <div>
        <span className={labelClass} id="official-format-label">Format</span>
        <div role="group" aria-labelledby="official-format-label" className="flex gap-2">
          {(['csv', 'html'] as OfficialReportFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
              className={`flex-1 rounded-2xl px-3 py-2 text-xs font-bold uppercase ${
                format === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {withDates && kind === 'evolution' && (
        <>
          <label className="block">
            <span className={labelClass}>Du</span>
            <input type="date" className={fieldClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Au</span>
            <input type="date" className={fieldClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="official-report-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 id="official-report-title" className="text-2xl font-black tracking-tight text-slate-900">
              Copie officielle
            </h2>
            <InlineHelpButton
              label="Aide sur la copie officielle"
              content="Un exemplaire numéroté du rapport, inscrit au registre. Vous pouvez le réimprimer à l’identique."
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full border border-slate-200 p-2 text-slate-400 transition hover:text-slate-700"
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div role="tablist" aria-label="Copie officielle" className="mt-5 flex gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              onClick={() => {
                setSection(s.id);
                setNotice('');
              }}
              className={`rounded-2xl px-4 py-2 text-xs font-bold ${
                section === s.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
          {section === 'issue' && (
            <div className="space-y-5">
              {reportChoice(true)}
              <button
                type="button"
                onClick={() => issue()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-2xl bg-rdpc-blue px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-black disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">verified</span>
                Émettre la copie
              </button>
            </div>
          )}

          {section === 'register' && (
            issues.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Aucune copie émise.</p>
            ) : (
              <>
                <ul aria-label="Registre" className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                  {issues.map((item) => (
                    <li key={item.id} aria-label={item.number} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{item.number}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[KIND_LABELS[item.kind] ?? item.kind, item.format.toUpperCase(), formatDate(item.issued_at)].join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => reprint(item)}
                        disabled={busy}
                        aria-label={`Réimprimer ${item.number}`}
                        title="Réimprimer"
                        className="rounded-xl p-2 text-slate-500 hover:bg-blue-50 hover:text-rdpc-blue disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">print</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {issues.length < issuesTotal && (
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => loadIssues(true, issues.length)}
                      className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
                    >
                      Afficher plus
                    </button>
                  </div>
                )}
              </>
            )
          )}

          {section === 'schedules' && (
            <div className="space-y-5">
              {schedules.length > 0 && (
                <ul aria-label="Rapports programmés" className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                  {schedules.map((item) => (
                    <li key={item.id} aria-label={item.name} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[
                            FREQUENCY_LABELS[item.frequency] ?? item.frequency,
                            item.request.kind ? KIND_LABELS[item.request.kind] : null,
                            item.request.format?.toUpperCase(),
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => stop(item)}
                        disabled={busy}
                        className="rounded-2xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        Arrêter
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {reportChoice(false)}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Nom</span>
                  <input
                    className={fieldClass}
                    value={scheduleName}
                    maxLength={120}
                    onChange={(e) => setScheduleName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Fréquence</span>
                  <select className={fieldClass} value={frequency} onChange={(e) => setFrequency(e.target.value as ReportFrequency)}>
                    {(Object.keys(FREQUENCY_LABELS) as ReportFrequency[]).map((f) => (
                      <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => schedule()}
                disabled={busy || scheduleName.trim() === ''}
                className="inline-flex items-center gap-2 rounded-2xl bg-rdpc-blue px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-black disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">schedule</span>
                Programmer
              </button>
            </div>
          )}
        </div>

        <p role="status" className="mt-4 min-h-[1.25rem] text-sm font-medium text-emerald-700">{notice}</p>
      </div>
    </div>
  );
};
