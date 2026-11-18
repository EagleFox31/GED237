// frontend/profiles/manager/pages/DelegationsPage.tsx
//
// Remplacements pendant une absence (L4) : le chef de service ou l'admin de l'institution
// confie les tâches d'un agent absent à un intérimaire, pour une période.
// Les refus du serveur (chevauchement 409, règle 422, droits 403) arrivent en français par le bus global.
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { ApiError } from '../../../lib/errors';
import { pushClientOperationError } from '../../../lib/errors/clientOperationError';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { DELEGATION_STATUS_LABELS, formatDelegationDate, toAwareIso } from '../../../lib/delegation';
import type { Delegation, DelegationStatus } from '../../../types';

type StatusFilter = DelegationStatus | '';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'En cours' },
  { value: 'scheduled', label: 'Prévus' },
  { value: 'ended', label: 'Terminés' },
  { value: 'revoked', label: 'Annulés' },
];

const STATUS_BADGE: Record<DelegationStatus, string> = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  ended: 'bg-slate-100 text-slate-600',
  revoked: 'bg-slate-100 text-slate-600',
};

const FIELD =
  'w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-slate-700 font-medium focus:outline-none focus-visible:border-rdpc-blue focus-visible:ring-4 focus-visible:ring-rdpc-blue/30 transition-colors';

