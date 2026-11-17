import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../services/api';
import { ApiError } from '../lib/errors';
import { useAuthStore } from '../stores/authStore';
import {
  NO_UNIT_MESSAGE,
  formatCount,
  formatStorage,
  managerMetricsError,
  managerTiles,
  type ManagerTiles as Tiles,
} from '../lib/managerDashboard';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; tiles: Tiles }
  | { kind: 'hidden' }
  | { kind: 'error'; message: string };

type Tile = { key: string; label: string; value: string; icon: string; to?: string };

/**
 * Tuiles du manager (#278, partie A) : chiffres de son service, relus à l'ouverture de la page.
 * « À revoir » n'a pas de lien : le manager n'a pas accès aux revues de classement.
 */
export const ManagerTiles: React.FC = () => {
  const navigate = useNavigate();
  const orgUnitId = useAuthStore((s) => s.userProfile?.orgUnitId);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [unitName, setUnitName] = useState<string | null>(null);

  useEffect(() => {
    if (!orgUnitId) return undefined;
    let cancelled = false;
    api
      .getManagerAnalytics()
      .then((metrics) => {
        if (!cancelled) setState({ kind: 'ready', tiles: managerTiles(metrics) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = managerMetricsError(error instanceof ApiError ? error.status : undefined);
        setState(message ? { kind: 'error', message } : { kind: 'hidden' });
      });
    // Le nom du service est un plus : en cas d'échec, la ligne n'est pas affichée.
    api
      .getOrgUnit(orgUnitId)
      .then((unit) => {
        if (!cancelled) setUnitName(unit.name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orgUnitId]);

  if (!orgUnitId) {
    return (
      <p className="text-sm text-amber-700" role="status" data-testid="manager-tiles-no-unit">
        {NO_UNIT_MESSAGE}
      </p>
    );
  }
  if (state.kind === 'hidden') return null;
  if (state.kind === 'error') {
    return (
      <p className="text-sm text-amber-700" role="alert" data-testid="manager-tiles-error">
        {state.message}
      </p>
    );
  }

  const tiles: Tile[] =
    state.kind === 'ready'
      ? [
          { key: 'total', label: 'Documents du service', value: formatCount(state.tiles.total), icon: 'description', to: '/documents' },
          { key: 'review', label: 'À revoir', value: formatCount(state.tiles.needsReview), icon: 'rule' },
          { key: 'workflows', label: 'Validations en cours', value: formatCount(state.tiles.activeWorkflows), icon: 'draw', to: '/tasks' },
          { key: 'storage', label: 'Espace utilisé', value: formatStorage(state.tiles.storageMb), icon: 'hard_drive' },
        ]
      : [];

  return (
    <section aria-label="Chiffres du service" data-testid="manager-tiles">
      {state.kind === 'loading' ? (
        <p className="text-sm text-slate-500" role="status">Chargement…</p>
      ) : (
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {tiles.map((tile) => {
            const body = (
              <>
                <span aria-hidden="true" className="material-symbols-outlined text-slate-400 text-xl">{tile.icon}</span>
                <span className="block text-2xl font-black text-slate-900 mt-1" data-testid={`manager-tile-${tile.key}`}>{tile.value}</span>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">{tile.label}</span>
              </>
            );
            const target = tile.to;
            return (
              <li key={tile.key}>
                {target ? (
                  <button
                    type="button"
                    onClick={() => navigate(target)}
                    className="w-full text-left glass rounded-2xl p-4 hover:shadow-md transition-shadow"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="glass rounded-2xl p-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {unitName && <p className="mt-2 text-xs text-slate-500">Service : {unitName}</p>}
    </section>
  );
};
