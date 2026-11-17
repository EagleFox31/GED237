import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../services/api';
import type { InboxScope } from '../services/resources/workflows.api';
import type { PendingWorkflowTask } from '../types';

/** `unified` : GET /workflows/inbox ; `legacy` : anciennes routes, quand le serveur ne propose pas encore la file unifiée. */
export type InboxSource = 'unified' | 'legacy';

type Options = { recursive?: boolean; pageSize?: number };

type State = {
  items: PendingWorkflowTask[];
  total: number;
  loading: boolean;
  failed: boolean;
  source: InboxSource | null;
};

const INITIAL: State = { items: [], total: 0, loading: true, failed: false, source: null };

/** Anciennes routes : `mine` = /workflows/pending, `unassigned` = /pending-assignments, pas de file « unité ». */
async function loadLegacy(scope: InboxScope): Promise<PendingWorkflowTask[]> {
  if (scope === 'mine') return api.getPendingWorkflows();
  if (scope === 'unassigned') return (await api.getPendingAssignments()) as PendingWorkflowTask[];
  return [];
}

/**
 * Une file de validation, lue au même endroit pour tous les écrans (#153).
 * Pages de `pageSize` étapes, la plus ancienne d'abord ; « Voir plus » ajoute la page suivante.
 * Une réponse arrivée après un changement de file est ignorée.
 */
export function useWorkflowInbox(scope: InboxScope, { recursive = false, pageSize = 50 }: Options = {}) {
  const [state, setState] = useState<State>(INITIAL);
  const request = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      request.current += 1;
      const id = request.current;
      setState((s) => ({ ...s, loading: true, failed: false }));
      try {
        const page = await api.getWorkflowInbox({ scope, recursive, limit: pageSize, offset });
        if (id !== request.current) return;
        if (page) {
          setState((s) => ({
            items: offset === 0 ? page.items : [...s.items, ...page.items],
            total: page.total,
            loading: false,
            failed: false,
            source: 'unified',
          }));
          return;
        }
        const items = await loadLegacy(scope);
        if (id !== request.current) return;
        setState({ items, total: items.length, loading: false, failed: false, source: 'legacy' });
      } catch {
        // Le message est déjà affiché par le bus global.
        if (id === request.current) setState((s) => ({ ...s, loading: false, failed: true }));
      }
    },
    [scope, recursive, pageSize],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const reload = useCallback(() => load(0), [load]);
  const loadMore = useCallback(() => load(state.items.length), [load, state.items.length]);

  /** Retire une étape traitée sans recharger la file. */
  const remove = useCallback((stepId: string) => {
    setState((s) => {
      const items = s.items.filter((t) => t.id !== stepId);
      return { ...s, items, total: Math.max(0, s.total - (s.items.length - items.length)) };
    });
  }, []);

  return { ...state, hasMore: state.items.length < state.total, reload, loadMore, remove };
}
