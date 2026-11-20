import React, { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../../services/api';
import { ingestionSourcesApi } from '../../../services/resources/ingestionSources.api';
import type { IngestionSource } from '../../../services/resources/ingestionSources.api';
import { ApiError } from '../../../lib/errors/ApiError';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { InlineHelpButton } from '../../../components/ui/InlineHelpButton';
import { AgentKeyDialog } from './ingestionSources/AgentKeyDialog';
import { SourceFormDialog, type OrgUnitOption } from './ingestionSources/SourceFormDialog';
import {
  RUN_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  canRunNow,
  emptySourceForm,
  formFromSource,
  formatRunAt,
  runConflictMessage,
  runSummary,
  toCreatePayload,
  toUpdatePayload,
  type SourceForm,
} from './ingestionSources/sourcesView';

type Load = 'loading' | 'ready' | 'failed';
type FormState = { mode: 'create' } | { mode: 'edit'; source: IngestionSource } | null;
type Confirm = { kind: 'delete' | 'rotate'; source: IngestionSource } | null;
type RowNote = { busy?: boolean; message?: string; tone?: 'ok' | 'error' };

const RUN_TONE: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-800',
  failed: 'bg-red-50 text-red-700',
};

const actionClass =
  'inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Sources de collecte (F-NEXT-03) : dossiers du serveur, partages réseau et agents qui
 * alimentent la GED. Réservé aux administrateurs ; les droits font foi côté API.
 */
