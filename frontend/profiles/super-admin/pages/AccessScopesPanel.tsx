// Périmètre par rôle (V1.2, contrat 9.5/9.6 de l'élément 13) : ce que chaque rôle voit,
// réglé par une liste déroulante sous la grille des droits. Absent tant que l'API n'est pas disponible.
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { ApiError } from '../../../lib/errors';
import { InlineHelpButton } from '../../../components/ui/InlineHelpButton';
import { resourceLabel, roleLabel } from '../../../lib/rightsGrid';
import {
  ACCESS_SCOPES_LOAD_FAILED,
  accessScopeChangeError,
  applyScopeUpdate,
  isScope,
  rowKey,
  scopeOptions,
  type AccessScopeRow,
} from '../../../lib/accessScopes';

const statusOf = (err: unknown): number | undefined => (err instanceof ApiError ? err.status : undefined);

const AccessScopesPanel: React.FC = () => {
  const [rows, setRows] = useState<AccessScopeRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setRows(await api.getAccessScopes());
    } catch (err) {
      const status = statusOf(err);
      // 403/404 : fonction pas encore disponible pour ce compte ou ce serveur → panneau masqué.
      if (status === 403 || status === 404) setRows([]);
      else setLoadError(ACCESS_SCOPES_LOAD_FAILED);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const change = async (row: AccessScopeRow, value: string) => {
    const key = rowKey(row);
    if (!isScope(value) || value === row.scope || pending.has(key)) return;
    setPending((prev) => new Set(prev).add(key));
    setRowErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
    try {
      const updated = await api.setAccessScope(row.role, row.resource, value);
      if (updated) setRows((prev) => (prev ? applyScopeUpdate(prev, updated) : prev));
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [key]: accessScopeChangeError(statusOf(err)) }));
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (loadError) return <p role="status" className="text-sm font-medium text-red-600">{loadError}</p>;
  if (!rows || rows.length === 0) return null;

  return (
    <section aria-labelledby="access-scopes-title" className="relative glass rounded-[2rem] bg-white border-white p-6 pr-14" data-testid="access-scopes">
      <h3 id="access-scopes-title" className="text-sm font-black uppercase tracking-widest text-slate-500">
        Périmètre
      </h3>
      <InlineHelpButton
        className="absolute right-4 top-4"
        label="Aide sur les périmètres"
        content="Ce que chaque rôle voit : ses documents, son unité, ses sous-unités ou toute l'institution."
      />
      <table className="mt-4 w-full text-left border-collapse">
        <caption className="sr-only">Périmètre par rôle et par domaine</caption>
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            <th scope="col" className="py-2 pr-4">Rôle</th>
            <th scope="col" className="py-2 pr-4">Domaine</th>
            <th scope="col" className="py-2">Périmètre</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row) => {
            const key = rowKey(row);
            const error = rowErrors[key];
            const errorId = `scope-error-${row.role}-${row.resource}`;
            return (
              <tr key={key}>
                <th scope="row" className="py-2 pr-4 text-sm font-bold text-slate-700">{roleLabel(row.role)}</th>
                <td className="py-2 pr-4 text-sm text-slate-600">{resourceLabel(row.resource)}</td>
                <td className="py-2">
                  <select
                    data-testid={`scope-${row.role}-${row.resource}`}
                    value={row.scope}
                    disabled={pending.has(key)}
                    onChange={(e) => {
                      change(row, e.target.value).catch(() => undefined);
                    }}
                    aria-label={`${roleLabel(row.role)} : périmètre ${resourceLabel(row.resource)}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-cam-red focus:outline-none focus-visible:ring-2 focus-visible:ring-cam-red/30 disabled:opacity-50"
                  >
                    {scopeOptions(row).map((o) => (
                      <option key={o.value} value={o.value} disabled={o.disabled}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {error && (
                    <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-600">
                      {error}
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};

export default AccessScopesPanel;
