import React, { useCallback, useEffect, useRef, useState } from 'react';

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
import {
  SECTION_LABELS,
  canClose,
  nextSection,
  registerLoadFromError,
  registerMessage,
  schedulingEnabledFrom,
  visibleSections,
  type OfficialSection,
  type RegisterLoad,
} from './officialReportView';

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

const FORMATS: OfficialReportFormat[] = ['csv', 'html', 'pdf'];

const PAGE_SIZE = 20;

const fieldClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-rdpc-blue focus:outline-none';
const labelClass = 'mb-1 block text-xs font-bold text-slate-500';

const tabId = (section: OfficialSection) => `official-tab-${section}`;
const panelId = (section: OfficialSection) => `official-panel-${section}`;

interface OfficialReportModalProps {
  onClose: () => void;
  /** Rapport proposé à l'ouverture (onglet affiché). */
  defaultKind?: OfficialReportKind;
}

/**
 * Copies officielles (#161) : émission numérotée, registre avec réimpression, et rapports
 * programmés (#180) quand le serveur les exécute. Les refus du serveur s'affichent tels quels
 * via le bus d'erreurs.
 */
export const OfficialReportModal: React.FC<OfficialReportModalProps> = ({ onClose, defaultKind = 'evolution' }) => {
  const [section, setSection] = useState<OfficialSection>('issue');
  const [kind, setKind] = useState<OfficialReportKind>(defaultKind);
  const [format, setFormat] = useState<OfficialReportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const [issues, setIssues] = useState<OfficialReportIssue[]>([]);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [registerLoad, setRegisterLoad] = useState<RegisterLoad>('loading');
  const [schedulingEnabled, setSchedulingEnabled] = useState(false);
  const [schedules, setSchedules] = useState<OfficialReportSchedule[]>([]);
  const [scheduleName, setScheduleName] = useState('');
  const [frequency, setFrequency] = useState<ReportFrequency>('monthly');

  const busyRef = useRef(false);
  const issuesSeq = useRef(0);
  const tabRefs = useRef<Partial<Record<OfficialSection, HTMLButtonElement | null>>>({});
  const sections = visibleSections(schedulingEnabled);

  const request = (): OfficialReportRequest => ({
    kind,
    format,
    ...(kind === 'evolution' && dateFrom ? { date_from: dateFrom } : {}),
    ...(kind === 'evolution' && dateTo ? { date_to: dateTo } : {}),
  });

  const loadIssues = useCallback(async (append = false, skip = 0) => {
    // Seule la dernière demande compte : une réponse plus ancienne arrivée après est ignorée.
    issuesSeq.current += 1;
    const seq = issuesSeq.current;
    setRegisterLoad('loading');
    try {
      const page = await officialReportsApi.listIssues(skip, PAGE_SIZE);
      if (seq !== issuesSeq.current) return;
      setIssues((current) => (append ? [...current, ...page.items] : page.items));
      setIssuesTotal(page.total);
      setRegisterLoad('ready');
    } catch (error) {
      if (seq === issuesSeq.current) setRegisterLoad(registerLoadFromError(error));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    officialReportsApi
      .listSchedules()
      .then(({ items, enabledHeader }) => {
        if (!alive) return;
        setSchedulingEnabled(schedulingEnabledFrom(enabledHeader));
        setSchedules(items);
      })
      .catch(() => {
        /* erreur déjà affichée par le bus global ; l'onglet reste masqué */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (section === 'register') loadIssues();
  }, [section, loadIssues]);

  const requestClose = useCallback(() => {
    if (canClose(busyRef.current)) onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const selectSection = (next: OfficialSection, focus = false) => {
    // Le numéro de la dernière copie reste affiché d'un onglet à l'autre.
    setSection(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = nextSection(sections, section, event.key);
    if (!next) return;
    event.preventDefault();
    selectSection(next, true);
  };

  const deliver = (copy: OfficialCopy, verb: string) => {
    downloadBlob(copy.blob, copy.filename);
    setNotice(`${verb} : ${copy.number || copy.filename}`);
  };

  const run = async (action: () => Promise<void>) => {
    busyRef.current = true;
    setBusy(true);
    setNotice('');
    try {
      await action();
    } catch {
      /* erreur déjà affichée par le bus global (detail du serveur tel quel) */
    } finally {
      busyRef.current = false;
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
          {FORMATS.map((f) => (
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

  const registerText = registerMessage(registerLoad, issues.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="official-report-title"
        aria-busy={busy}
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
            onClick={requestClose}
            disabled={busy}
            aria-label="Fermer"
            title={busy ? 'Patientez, copie en cours' : undefined}
            className="rounded-full border border-slate-200 p-2 text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div role="tablist" aria-label="Copie officielle" className="mt-5 flex gap-2">
          {sections.map((s) => (
            <button
              key={s}
              ref={(node) => {
                tabRefs.current[s] = node;
              }}
              id={tabId(s)}
              type="button"
              role="tab"
              aria-selected={section === s}
              // Un seul panneau monté : seul l'onglet actif pointe vers lui.
              aria-controls={section === s ? panelId(s) : undefined}
              tabIndex={section === s ? 0 : -1}
              onClick={() => selectSection(s)}
              onKeyDown={onTabKeyDown}
              className={`rounded-2xl px-4 py-2 text-xs font-bold ${
                section === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {SECTION_LABELS[s]}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={panelId(section)}
          aria-labelledby={tabId(section)}
          tabIndex={0}
          className="mt-5 min-h-0 flex-1 overflow-y-auto"
        >
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
            registerText ? (
              <p className="py-8 text-center text-sm text-slate-500">{registerText}</p>
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
                      disabled={registerLoad === 'loading'}
                      className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                    >
                      Afficher plus
                    </button>
                  </div>
                )}
              </>
            )
          )}

          {section === 'schedules' && schedulingEnabled && (
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
