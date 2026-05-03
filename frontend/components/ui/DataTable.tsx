import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
  srOnlyHeader?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  filterOptions?: FilterOption[];
  hideable?: boolean;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isRowClickable?: (row: T) => boolean;
  rowClassName?: (row: T, index: number) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  sort?: SortState | null;
  onSortChange?: (key: string) => void;
  columnFilters?: Record<string, string[]>;
  onColumnFilterChange?: (key: string, values: string[]) => void;
  toolbar?: React.ReactNode;
  enableColumnVisibility?: boolean;
  visibleColumnKeys?: string[];
  onVisibleColumnKeysChange?: (keys: string[]) => void;
}

const alignClass = (a: Column<unknown>['align']) =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

interface MultiSelectFilterProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const clear = () => onChange([]);
  const selectAll = () => onChange(options.map((o) => o.value));
  const active = selected.length > 0;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filtrer ${label}${active ? ` (${selected.length} sélectionné${selected.length > 1 ? 's' : ''})` : ''}`}
        title={active ? `${selected.length} filtre${selected.length > 1 ? 's' : ''} actif${selected.length > 1 ? 's' : ''}` : `Filtrer ${label}`}
        className={`inline-flex items-center justify-center w-5 h-5 rounded transition-all ${
          active
            ? 'bg-rdpc-blue text-white'
            : 'text-slate-400 hover:text-rdpc-blue hover:bg-rdpc-blue/10'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '14px' }}>filter_alt</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-60 max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-100 py-1.5">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>{label}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={selectAll} className="text-rdpc-blue hover:underline">Tout</button>
              <button type="button" onClick={clear} className="text-slate-500 hover:underline">Effacer</button>
            </div>
          </div>
          {options.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-slate-400 italic">Aucune option.</p>
          ) : (
            options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer normal-case"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                    className="rounded border-slate-300 text-rdpc-blue focus:ring-rdpc-blue"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface ColumnVisibilityMenuProps<T> {
  columns: Column<T>[];
  visibleKeys: string[];
  onChange: (keys: string[]) => void;
}

function ColumnVisibilityMenu<T>({ columns, visibleKeys, onChange }: ColumnVisibilityMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hideableColumns = columns.filter((col) => col.hideable !== false);
  const visibleHideableCount = hideableColumns.filter((col) => visibleKeys.includes(col.key)).length;

  const toggle = (key: string) => {
    const isVisible = visibleKeys.includes(key);
    if (isVisible && visibleHideableCount <= 1) return;
    if (isVisible) onChange(visibleKeys.filter((value) => value !== key));
    else onChange([...visibleKeys, key]);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-white hover:border-slate-300"
      >
        <span className="material-symbols-outlined text-base">view_column</span>
        Colonnes
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-100 bg-white py-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Colonnes affichées</p>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {hideableColumns.map((col) => {
              const checked = visibleKeys.includes(col.key);
              return (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={checked && visibleHideableCount <= 1}
                    onChange={() => toggle(col.key)}
                    className="rounded border-slate-300 text-rdpc-blue focus:ring-rdpc-blue"
                  />
                  <span>{typeof col.header === 'string' ? col.header : col.key}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  isRowClickable,
  rowClassName,
  loading,
  empty,
  sort,
  onSortChange,
  columnFilters,
  onColumnFilterChange,
  toolbar,
  enableColumnVisibility,
  visibleColumnKeys,
  onVisibleColumnKeysChange,
}: DataTableProps<T>) {
  const allColumnKeys = useMemo(() => columns.map((col) => col.key), [columns]);
  const [internalVisibleKeys, setInternalVisibleKeys] = useState<string[]>(allColumnKeys);

  useEffect(() => {
    setInternalVisibleKeys((current) => {
      const next = current.filter((key) => allColumnKeys.includes(key));
      const missing = allColumnKeys.filter((key) => !next.includes(key));
      return [...next, ...missing];
    });
  }, [allColumnKeys]);

  const effectiveVisibleKeys = visibleColumnKeys ?? internalVisibleKeys;
  const setVisibleKeys = (keys: string[]) => {
    const normalized = allColumnKeys.filter((key) => keys.includes(key));
    if (onVisibleColumnKeysChange) onVisibleColumnKeysChange(normalized);
    else setInternalVisibleKeys(normalized);
  };

  const visibleColumns = columns.filter((col) => effectiveVisibleKeys.includes(col.key));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(toolbar || enableColumnVisibility) && (
        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div>{toolbar}</div>
          {enableColumnVisibility && (
            <ColumnVisibilityMenu
              columns={columns}
              visibleKeys={effectiveVisibleKeys}
              onChange={setVisibleKeys}
            />
          )}
        </div>
      )}

      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-20">
          <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
            {visibleColumns.map((col) => {
              const isSorted = sort && sort.key === col.key;
              const sortable = col.sortable && !!onSortChange;
              const filterable = col.filterable && col.filterOptions && onColumnFilterChange;
              const justify = col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start';
              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-5 py-3 ${alignClass(col.align)} ${col.headerClassName ?? ''} bg-slate-100`}
                >
                  {col.srOnlyHeader ? (
                    <span className="sr-only">{col.header}</span>
                  ) : (
                    <div className={`inline-flex items-center gap-1.5 ${justify}`}>
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => onSortChange!(col.key)}
                          className={`inline-flex items-center gap-1 hover:text-slate-800 transition-colors ${
                            isSorted ? 'text-rdpc-blue' : ''
                          }`}
                        >
                          {col.header}
                          <span aria-hidden="true" className="material-symbols-outlined text-sm">
                            {isSorted ? (sort!.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                          </span>
                        </button>
                      ) : (
                        <span>{col.header}</span>
                      )}
                      {filterable && (
                        <MultiSelectFilter
                          label={typeof col.header === 'string' ? col.header : col.key}
                          options={col.filterOptions!}
                          selected={columnFilters?.[col.key] ?? []}
                          onChange={(values) => onColumnFilterChange!(col.key, values)}
                        />
                      )}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={visibleColumns.length || 1} className="py-16 text-center text-slate-400 font-medium italic">
                {empty ?? 'Aucune donnée.'}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => {
              const clickable = onRowClick && (isRowClickable ? isRowClickable(row) : true);
              const baseRow = `border-b border-slate-100 last:border-0 transition-colors ${
                idx % 2 === 0 ? 'bg-white/60' : 'bg-white/30'
              }`;
              const interactive = clickable ? 'cursor-pointer hover:bg-rdpc-blue/5' : '';
              const extra = rowClassName?.(row, idx) ?? '';
              return (
                <tr
                  key={getRowKey(row)}
                  onClick={clickable ? () => onRowClick!(row) : undefined}
                  className={`group ${baseRow} ${interactive} ${extra}`.trim()}
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-3 ${alignClass(col.align)} ${col.cellClassName ?? ''}`}
                    >
                      {col.cell(row, idx)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
