import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../../services/api';
import type { TenantUser, OrgUnitNode } from './types';
import { PAGE_SIZE, ROLE_LABELS, ROLE_BADGE_STYLES } from './constants';
import { errorMessage } from './hooks';
import { Avatar } from './Avatar';
import { DataTable, type Column, type SortState } from '../../../../components/ui/DataTable';

const RowActionMenu: React.FC<{ user: TenantUser; onAfter: () => void }> = ({ user, onAfter }) => {
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

  const toggleActive = async () => {
    setOpen(false);
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      onAfter();
    } catch (e) {
      window.alert('Échec : ' + errorMessage(e));
    }
  };

  const resetPassword = async () => {
    setOpen(false);
    const pwd = window.prompt(`Nouveau mot de passe pour ${user.matricule} (min. 6 caractères) :`);
    if (!pwd || pwd.length < 6) return;
    try {
      await api.updateUser(user.id, { password: pwd });
      window.alert('Mot de passe réinitialisé.');
    } catch (e) {
      window.alert('Échec : ' + errorMessage(e));
    }
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={`Actions pour ${user.full_name || user.matricule}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-all ${
          open ? 'bg-rdpc-blue/10 text-rdpc-blue' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rdpc-blue hover:bg-rdpc-blue/5'
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-base">more_horiz</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-20 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5">
          <button
            type="button"
            role="menuitem"
            onClick={toggleActive}
            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              {user.is_active ? 'pause_circle' : 'play_circle'}
            </span>
            {user.is_active ? 'Désactiver' : 'Réactiver'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={resetPassword}
            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-base">key</span>
            Réinitialiser le mot de passe
          </button>
        </div>
      )}
    </div>
  );
};

type OrgPathEntry = { name: string; code: string; level: number };

const buildOrgPathMap = (tree: OrgUnitNode[]): Map<string, OrgPathEntry[]> => {
  const map = new Map<string, OrgPathEntry[]>();
  const walk = (nodes: OrgUnitNode[], path: OrgPathEntry[]) => {
    for (const n of nodes) {
      const next = [...path, { name: n.name, code: n.code, level: n.level }];
      map.set(n.id, next);
      if (n.children?.length) walk(n.children, next);
    }
  };
  walk(tree, []);
  return map;
};

export const UserTable: React.FC<{ users: TenantUser[]; showRole: boolean; orgTree?: OrgUnitNode[]; onChange?: () => void }> = ({ users, showRole, orgTree, onChange }) => {
  const orgPathMap = useMemo(() => buildOrgPathMap(orgTree ?? []), [orgTree]);
  const reportsCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of users) {
      if (u.reports_to_user_id) m.set(u.reports_to_user_id, (m.get(u.reports_to_user_id) ?? 0) + 1);
    }
    return m;
  }, [users]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>({ key: 'user', dir: 'asc' });
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  const orgPath = (id: string | null | undefined) => (id ? orgPathMap.get(id) : undefined);
  const orgPathString = (id: string | null | undefined) => orgPath(id)?.map((p) => p.name).join(' › ') ?? '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cf = columnFilters;
    return users.filter((u) => {
      if (q && !(
        u.matricule?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )) return false;
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;

      const orgSel = cf.org_unit;
      if (orgSel && orgSel.length > 0 && !orgSel.includes(u.org_unit_id || '__none__')) return false;
      const roleSel = cf.role;
      if (roleSel && roleSel.length > 0 && !roleSel.includes(u.role)) return false;
      const statusSel = cf.status;
      if (statusSel && statusSel.length > 0 && !statusSel.includes(u.is_active ? 'active' : 'inactive')) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter, columnFilters]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sort.key) {
        case 'user':
          av = (a.full_name || a.matricule || '').toLowerCase();
          bv = (b.full_name || b.matricule || '').toLowerCase();
          break;
        case 'matricule':
          av = (a.matricule || '').toLowerCase();
          bv = (b.matricule || '').toLowerCase();
          break;
        case 'role':
          av = (ROLE_LABELS[a.role] || a.role || '').toLowerCase();
          bv = (ROLE_LABELS[b.role] || b.role || '').toLowerCase();
          break;
        case 'org_unit':
          av = orgPathString(a.org_unit_id).toLowerCase();
          bv = orgPathString(b.org_unit_id).toLowerCase();
          break;
        case 'reports':
          av = reportsCount.get(a.id) ?? 0;
          bv = reportsCount.get(b.id) ?? 0;
          break;
        case 'status':
          av = a.is_active ? 0 : 1;
          bv = b.is_active ? 0 : 1;
          break;
        default:
          return 0;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sort, reportsCount, orgPathMap]);

  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter, columnFilters, sort, users.length]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };
  const setColumnFilter = (key: string, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [key]: values }));
  };

  const orgFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    let hasNone = false;
    for (const u of users) {
      if (!u.org_unit_id) { hasNone = true; continue; }
      if (seen.has(u.org_unit_id)) continue;
      seen.add(u.org_unit_id);
      const path = orgPathMap.get(u.org_unit_id);
      const label = path ? path.map((p) => p.name).join(' › ') : u.org_unit_id;
      opts.push({ value: u.org_unit_id, label });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    if (hasNone) opts.unshift({ value: '__none__', label: '(Sans service)' });
    return opts;
  }, [users, orgPathMap]);

  const roleFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const u of users) {
      if (!u.role || seen.has(u.role)) continue;
      seen.add(u.role);
      opts.push({ value: u.role, label: ROLE_LABELS[u.role] || u.role });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [users]);

  const statusFilterOptions: { value: string; label: string }[] = [
    { value: 'active', label: 'Actif' },
    { value: 'inactive', label: 'Inactif' },
  ];

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rolesPresent = Array.from(new Set(users.map((u) => u.role))).filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100 bg-white/50">
        <div className="relative flex-1 min-w-[200px]">
          <span aria-hidden="true" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, matricule, email)..."
            aria-label="Rechercher un utilisateur"
            className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-100 focus:border-rdpc-blue outline-none text-sm"
          />
        </div>
        {showRole && (
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filtrer par rôle"
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700"
          >
            <option value="">Tous les rôles</option>
            {rolesPresent.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
            ))}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          aria-label="Filtrer par statut"
          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700"
        >
          <option value="">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        <DataTable<TenantUser>
          rows={paged}
          getRowKey={(u) => u.id}
          sort={sort}
          onSortChange={toggleSort}
          columnFilters={columnFilters}
          onColumnFilterChange={setColumnFilter}
          empty="Aucun utilisateur ne correspond aux filtres."
          columns={[
            {
              key: 'user',
              header: 'Utilisateur',
              width: '32%',
              sortable: true,
              cell: (u) => (
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={u.full_name} matricule={u.matricule} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{u.full_name || '—'}</p>
                    {u.email && <p className="text-[11px] text-slate-400 truncate font-medium">{u.email}</p>}
                  </div>
                </div>
              ),
            },
            {
              key: 'matricule',
              header: 'Matricule',
              width: '14%',
              sortable: true,
              cell: (u) => (
                <span className="text-[11px] font-bold text-slate-500 font-mono uppercase">{u.matricule}</span>
              ),
            },
            ...(showRole
              ? [{
                  key: 'role',
                  header: 'Rôle',
                  width: '12%',
                  sortable: true,
                  filterable: true,
                  filterOptions: roleFilterOptions,
                  cell: (u: TenantUser) => (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${ROLE_BADGE_STYLES[u.role] || 'bg-slate-100 text-slate-600'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  ),
                } as Column<TenantUser>]
              : []),
            {
              key: 'org_unit',
              header: 'Service',
              width: '22%',
              sortable: true,
              filterable: true,
              filterOptions: orgFilterOptions,
              cell: (u: TenantUser) => {
                const path = u.org_unit_id ? orgPathMap.get(u.org_unit_id) : undefined;
                if (!path || path.length === 0) {
                  return <span className="text-[11px] text-slate-300 italic">—</span>;
                }
                const leaf = path[path.length - 1];
                if (!leaf) {
                  return <span className="text-[11px] text-slate-300 italic">—</span>;
                }
                const ancestors = path.slice(0, -1);
                return (
                  <div className="min-w-0" title={path.map((p) => p.name).join(' › ')}>
                    {ancestors.length > 0 && (
                      <p className="text-[10px] text-slate-400 truncate font-medium">
                        {ancestors.map((a) => a.code).join(' › ')}
                      </p>
                    )}
                    <p className="text-xs font-bold text-slate-700 truncate">{leaf.name}</p>
                  </div>
                );
              },
            },
            {
              key: 'reports',
              header: 'N-1',
              width: '8%',
              align: 'center',
              sortable: true,
              cell: (u: TenantUser) => {
                const n = reportsCount.get(u.id) ?? 0;
                if (n === 0) return <span className="text-[11px] text-slate-300">—</span>;
                return (
                  <span
                    title={`${n} subordonné${n !== 1 ? 's' : ''} direct${n !== 1 ? 's' : ''}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rdpc-blue/10 text-rdpc-blue text-[11px] font-black"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-sm">group</span>
                    {n}
                  </span>
                );
              },
            },
            {
              key: 'status',
              header: 'Statut',
              width: '10%',
              sortable: true,
              filterable: true,
              filterOptions: statusFilterOptions,
              cell: (u) => (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                  u.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                  {u.is_active ? 'Actif' : 'Inactif'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              srOnlyHeader: true,
              align: 'right',
              width: '8%',
              cell: (u) => <RowActionMenu user={u} onAfter={() => onChange?.()} />,
            },
          ]}
        />
      </div>

      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white/50 text-xs text-slate-500">
          <span>
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} sur {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
              aria-label="Page précédente"
            >
              ‹
            </button>
            <span className="px-3 py-1.5 font-bold">{safePage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
              aria-label="Page suivante"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
