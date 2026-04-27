import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { DataTable, type Column } from '../../../components/ui/DataTable';

interface Tenant {
  id: string;
  name: string;
  short_name?: string | null;
  domain?: string | null;
  is_active: boolean;
  created_at: string;
}

const TenantsAdmin: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState({ name: '', short_name: '', domain: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getTenants();
      setTenants(data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await api.createTenant({
        name: form.name.trim(),
        short_name: form.short_name.trim() || undefined,
        domain: form.domain.trim() || undefined,
        is_active: true,
      });
      setShowModal(false);
      if (searchParams.get('new')) setSearchParams({});
      setForm({ name: '', short_name: '', domain: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (t: Tenant) => {
    try {
      await api.updateTenant(t.id, { is_active: !t.is_active });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Mise à jour impossible');
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-red/5 text-cam-red rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-red/10">
            <span className="w-1.5 h-1.5 rounded-full bg-cam-red animate-pulse"></span>
            Plateforme
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Gestion des <span className="text-cam-red">Institutions</span></h2>
          <p className="text-slate-500 mt-1 font-medium italic">Ministères, agences et organisations hébergées.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-6 py-3 rounded-2xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-800 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Nouvelle institution
        </button>
      </div>

      {error && (
        <div className="glass p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="glass rounded-[2.5rem] bg-white/40 border-white overflow-hidden">
        <DataTable<Tenant>
          rows={tenants}
          loading={loading}
          getRowKey={(t) => t.id}
          onRowClick={(t) => navigate(`/tenants/${t.id}`)}
          isRowClickable={(t) => t.short_name !== 'PLATFORM'}
          rowClassName={(t) => (t.short_name === 'PLATFORM' ? 'bg-amber-50/30' : '')}
          empty='Aucune institution. Clique sur "Nouvelle institution" pour commencer.'
          columns={[
            {
              key: 'name',
              header: 'Nom',
              cell: (t) => (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  {t.name}
                  {t.short_name === 'PLATFORM' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-700">
                      <span className="material-symbols-outlined text-[10px]">shield</span>
                      Système
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'short_name',
              header: 'Sigle',
              cell: (t) => <span className="text-xs text-slate-500 uppercase">{t.short_name || '—'}</span>,
            },
            {
              key: 'domain',
              header: 'Domaine',
              cell: (t) => <span className="text-xs text-slate-500">{t.domain || '—'}</span>,
            },
            {
              key: 'status',
              header: 'Statut',
              cell: (t) => (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    t.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                  {t.is_active ? 'Actif' : 'Suspendu'}
                </span>
              ),
            },
            {
              key: 'created_at',
              header: 'Créé le',
              cell: (t) => (
                <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('fr-FR')}</span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              cell: (t) =>
                t.short_name === 'PLATFORM' ? (
                  <span className="text-[10px] text-slate-400 italic">non-modifiable</span>
                ) : (
                  <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleActive(t)}
                      className="text-xs font-bold text-rdpc-blue hover:underline"
                    >
                      {t.is_active ? 'Suspendre' : 'Réactiver'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/tenants/${t.id}`)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rdpc-blue transition-colors"
                      aria-label={`Ouvrir ${t.name}`}
                    >
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                ),
            },
          ] satisfies Column<Tenant>[]}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-8" onClick={() => !submitting && setShowModal(false)}>
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl space-y-5"
          >
            <h3 className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">Nouvelle institution</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ministère de la Santé Publique"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Sigle</label>
                <input
                  type="text"
                  value={form.short_name}
                  onChange={(e) => setForm({ ...form, short_name: e.target.value })}
                  placeholder="MINSANTE"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Domaine</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="minsante.cm"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || !form.name.trim()}
                className="flex-1 py-3 rounded-xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all disabled:opacity-50"
              >
                {submitting ? 'Création...' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default TenantsAdmin;
