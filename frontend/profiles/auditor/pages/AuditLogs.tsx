import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { DataTable, type Column, type SortState } from '../../../components/ui/DataTable';
import { api } from '../../../services/api';
import type { AuditLogEntry } from '../../../types';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('fr-CM', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

function getActorLabel(log: AuditLogEntry): string {
  return log.user_name || log.user_matricule || 'Système';
}

function getObjectLabel(log: AuditLogEntry): string {
  return log.resource_label || `${log.table_label || log.table_name} ${log.record_id.slice(0, 8)}`;
}

function getSortValue(log: AuditLogEntry, key: string): string | number {
  switch (key) {
    case 'created_at':
      return new Date(log.created_at).getTime();
    case 'resource':
      return getObjectLabel(log).toLowerCase();
    case 'table_name':
      return (log.table_label || log.table_name).toLowerCase();
    case 'action':
      return (log.action_label || log.action).toLowerCase();
    case 'actor':
      return getActorLabel(log).toLowerCase();
    case 'detail':
      return (log.detail || '').toLowerCase();
    default:
      return '';
  }
}

const ACTION_STYLES: Record<string, string> = {
  content_viewed: 'bg-sky-50 text-sky-700 border-sky-200',
  upload: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-amber-50 text-amber-700 border-amber-200',
  review_resolved: 'bg-violet-50 text-violet-700 border-violet-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
};

function getActionBadgeClass(action: string): string {
  return ACTION_STYLES[action.toLowerCase()] || 'bg-slate-50 text-slate-600 border-slate-200';
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState | null>({ key: 'created_at', dir: 'desc' });
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([
    'created_at',
    'resource',
    'action',
    'actor',
    'detail',
  ]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs({ limit: 200 });
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Impossible de charger le registre des actions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const tableOptions = useMemo(
    () =>
      Array.from(
        new Map(
          logs.map((log) => [log.table_name, { value: log.table_name, label: log.table_label || log.table_name }]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [logs],
  );

  const actionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          logs.map((log) => [log.action, { value: log.action, label: log.action_label || log.action }]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [logs],
  );

  const actorOptions = useMemo(
    () =>
      Array.from(
        new Map(
          logs.map((log) => {
            const actorLabel = getActorLabel(log);
            return [actorLabel, { value: actorLabel, label: actorLabel }];
          }),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const tableFilter = columnFilters.table_name ?? [];
      if (tableFilter.length > 0 && !tableFilter.includes(log.table_name)) return false;

      const actionFilter = columnFilters.action ?? [];
      if (actionFilter.length > 0 && !actionFilter.includes(log.action)) return false;

      const actorFilter = columnFilters.actor ?? [];
      if (actorFilter.length > 0 && !actorFilter.includes(getActorLabel(log))) return false;

      return true;
    });
  }, [columnFilters, logs]);

  const sortedLogs = useMemo(() => {
    if (!sort) return filteredLogs;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filteredLogs].sort((a, b) => {
      const left = getSortValue(a, sort.key);
      const right = getSortValue(b, sort.key);
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * dir;
      return String(left).localeCompare(String(right), 'fr', { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filteredLogs, sort]);

  const summary = useMemo(() => {
    const documentActions = logs.filter((log) => log.table_name === 'documents').length;
    const uniqueActors = new Set(logs.map((log) => log.user_id || `system-${log.id}`)).size;
    return { documentActions, uniqueActors };
  }, [logs]);

  const setColumnFilter = (key: string, values: string[]) => {
    setColumnFilters((current) => ({ ...current, [key]: values }));
  };

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: 'asc' };
      return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'created_at',
      header: 'Date et heure',
      width: '16%',
      sortable: true,
      hideable: false,
      cell: (log) => (
        <div>
          <p className="text-sm font-bold text-slate-700">{formatDateTime(log.created_at)}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            {log.table_label || log.table_name}
          </p>
        </div>
      ),
    },
    {
      key: 'resource',
      header: 'Document / objet',
      width: '25%',
      sortable: true,
      cell: (log) => (
        <div>
          <p className="text-sm font-bold text-slate-900">{getObjectLabel(log)}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Référence technique : {log.record_id.slice(0, 8)}
          </p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '15%',
      sortable: true,
      filterable: true,
      filterOptions: actionOptions,
      cell: (log) => (
        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${getActionBadgeClass(log.action)}`}>
          {log.action_label || log.action}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Effectuée par',
      width: '18%',
      sortable: true,
      filterable: true,
      filterOptions: actorOptions,
      cell: (log) => (
        <div>
          <p className="text-sm font-bold text-slate-800">{getActorLabel(log)}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {log.user_matricule || log.user_id || 'Action système'}
          </p>
        </div>
      ),
    },
    {
      key: 'detail',
      header: 'Détail',
      width: '26%',
      sortable: true,
      cell: (log) => (
        <div>
          <p className="text-sm font-medium leading-relaxed text-slate-600">
            {log.detail || 'Action tracee automatiquement par le systeme.'}
          </p>
          {(log.ip_address || log.user_agent) && (
            <p className="mt-2 text-[11px] font-medium text-slate-400">
              {log.ip_address ? `IP ${log.ip_address}` : 'IP non disponible'}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'table_name',
      header: 'Registre',
      width: '14%',
      sortable: true,
      filterable: true,
      filterOptions: tableOptions,
      cell: (log) => (
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
          {log.table_label || log.table_name}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 p-8 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Audit & Traçabilité
          </div>
          <h2 className="mb-1 text-3xl font-black uppercase tracking-tighter italic text-slate-900">
            Registre Des Actions
          </h2>
          <p className="text-sm font-medium text-slate-500">
            Historique des consultations, modifications, arbitrages et autres actions sensibles.
          </p>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
          Tableau filtrable et colonnes personnalisables
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activité affichée</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-4xl font-black tracking-tighter italic text-slate-900">{sortedLogs.length}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">Lignes visibles</p>
                </div>
                <div>
                  <p className="text-4xl font-black tracking-tighter italic text-slate-900">{summary.documentActions}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">Actions sur documents</p>
                </div>
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-slate-300">table_view</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Traçabilité humaine</p>
              <p className="mt-4 text-4xl font-black tracking-tighter italic text-slate-900">{summary.uniqueActors}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">Acteurs concernés</p>
            </div>
            <span className="material-symbols-outlined text-3xl text-slate-300">group</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
        {error ? (
          <div className="px-8 py-20 text-center">
            <p className="text-base font-bold text-red-600">{error}</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto px-4 py-4">
            <DataTable<AuditLogEntry>
              rows={sortedLogs}
              loading={isLoading}
              getRowKey={(log) => log.id}
              sort={sort}
              onSortChange={toggleSort}
              columnFilters={columnFilters}
              onColumnFilterChange={setColumnFilter}
              columns={columns}
              enableColumnVisibility
              visibleColumnKeys={visibleColumnKeys}
              onVisibleColumnKeysChange={setVisibleColumnKeys}
              empty="Aucune action ne correspond aux filtres du tableau."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