const IngestionSourcesPage: React.FC = () => {
  const [sources, setSources] = useState<IngestionSource[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [form, setForm] = useState<FormState>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [notes, setNotes] = useState<Record<string, RowNote>>({});
  const busyRows = useRef(new Set<string>());

  const reload = useCallback(async () => {
    try {
      setSources(await ingestionSourcesApi.list());
      setLoad('ready');
    } catch {
      setLoad((prev) => (prev === 'ready' ? prev : 'failed'));
    }
  }, []);

  useEffect(() => {
    void reload();
    api
      .getOrgUnits()
      .then((units) => setOrgUnits(units.map((unit: { id: string; name: string }) => ({ id: unit.id, name: unit.name }))))
      .catch(() => setOrgUnits([]));
  }, [reload]);

  const setNote = (id: string, note: RowNote) => setNotes((prev) => ({ ...prev, [id]: note }));

  /** Une action à la fois par ligne : le verrou est posé avant tout await. */
  const onRow = async (source: IngestionSource, action: () => Promise<RowNote | void>) => {
    if (busyRows.current.has(source.id)) return;
    busyRows.current.add(source.id);
    setNote(source.id, { busy: true });
    try {
      setNote(source.id, (await action()) ?? {});
    } catch {
      setNote(source.id, {}); // erreur HTTP déjà affichée par le bus global
    } finally {
      busyRows.current.delete(source.id);
    }
  };

  const runNow = (source: IngestionSource) =>
    onRow(source, async () => {
      try {
        const result = await ingestionSourcesApi.run(source.id);
        await reload();
        return {
          message: `Collecte ${RUN_STATUS_LABELS[result.status].toLowerCase()} : ${runSummary(result)}.`,
          tone: result.status === 'success' ? 'ok' : 'error',
        };
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          await reload();
          return { message: runConflictMessage(err.userMessage), tone: 'error' };
        }
        throw err;
      }
    });

  const toggleEnabled = (source: IngestionSource) =>
    onRow(source, async () => {
      const updated = await ingestionSourcesApi.update(source.id, { enabled: !source.enabled });
      setSources((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    });

  const closeForm = useCallback(() => {
    if (!savingRef.current) setForm(null);
  }, []);
  const closeKey = useCallback(() => setRevealed(null), []);

  const submitForm = async (values: SourceForm) => {
    if (!form || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (form.mode === 'create') {
        const created = await ingestionSourcesApi.create(toCreatePayload(values));
        if (created.agent_key) setRevealed({ name: created.name, key: created.agent_key });
      } else {
        const changes = toUpdatePayload(values, form.source);
        if (changes) await ingestionSourcesApi.update(form.source.id, changes);
      }
      savingRef.current = false;
      setForm(null);
      await reload();
    } catch {
      // Erreur affichée par le bus global ; le formulaire reste ouvert pour corriger.
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const { kind, source } = confirm;
    setConfirm(null);
    await onRow(source, async () => {
      if (kind === 'delete') {
        await ingestionSourcesApi.remove(source.id);
        setSources((prev) => prev.filter((item) => item.id !== source.id));
        return;
      }
      const rotated = await ingestionSourcesApi.rotateKey(source.id);
      if (rotated.agent_key) setRevealed({ name: rotated.name, key: rotated.agent_key });
      setSources((prev) => prev.map((item) => (item.id === rotated.id ? { ...rotated, agent_key: undefined } : item)));
    });
  };

  return (
    <div className="p-8 animate-in fade-in duration-500">
      <header className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Sources de collecte</h1>
        <InlineHelpButton
          label="Aide sur les sources"
          content="Les dossiers et postes d’où les documents arrivent dans la GED. « Collecter » lance un passage tout de suite."
        />
        <button
          type="button"
          onClick={() => setForm({ mode: 'create' })}
          className="ml-auto inline-flex items-center gap-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-rdpc-blue"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>add</span>
          Nouvelle source
        </button>
      </header>

      {load === 'failed' && (
        <div role="alert" className="rounded-[2rem] border border-red-100 bg-red-50 p-10 text-center">
          <p className="text-sm font-medium text-red-700">Sources indisponibles pour le moment.</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-4 rounded-2xl bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            Réessayer
          </button>
        </div>
      )}

      {load === 'ready' && sources.length === 0 && (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden>sync_alt</span>
          <p className="mt-2 text-sm font-medium text-slate-500">Aucune source.</p>
        </div>
      )}

      {sources.length > 0 && (
        <ul aria-label="Sources de collecte" className="space-y-3">
          {sources.map((source) => {
            const note = notes[source.id] ?? {};
            const run = source.last_run_status;
            return (
              <li
                key={source.id}
                aria-label={source.name}
                aria-busy={note.busy || undefined}
                className="rounded-[2rem] border border-slate-100 bg-white p-5"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-slate-900">{source.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        {SOURCE_TYPE_LABELS[source.source_type]}
                      </span>
                      {!source.enabled && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">Désactivée</span>
                      )}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-slate-500">
                      {source.source_type === 'agent'
                        ? `Clé ${source.agent_key_prefix ?? ''}…`
                        : source.path}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {source.last_run_at ? (
                        <>
                          Dernière collecte : {formatRunAt(source.last_run_at)}
                          {run && (
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${RUN_TONE[run]}`}>
                              {RUN_STATUS_LABELS[run]}
                            </span>
                          )}
                          {source.last_run_report && <span className="ml-2">{runSummary(source.last_run_report)}</span>}
                        </>
                      ) : (
                        'Jamais collectée'
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {source.source_type !== 'agent' && (
                      <button
                        type="button"
                        onClick={() => void runNow(source)}
                        disabled={note.busy || !canRunNow(source)}
                        title={source.enabled ? undefined : 'Source désactivée'}
                        aria-label={`Collecter ${source.name}`}
                        className={actionClass}
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>play_arrow</span>
                        Collecter
                      </button>
                    )}
                    {source.source_type === 'agent' && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: 'rotate', source })}
                        disabled={note.busy}
                        aria-label={`Nouvelle clé pour ${source.name}`}
                        className={actionClass}
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>key</span>
                        Nouvelle clé
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void toggleEnabled(source)}
                      disabled={note.busy}
                      aria-label={`${source.enabled ? 'Désactiver' : 'Activer'} ${source.name}`}
                      className={actionClass}
                    >
                      {source.enabled ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ mode: 'edit', source })}
                      disabled={note.busy}
                      aria-label={`Modifier ${source.name}`}
                      className={actionClass}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden>edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: 'delete', source })}
                      disabled={note.busy}
                      aria-label={`Supprimer ${source.name}`}
                      className={actionClass}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden>delete</span>
                    </button>
                  </div>
                </div>
                <p
                  role="status"
                  className={`mt-2 text-xs font-medium ${note.tone === 'error' ? 'text-red-700' : 'text-emerald-700'}`}
                >
                  {note.busy ? 'En cours…' : note.message}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <SourceFormDialog
          editing={form.mode === 'edit'}
          initial={form.mode === 'edit' ? formFromSource(form.source) : emptySourceForm()}
          orgUnits={orgUnits}
          busy={saving}
          onSubmit={(values) => void submitForm(values)}
          onClose={closeForm}
        />
      )}

      {revealed && <AgentKeyDialog sourceName={revealed.name} agentKey={revealed.key} onClose={closeKey} />}

      <ConfirmationModal
        open={confirm?.kind === 'delete'}
        title={`Supprimer « ${confirm?.source.name ?? ''} » ?`}
        message="Les documents déjà collectés restent dans la GED."
        confirmLabel="Supprimer"
        icon="delete"
        onConfirm={() => void confirmAction()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmationModal
        open={confirm?.kind === 'rotate'}
        title={`Nouvelle clé pour « ${confirm?.source.name ?? ''} » ?`}
        message="L’ancienne clé cessera de fonctionner : l’agent devra recevoir la nouvelle."
        confirmLabel="Créer la clé"
        icon="key"
        onConfirm={() => void confirmAction()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default IngestionSourcesPage;
