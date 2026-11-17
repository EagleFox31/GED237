// Grille des droits (#280, lot 8b) : rôles × actions pour un domaine, à la place de la liste
// de règles brutes. Modifiable par le super-administrateur quand les droits vivent en base ;
// lecture seule pour l'admin ministère et sur une installation réglée par fichier.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import { ApiError } from '../../../lib/errors';
import { useAuthStore } from '../../../stores/authStore';
import { InlineHelpButton } from '../../../components/ui/InlineHelpButton';
import {
  actionLabel,
  applyChange,
  gridFor,
  policyKey,
  resourceLabel,
  resourcesOf,
  RIGHTS_LOAD_FAILED,
  RIGHTS_READ_ONLY_SERVER,
  RIGHTS_READ_ONLY_TENANT,
  rightsChangeError,
  roleLabel,
  type PolicyRow,
} from '../../../lib/rightsGrid';

const statusOf = (err: unknown): number | undefined => (err instanceof ApiError ? err.status : undefined);

const RightsGridTab: React.FC = () => {
  const isSuper = useAuthStore((s) => s.userProfile?.id) === 'super';
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [extraRoles, setExtraRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readOnlyNote, setReadOnlyNote] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [changeError, setChangeError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setPolicies(await api.getAuthzPolicies());
    } catch {
      setLoadError(RIGHTS_LOAD_FAILED);
      setIsLoading(false);
      return;
    }
    if (!isSuper) {
      setReadOnlyNote(RIGHTS_READ_ONLY_TENANT);
    } else {
      // /authz/roles répond 409 quand les droits se règlent par fichier : la grille reste en lecture.
      try {
        setExtraRoles(await api.getAuthzRoles());
        setReadOnlyNote(null);
      } catch (err) {
        setReadOnlyNote(statusOf(err) === 409 ? RIGHTS_READ_ONLY_SERVER : 'Modification indisponible pour le moment.');
      }
    }
    setIsLoading(false);
  }, [isSuper]);

  useEffect(() => {
    fetchData().catch(() => undefined);
  }, [fetchData]);

  const resources = useMemo(() => resourcesOf(policies), [policies]);
  const resource = resources.includes(selected) ? selected : (resources[0] ?? '');
  const grid = useMemo(() => gridFor(resource, policies, extraRoles), [resource, policies, extraRoles]);
  const editable = isSuper && readOnlyNote === null;

  const toggle = async (role: string, action: string, grant: boolean) => {
    const rule = { v0: role, v1: resource, v2: action };
    const key = policyKey(role, resource, action);
    if (pending.has(key)) return;
    // Un retrait s'applique tout de suite à tous les agents du rôle : on le fait confirmer.
    if (!grant && !window.confirm(`Retirer « ${actionLabel(action)} » à tous les agents du rôle ${roleLabel(role)} ?`)) {
      return;
    }
    setPending((prev) => new Set(prev).add(key));
    setChangeError(null);
    try {
      if (grant) await api.addAuthzPolicy(rule);
      else await api.deleteAuthzPolicy(rule);
      setPolicies((prev) => applyChange(prev, rule, grant));
    } catch (err) {
      const status = statusOf(err);
      setChangeError(rightsChangeError(status));
      // 409 : l'installation est repassée en réglage par fichier ; on relit la grille, qui passe en lecture.
      if (status === 409) await fetchData();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cam-red"></div>
      </div>
    );
  }
  if (loadError) return <div role="status" className="text-center py-20 font-bold text-red-500">{loadError}</div>;

  return (
    <div className="space-y-5">
      <div className="relative flex flex-wrap items-center gap-2 pr-10" role="group" aria-label="Domaine">
        {resources.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={r === resource}
            onClick={() => setSelected(r)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              r === resource ? 'bg-cam-red text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {resourceLabel(r)}
          </button>
        ))}
        <InlineHelpButton
          className="absolute right-0 top-0"
          label="Aide sur les droits"
          content="Une case cochée donne ce droit à tous les agents du rôle. « Tout gérer » comprend toutes les actions du domaine."
        />
      </div>

      {readOnlyNote && (
        <p role="status" data-testid="rights-read-only" className="text-xs font-medium text-slate-500">
          {readOnlyNote}
        </p>
      )}
      {changeError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {changeError}
        </p>
      )}

      <div className="glass rounded-[2rem] bg-white border-white overflow-x-auto">
        <table className="w-full text-left border-collapse" data-testid="rights-grid">
          <caption className="sr-only">Droits : {resourceLabel(resource)}</caption>
          <thead>
            <tr className="bg-slate-50/50">
              <th scope="col" className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Rôle
              </th>
              {grid.actions.map((action) => (
                <th key={action} scope="col" className="px-3 py-4 text-center text-[11px] font-bold text-slate-500">
                  {actionLabel(action)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {grid.roles.map((role) => (
              <tr key={role} className="hover:bg-slate-50/50 transition-colors">
                <th scope="row" className="px-6 py-3 text-sm font-bold text-slate-700">
                  {roleLabel(role)}
                </th>
                {grid.actions.map((action) => {
                  const state = grid.cell(role, action);
                  const key = policyKey(role, resource, action);
                  return (
                    <td key={action} className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={state !== 'none'}
                        disabled={!editable || state === 'implied' || pending.has(key)}
                        onChange={(e) => {
                          toggle(role, action, e.target.checked).catch(() => undefined);
                        }}
                        aria-label={`${roleLabel(role)} : ${actionLabel(action)}`}
                        title={state === 'implied' ? 'Compris dans « Tout gérer »' : undefined}
                        className={`h-4 w-4 accent-cam-red ${state === 'implied' ? 'opacity-40' : ''}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RightsGridTab;
