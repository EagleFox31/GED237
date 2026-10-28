import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { DataTable, type Column, type SortState } from '../../../../components/ui/DataTable';
import type { ReportsTableRow, ReportsViewMode } from './reportsViewModel';
import { exportReportsRowsExcel } from './reportsExport';

interface ReportsTableSectionProps {
  rows: ReportsTableRow[];
  viewMode: ReportsViewMode;
  loading?: boolean;
}

const STATUS_LABELS: Record<ReportsTableRow['status'], string> = {
  stable: 'Stable',
  attention: 'Attention',
  positive: 'Maîtrisé',
  info: 'À surveiller',
};

const STATUS_CLASSES: Record<ReportsTableRow['status'], string> = {
  stable: 'bg-slate-100 text-slate-700 border-slate-200',
  attention: 'bg-amber-50 text-amber-700 border-amber-200',
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

const VIEW_LABELS: Record<ReportsViewMode, string> = {
  synthese: 'ensemble',
  documents: 'Activité documentaire',
  workflows: 'Traitement & délais',
  services: 'Services',
};

const FAMILY_STYLES: Record<string, string> = {
  Documents: 'bg-blue-50 text-blue-700 border-blue-200',
  Statuts: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Services: 'bg-violet-50 text-violet-700 border-violet-200',
  'Points de vigilance': 'bg-amber-50 text-amber-700 border-amber-200',
  Capacité: 'bg-slate-100 text-slate-700 border-slate-200',
  Classement: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Travail en cours': 'bg-blue-50 text-blue-700 border-blue-200',
  Alertes: 'bg-red-50 text-red-700 border-red-200',
  Blocages: 'bg-amber-50 text-amber-700 border-amber-200',
  Délais: 'bg-orange-50 text-orange-700 border-orange-200',
  Traitement: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Circuits: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Retards: 'bg-amber-50 text-amber-700 border-amber-200',
  Volumes: 'bg-slate-100 text-slate-700 border-slate-200',
};

const isRowCluttering = (row: ReportsTableRow) => {
  const valueText = String(row.value).trim();
  const noDataText = `${row.detail} ${row.actionHint}`.toLowerCase();
  const hasNoDataCopy = [
    'aucun',
    'aucune',
    'pas encore disponible',
    'n’est encore disponible',
    'n’est pas encore disponible',
  ].some((token) => noDataText.includes(token));
  const isZeroStable = (valueText === '0' || valueText === '—') && row.status === 'stable';
  const isPlaceholderValue = valueText === '—';
  return isPlaceholderValue || (isZeroStable && hasNoDataCopy);
};

export const ReportsTableSection: React.FC<ReportsTableSectionProps> = ({
  rows,
  viewMode,
  loading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sort, setSort] = useState<SortState | null>({ key: 'family', dir: 'asc' });
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([
    'family',
    'indicator',
    'value',
    'status',
    'detail',
    'action',
  ]);

  const meaningfulRows = useMemo(
    () => rows.filter((row) => !isRowCluttering(row)),
    [rows],
  );

  const familyOptions = useMemo(
    () =>
      Array.from(new Set(meaningfulRows.map((row) => row.family)))
        .sort((a, b) => a.localeCompare(b, 'fr'))
        .map((value) => ({ value, label: value })),
    [meaningfulRows],
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(meaningfulRows.map((row) => row.status))).map((status) => ({
        value: status,
        label: STATUS_LABELS[status],
      })),
    [meaningfulRows],
  );

  const filteredRows = useMemo(
    () =>
      meaningfulRows.filter((row) => {
        const familyFilter = columnFilters.family ?? [];
        if (familyFilter.length > 0 && !familyFilter.includes(row.family)) return false;
        const statusFilter = columnFilters.status ?? [];
        if (statusFilter.length > 0 && !statusFilter.includes(row.status)) return false;
        return true;
      }),
    [columnFilters, meaningfulRows],
  );

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const direction = sort.dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((left, right) => {
      const leftValue = sort.key === 'value' ? String(left.value) : String(left[sort.key as keyof ReportsTableRow] ?? '');
      const rightValue = sort.key === 'value' ? String(right.value) : String(right[sort.key as keyof ReportsTableRow] ?? '');
      return leftValue.localeCompare(rightValue, 'fr', { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [filteredRows, sort]);

  const columns: Column<ReportsTableRow>[] = [
    {
      key: 'family',
      header: 'Rubrique',
      sortable: true,
      filterable: true,
      filterOptions: familyOptions,
      cell: (row) => (
        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${FAMILY_STYLES[row.family] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
          {row.family}
        </span>
      ),
      width: '12%',
    },
    {
      key: 'indicator',
      header: 'Indicateur',
      sortable: true,
      cell: (row) => <span className="text-sm font-bold text-slate-900">{row.indicator}</span>,
      width: '22%',
    },
    {
      key: 'value',
      header: 'Valeur',
      sortable: true,
      cell: (row) => <span className="text-sm font-black italic tracking-tight text-slate-900">{row.value}</span>,
      width: '12%',
    },
    {
      key: 'status',
      header: 'État',
      sortable: true,
      filterable: true,
      filterOptions: statusOptions,
      cell: (row) => (
        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${STATUS_CLASSES[row.status]}`}>
          {STATUS_LABELS[row.status]}
        </span>
      ),
      width: '14%',
    },
    {
      key: 'detail',
      header: 'Détail',
      sortable: true,
      cell: (row) => <p className="text-sm leading-6 text-slate-600">{row.detail}</p>,
      width: '24%',
    },
    {
      key: 'action',
      header: 'Suite à donner',
      sortable: true,
      cell: (row) =>
        row.actionHref ? (
          <Link
            to={row.actionHref}
            className="inline-flex items-center gap-1 text-sm font-bold text-rdpc-blue underline decoration-blue-200 underline-offset-2 hover:decoration-rdpc-blue"
          >
            {row.actionHint}
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
          </Link>
        ) : (
          <p className="text-sm leading-6 text-slate-600">{row.actionHint}</p>
        ),
      width: '16%',
    },
  ];

  return (
    meaningfulRows.length === 0 ? null : (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
      <div className="px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Détail
            </p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {meaningfulRows.length} ligne(s) utiles pour {VIEW_LABELS[viewMode].toLowerCase()}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
            {isExpanded ? 'Masquer les détails' : 'Voir plus de détails'}
          </button>
        </div>
      </div>
      {isExpanded ? (
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="max-h-[70vh] overflow-auto">
            <DataTable<ReportsTableRow>
              rows={sortedRows}
              columns={columns}
              loading={loading}
              getRowKey={(row) => row.id}
              sort={sort}
              onSortChange={(key) => {
                setSort((current) => {
                  if (!current || current.key !== key) return { key, dir: 'asc' };
                  return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
                });
              }}
              columnFilters={columnFilters}
              onColumnFilterChange={(key, values) => setColumnFilters((current) => ({ ...current, [key]: values }))}
              enableColumnVisibility
              visibleColumnKeys={visibleColumnKeys}
              onVisibleColumnKeysChange={setVisibleColumnKeys}
              rowClassName={(row) => (
                row.status === 'attention'
                  ? 'ring-1 ring-inset ring-amber-100'
                  : row.status === 'positive'
                    ? 'ring-1 ring-inset ring-emerald-100'
                    : ''
              )}
              toolbar={(
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {sortedRows.length} ligne(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void exportReportsRowsExcel(sortedRows, viewMode);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
                  >
                    Exporter le tableau
                  </button>
                </div>
              )}
              empty="Aucune ligne ne correspond à cette vue."
            />
          </div>
        </div>
      ) : null}
    </div>
    )
  );
};