const DelegationsPage: React.FC = () => {
  const [items, setItems] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('');
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  const [delegatorId, setDelegatorId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);

  const [toRevoke, setToRevoke] = useState<Delegation | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      setItems(await api.getDelegations(status ? { status } : {}));
    } catch (e) {
      setLoadFailed(true);
      if (!(e instanceof ApiError)) pushClientOperationError(e, { fallbackDetail: 'Chargement des remplacements impossible.' });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .getUsers()
      .then((data) => setUsers(data.filter((u) => u.is_active !== false).map((u) => ({ id: u.id, full_name: u.full_name }))))
      .catch(() => setUsers([]));
  }, []);

  const startIso = toAwareIso(startsAt);
  const endIso = toAwareIso(endsAt);
  const formError =
    delegatorId && delegateId && delegatorId === delegateId
      ? 'L’agent absent et son remplaçant doivent être deux personnes différentes.'
      : startIso && endIso && new Date(endIso) <= new Date(startIso)
        ? 'La fin doit venir après le début.'
        : null;
  const canSubmit = Boolean(delegatorId && delegateId && startIso && endIso && !formError && !saving);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !startIso || !endIso) return;
    try {
      setSaving(true);
      await api.createDelegation({ delegator_id: delegatorId, delegate_id: delegateId, starts_at: startIso, ends_at: endIso });
      setDelegatorId('');
      setDelegateId('');
      setStartsAt('');
      setEndsAt('');
      await load();
    } catch (e) {
      if (!(e instanceof ApiError)) pushClientOperationError(e, { fallbackDetail: 'Création du remplacement impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const confirmRevoke = async () => {
    if (!toRevoke) return;
    try {
      setRevoking(true);
      await api.revokeDelegation(toRevoke.id);
      setToRevoke(null);
      await load();
    } catch (e) {
      if (!(e instanceof ApiError)) pushClientOperationError(e, { fallbackDetail: 'Annulation du remplacement impossible.' });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="p-8 pb-32">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-rdpc-blue" aria-hidden="true">swap_horiz</span>
          Remplacements
        </h1>
        <p className="text-slate-500 font-medium italic mt-2">
          Pendant une absence, les tâches de l’agent vont à son remplaçant.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 lg:col-span-7 space-y-4" aria-label="Liste des remplacements">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par état">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value || 'all'}
                type="button"
                aria-pressed={status === f.value}
                onClick={() => setStatus(f.value)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-rdpc-blue/40 ${
                  status === f.value ? 'bg-rdpc-blue text-white border-rdpc-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-rdpc-blue'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-slate-500 italic p-8 text-center bg-white rounded-[2rem] shadow-sm">Chargement...</div>
          ) : loadFailed ? (
            <div role="alert" className="text-red-600 font-bold p-8 text-center bg-white rounded-[2rem] shadow-sm">
              <p>Impossible de charger les remplacements.</p>
              <button type="button" onClick={load} className="mt-2 underline text-sm">Réessayer</button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-slate-500 italic p-8 text-center bg-white rounded-[2rem] shadow-sm">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50" aria-hidden="true">event_available</span>
              <p>Aucun remplacement{status ? ` « ${DELEGATION_STATUS_LABELS[status].toLowerCase()} »` : ''}.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((d) => (
                <li key={d.id} className="p-5 rounded-[2rem] border-2 border-slate-200 bg-white flex items-start justify-between gap-4" data-testid="delegation-row">
                  <div>
                    <p className="font-bold text-slate-800">
                      {d.delegator.full_name}
                      <span className="material-symbols-outlined align-middle mx-2 text-slate-400 text-base" aria-hidden="true">arrow_forward</span>
                      <span className="sr-only"> remplacé par </span>
                      {d.delegate.full_name}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Du {formatDelegationDate(d.starts_at)} au {formatDelegationDate(d.ends_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${STATUS_BADGE[d.status]}`}>
                      {DELEGATION_STATUS_LABELS[d.status]}
                    </span>
                    {(d.status === 'active' || d.status === 'scheduled') && (
                      <button
                        type="button"
                        onClick={() => setToRevoke(d)}
                        aria-label={`Annuler le remplacement de ${d.delegator.full_name}`}
                        className="text-xs font-bold text-red-600 hover:underline rounded focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="col-span-12 lg:col-span-5">
          <form onSubmit={submit} className="bg-white border-2 border-slate-200 rounded-[2rem] p-6 shadow-sm space-y-4" aria-labelledby="delegation-form-title">
            <h2 id="delegation-form-title" className="text-xl font-black text-slate-800 uppercase italic">Nouveau remplacement</h2>
            <div>
              <label htmlFor="delegation-delegator" className="block text-sm font-bold text-slate-700 mb-1">Agent absent</label>
              <select id="delegation-delegator" value={delegatorId} onChange={(e) => setDelegatorId(e.target.value)} className={FIELD}>
                <option value="">Choisir…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="delegation-delegate" className="block text-sm font-bold text-slate-700 mb-1">Remplacé par</label>
              <select id="delegation-delegate" value={delegateId} onChange={(e) => setDelegateId(e.target.value)} className={FIELD}>
                <option value="">Choisir…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="delegation-start" className="block text-sm font-bold text-slate-700 mb-1">Début</label>
                <input id="delegation-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={FIELD} />
              </div>
              <div>
                <label htmlFor="delegation-end" className="block text-sm font-bold text-slate-700 mb-1">Fin</label>
                <input id="delegation-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={FIELD} />
              </div>
            </div>
            {formError && <p role="alert" className="text-sm font-bold text-red-600">{formError}</p>}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-rdpc-blue text-white py-3 rounded-2xl font-bold uppercase tracking-wider hover:bg-black transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rdpc-blue/40 focus-visible:ring-offset-2"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </section>
      </div>

      <ConfirmationModal
        open={Boolean(toRevoke)}
        title="Annuler ce remplacement ?"
        message={toRevoke ? `${toRevoke.delegate.full_name} ne recevra plus les tâches de ${toRevoke.delegator.full_name}. Les tâches reviennent à ${toRevoke.delegator.full_name}.` : ''}
        confirmLabel={revoking ? 'Annulation…' : 'Annuler le remplacement'}
        cancelLabel="Garder"
        icon="swap_horiz"
        confirmDisabled={revoking}
        onConfirm={confirmRevoke}
        onCancel={() => setToRevoke(null)}
      />
    </div>
  );
};

export default DelegationsPage;
