import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';

interface PlatformUser {
  id: string;
  matricule: string;
  full_name?: string;
  email?: string;
  role?: { code?: string; name?: string } | string;
  tenant_id?: string;
  is_active: boolean;
  created_at?: string;
}

interface Tenant { id: string; name: string; short_name?: string | null }

const PlatformUsers: React.FC = () => {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [u, t] = await Promise.all([
          api.getPlatformUsers({ limit: 500 }),
          api.getTenants(),
        ]);
        setUsers(Array.isArray(u) ? u : (u.items || u.results || []));
        setTenants(t || []);
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!tenantFilter) return users;
    return users.filter((u) => u.tenant_id === tenantFilter);
  }, [users, tenantFilter]);

  const tenantName = (id?: string) => tenants.find((t) => t.id === id)?.short_name || tenants.find((t) => t.id === id)?.name || '—';
  const roleLabel = (r: PlatformUser['role']) => {
    if (!r) return '—';
    if (typeof r === 'string') return r;
    return r.name || r.code || '—';
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-red/5 text-cam-red rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-red/10">
            <span className="w-1.5 h-1.5 rounded-full bg-cam-red animate-pulse"></span>
            Plateforme
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Utilisateurs <span className="text-cam-red">Plateforme</span></h2>
          <p className="text-slate-500 mt-1 font-medium italic">Tous les comptes, toutes institutions confondues.</p>
        </div>
        <select
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="px-4 py-3 rounded-2xl bg-white border-2 border-slate-100 text-xs font-bold text-slate-700"
        >
          <option value="">Toutes les institutions</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.short_name || t.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="glass p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">{error}</div>
      )}

      <div className="glass rounded-[2.5rem] bg-white/40 border-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue"></div>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 font-medium italic py-16">Aucun utilisateur.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="text-left px-6 py-4">Matricule</th>
                <th className="text-left px-6 py-4">Nom</th>
                <th className="text-left px-6 py-4">Rôle</th>
                <th className="text-left px-6 py-4">Institution</th>
                <th className="text-left px-6 py-4">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-xs font-bold text-slate-800 uppercase">{u.matricule}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{u.full_name || '—'}</td>
                  <td className="px-6 py-4 text-xs text-slate-500 uppercase">{roleLabel(u.role)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{tenantName(u.tenant_id)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                      {u.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PlatformUsers;
