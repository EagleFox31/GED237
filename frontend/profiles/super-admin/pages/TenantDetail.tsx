// frontend/profiles/super-admin/pages/TenantDetail.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../services/api';

import type { DocStats, OrgUnitNode, Tab, Tenant, TenantUser, WfStats } from './tenant-detail/types';
import { STATUS_LABELS, STATUS_STYLES, TABS } from './tenant-detail/constants';
import { countOrgUnits, errorMessage } from './tenant-detail/hooks';
import { Empty, Spinner, StatCard } from './tenant-detail/MiscUI';
import { OrgNode } from './tenant-detail/OrgNode';
import { UserTable } from './tenant-detail/UserTable';
import { CreateAdminModal } from './tenant-detail/CreateAdminModal';
import { CreateOrgUnitModal } from './tenant-detail/CreateOrgUnitModal';
import { SetupStep } from './tenant-detail/SetupStep';
import { OrgUnitDrawer } from './tenant-detail/OrgUnitDrawer';

const findParent = (tree: OrgUnitNode[], id: string, parent: OrgUnitNode | null = null): { parent: OrgUnitNode | null } | null => {
  for (const n of tree) {
    if (n.id === id) return { parent };
    const found = findParent(n.children, id, n);
    if (found) return found;
  }
  return null;
};

const TenantDetail: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [orgTree, setOrgTree] = useState<OrgUnitNode[]>([]);
  const [docStats, setDocStats] = useState<DocStats | null>(null);
  const [wfStats, setWfStats] = useState<WfStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgParent, setOrgParent] = useState<OrgUnitNode | null>(null);
  const [createUserDefaults, setCreateUserDefaults] = useState<{ orgUnitId?: string | null; role?: string }>({});
  const [selectedOrg, setSelectedOrg] = useState<OrgUnitNode | null>(null);
  const [expandSignal, setExpandSignal] = useState(0);
  const [forceOpen, setForceOpen] = useState(true);
  const [maxLevel, setMaxLevel] = useState<number | undefined>(undefined);
  const [flash, setFlash] = useState<{ matricule: string; password?: string } | null>(null);
  const [flashCopied, setFlashCopied] = useState(false);

  const loadAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [tenantData, usersData, treeData, docData, wfData] = await Promise.all([
        api.getTenant(tenantId),
        api.getPlatformUsers({ tenant_id: tenantId }),
        api.getOrgUnitsTreeForTenant(tenantId),
        api.getDocumentStats(tenantId),
        api.getWorkflowStats(tenantId),
      ]);
      setTenant(tenantData);
      setUsers(usersData || []);
      setOrgTree(treeData || []);
      setDocStats(docData);
      setWfStats(wfData);
    } catch (e) {
      setError(errorMessage(e, 'Erreur de chargement'));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const admins = users.filter((u) => u.role === 'tenant_admin');
  const hasAdmins = admins.length > 0;
  const hasServices = orgTree.length > 0;

  if (loading) return <div className="p-8"><Spinner /></div>;
  if (error || !tenant) {
    return (
      <div className="p-8">
        <div className="glass p-6 rounded-3xl bg-red-50 border border-red-200 text-red-700 font-medium">
          {error || 'Institution introuvable'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">

      {flash && (
        <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
          flash.password ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'
        }`}>
          <span className={`material-symbols-outlined ${flash.password ? 'text-amber-600' : 'text-emerald-600'}`}>
            {flash.password ? 'key' : 'check_circle'}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${flash.password ? 'text-amber-900' : 'text-emerald-800'}`}>
              Utilisateur <span className="font-mono">{flash.matricule}</span> créé.
              {flash.password && ' Mot de passe temporaire (à copier maintenant — ne sera plus affiché) :'}
            </p>
            {flash.password && (
              <p className="mt-1.5 px-3 py-2 rounded-lg bg-slate-900 text-cam-yellow text-xs font-mono font-bold tracking-wider select-all break-all inline-block">
                {flash.password}
              </p>
            )}
          </div>
          {flash.password && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(flash.password!);
                  setFlashCopied(true);
                  setTimeout(() => setFlashCopied(false), 2500);
                } catch { /* ignore */ }
              }}
              className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                flashCopied ? 'bg-emerald-500 text-white' : 'bg-rdpc-blue text-white hover:bg-blue-800'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{flashCopied ? 'check' : 'content_copy'}</span>
              {flashCopied ? 'Copié' : 'Copier'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setFlash(null)}
            className={flash.password ? 'text-amber-700 hover:text-amber-900' : 'text-emerald-600 hover:text-emerald-900'}
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/tenants')}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-rdpc-blue text-xs font-bold uppercase tracking-widest mb-3 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Institutions
          </button>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">{tenant.name}</h2>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
              tenant.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tenant.is_active ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
              {tenant.is_active ? 'Actif' : 'Suspendu'}
            </span>
          </div>
          <p className="text-slate-400 text-sm font-medium">
            {tenant.short_name && <span className="uppercase font-black mr-2 text-rdpc-blue">{tenant.short_name}</span>}
            {tenant.domain && <span className="italic">{tenant.domain}</span>}
            <span className="mx-2 text-slate-300">·</span>
            <span>Créé le {new Date(tenant.created_at).toLocaleDateString('fr-FR')}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!hasAdmins ? (
            <button
              type="button"
              onClick={() => setShowCreateUser(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cam-red text-white text-xs font-black uppercase tracking-widest shadow hover:bg-red-700 transition-all animate-pulse"
              title="Étape 1 : créer le premier administrateur"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              Créer admin
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowCreateOrg(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest shadow-sm hover:border-rdpc-blue hover:text-rdpc-blue transition-all"
                title={hasServices ? 'Ajouter un service' : 'Étape 2 : créer le premier service'}
              >
                <span className="material-symbols-outlined text-base">add_business</span>
                Créer service
              </button>
              {hasServices && (
                <button
                  type="button"
                  onClick={() => setShowCreateUser(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-widest shadow hover:bg-blue-800 transition-all"
                  title="Étape 3 : ajouter un utilisateur"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  Créer utilisateur
                </button>
              )}
            </>
          )}
          {tenant.short_name !== 'PLATFORM' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.updateTenant(tenant.id, { is_active: !tenant.is_active });
                  await loadAll();
                } catch (e) {
                  setError(errorMessage(e, 'Mise à jour impossible'));
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all ${
                tenant.is_active
                  ? 'bg-white border-2 border-amber-200 text-amber-700 hover:border-amber-400'
                  : 'bg-white border-2 border-emerald-200 text-emerald-700 hover:border-emerald-400'
              }`}
              title={tenant.is_active ? 'Suspendre cette institution' : 'Réactiver cette institution'}
            >
              <span className="material-symbols-outlined text-base">
                {tenant.is_active ? 'pause_circle' : 'play_circle'}
              </span>
              {tenant.is_active ? 'Suspendre' : 'Réactiver'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1.5 bg-slate-100 rounded-2xl w-fit">
        {TABS.map((tab) => {
          const count =
            tab.id === 'admins' ? admins.length :
            tab.id === 'users' ? users.length :
            tab.id === 'services' ? countOrgUnits(orgTree) :
            null;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                isActive ? 'bg-white text-rdpc-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
              {count !== null && (
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-rdpc-blue/10 text-rdpc-blue' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        </div>

        {activeTab === 'services' && hasServices && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setForceOpen(true); setExpandSignal((s) => s + 1); }}
              title="Tout déplier"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:border-rdpc-blue hover:text-rdpc-blue transition-all"
            >
              <span className="material-symbols-outlined text-sm">unfold_more</span>
            </button>
            <button
              type="button"
              onClick={() => { setForceOpen(false); setExpandSignal((s) => s + 1); }}
              title="Tout replier"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest hover:border-rdpc-blue hover:text-rdpc-blue transition-all"
            >
              <span className="material-symbols-outlined text-sm">unfold_less</span>
            </button>
            <select
              value={maxLevel ?? ''}
              onChange={(e) => setMaxLevel(e.target.value ? Number(e.target.value) : undefined)}
              title="Filtrer par niveau"
              className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:border-rdpc-blue focus:border-rdpc-blue outline-none"
            >
              <option value="">Tous niveaux</option>
              <option value="1">Niveau 1</option>
              <option value="2">≤ Niveau 2</option>
              <option value="3">≤ Niveau 3</option>
              <option value="4">≤ Niveau 4</option>
            </select>
            <button
              type="button"
              onClick={() => setShowCreateOrg(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rdpc-blue text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add_business</span>
              Service racine
            </button>
          </div>
        )}
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon="group" label="Utilisateurs" value={users.length} color="text-rdpc-blue" onClick={() => setActiveTab('users')} />
            <StatCard icon="account_tree" label="Services" value={countOrgUnits(orgTree)} color="text-emerald-600" onClick={() => setActiveTab('services')} />
            <StatCard icon="folder_open" label="Documents actifs" value={docStats?.total ?? '—'} color="text-violet-600" sub={docStats?.trashed ? `${docStats.trashed} en corbeille` : undefined} />
            <StatCard
              icon="flowchart"
              label="Workflows actifs"
              value={wfStats?.active_workflow_steps ?? '—'}
              color="text-amber-600"
              sub={wfStats?.completed_workflow_steps !== undefined ? `${wfStats.completed_workflow_steps} étapes complétées` : undefined}
              onClick={() => setActiveTab('workflows')}
            />
          </div>

          {docStats && Object.keys(docStats.by_status).length > 0 && (
            <div className="glass rounded-3xl bg-white/60 border-white p-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Documents par statut</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(docStats.by_status).map(([status, count]) => {
                  const key = status.toLowerCase();
                  return (
                    <div key={status} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${STATUS_STYLES[key] || 'bg-slate-100 text-slate-700'}`}>
                      <span className="text-xs font-bold">{STATUS_LABELS[key] || status}</span>
                      <span className="text-xs font-black">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(!hasAdmins || !hasServices || users.length === admins.length) && (
            <div className="glass rounded-3xl bg-white/60 border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="material-symbols-outlined text-2xl text-rdpc-blue">flag</span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Configuration de l'institution</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Suivez ces étapes pour rendre l'institution opérationnelle.</p>
                </div>
              </div>

              <ol className="space-y-3">
                <SetupStep
                  index={1}
                  done={hasAdmins}
                  active={!hasAdmins}
                  title="Créer le premier administrateur"
                  desc="Sans admin, l'institution n'est pas gérable de façon autonome."
                  cta={!hasAdmins ? { label: 'Créer admin', onClick: () => { setActiveTab('admins'); setShowCreateUser(true); } } : undefined}
                />
                <SetupStep
                  index={2}
                  done={hasServices}
                  active={hasAdmins && !hasServices}
                  title="Créer la structure des services"
                  desc="Les services (org units) organisent l'institution. Ils sont nécessaires avant de créer des utilisateurs métier."
                  cta={hasAdmins && !hasServices ? { label: 'Créer service', onClick: () => { setActiveTab('services'); setShowCreateOrg(true); } } : undefined}
                  locked={!hasAdmins}
                />
                <SetupStep
                  index={3}
                  done={users.length > admins.length}
                  active={hasAdmins && hasServices && users.length === admins.length}
                  title="Créer les utilisateurs métier"
                  desc="Managers, collaborateurs, lecteurs… rattachés à un service."
                  cta={hasAdmins && hasServices && users.length === admins.length ? { label: 'Créer utilisateur', onClick: () => { setActiveTab('users'); setShowCreateUser(true); } } : undefined}
                  locked={!hasAdmins || !hasServices}
                />
              </ol>
            </div>
          )}

          {hasAdmins && hasServices && users.length > admins.length && (
            <div className="glass rounded-3xl bg-gradient-to-br from-emerald-50/80 to-white/60 border border-emerald-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="material-symbols-outlined text-2xl text-emerald-600">rocket_launch</span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Configuration de base terminée</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Voici comment aller plus loin avec cette institution.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/workflows')}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-rdpc-blue hover:shadow-md transition-all text-left"
                >
                  <span className="material-symbols-outlined text-xl text-rdpc-blue mt-0.5">flowchart</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-800">Configurer un workflow</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Définir un circuit de validation type pour les documents (ex : note → chef service → directeur).</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-rdpc-blue transition-colors">arrow_forward</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/rules')}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-rdpc-blue hover:shadow-md transition-all text-left"
                >
                  <span className="material-symbols-outlined text-xl text-violet-600 mt-0.5">rule</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-800">Définir des règles automatiques</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Auto-classer, notifier, ou router les documents selon des conditions (IFTTT).</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-rdpc-blue transition-colors">arrow_forward</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab('users'); setShowCreateUser(true); }}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-rdpc-blue hover:shadow-md transition-all text-left"
                >
                  <span className="material-symbols-outlined text-xl text-amber-600 mt-0.5">group_add</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-800">Compléter la hiérarchie</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Ajouter d'autres utilisateurs et renseigner leur N+1 pour activer les escalades.</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-rdpc-blue transition-colors">arrow_forward</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/documents')}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-rdpc-blue hover:shadow-md transition-all text-left"
                >
                  <span className="material-symbols-outlined text-xl text-emerald-600 mt-0.5">upload_file</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-800">Tester un dépôt de document</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Valider la chaîne complète : upload → OCR → indexation → recherche.</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-rdpc-blue transition-colors">arrow_forward</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/analytics')}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-rdpc-blue hover:shadow-md transition-all text-left"
                >
                  <span className="material-symbols-outlined text-xl text-rdpc-blue mt-0.5">analytics</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-800">Suivre l'activité</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Tableaux de bord d'usage, volumes, délais de traitement.</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-rdpc-blue transition-colors">arrow_forward</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/audit')}
                  className="group flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-rdpc-blue hover:shadow-md transition-all text-left"
                >
                  <span className="material-symbols-outlined text-xl text-slate-600 mt-0.5">history</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-800">Consulter le journal d'audit</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Traçabilité complète des actions sur les documents et utilisateurs.</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-rdpc-blue transition-colors">arrow_forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="glass rounded-[2.5rem] bg-white/40 border-white overflow-hidden">
            {admins.length === 0 ? (
              <div className="p-8">
                <Empty icon="admin_panel_settings" msg="Aucun administrateur pour cette institution." />
                <div className="flex justify-center mt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateUser(true)}
                    className="px-6 py-3 rounded-2xl bg-cam-red text-white text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                  >
                    Créer le premier admin
                  </button>
                </div>
              </div>
            ) : (
              <UserTable users={admins} showRole={false} orgTree={orgTree} onChange={loadAll} />
            )}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="glass rounded-[2.5rem] bg-white/40 border-white overflow-hidden">
            {users.length === 0 ? (
              <Empty icon="group" msg="Aucun utilisateur pour cette institution." />
            ) : (
              <UserTable users={users} showRole orgTree={orgTree} onChange={loadAll} />
            )}
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="glass rounded-[2.5rem] bg-white/40 border-white p-6">
            {orgTree.length === 0 ? (
              <Empty icon="account_tree" msg="Aucun service configuré pour cette institution." />
            ) : (
              <div className="space-y-1">
                {orgTree.map((node) => (
                  <OrgNode
                    key={node.id}
                    node={node}
                    resetSignal={expandSignal}
                    forceOpen={forceOpen}
                    maxLevel={maxLevel}
                    onAddChild={(p) => { setOrgParent(p); setShowCreateOrg(true); }}
                    onSelect={setSelectedOrg}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'workflows' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon="pending_actions" label="Étapes en cours" value={wfStats?.active_workflow_steps ?? '—'} color="text-amber-600" />
            <StatCard icon="task_alt" label="Étapes complétées" value={wfStats?.completed_workflow_steps ?? '—'} color="text-emerald-600" />
          </div>

          <div className="glass rounded-3xl bg-white/60 border-white p-6 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">open_in_new</span>
            <p className="text-sm font-medium text-slate-500 mb-4">
              La gestion détaillée des workflows est accessible depuis la vue globale.
            </p>
            <p className="text-xs text-slate-400 italic">
              Filtrage par institution disponible sur la page Workflows (fonctionnalité à venir).
            </p>
          </div>
        </div>
      )}

      {showCreateUser && tenantId && (
        <CreateAdminModal
          tenantId={tenantId}
          orgTree={orgTree}
          existingUsers={users}
          defaultOrgUnitId={createUserDefaults.orgUnitId ?? null}
          defaultRole={createUserDefaults.role}
          onClose={() => { setShowCreateUser(false); setCreateUserDefaults({}); }}
          onSuccess={loadAll}
          onCreated={({ roleCode, matricule, password }) => {
            const targetTab: Tab = roleCode === 'tenant_admin' ? 'admins' : 'users';
            setActiveTab(targetTab);
            setFlash({ matricule, password });
            setFlashCopied(false);
            if (!password) setTimeout(() => setFlash(null), 5000);
          }}
        />
      )}
      {selectedOrg && (
        <OrgUnitDrawer
          node={selectedOrg}
          parent={findParent(orgTree, selectedOrg.id)?.parent ?? null}
          users={users}
          onClose={() => setSelectedOrg(null)}
          onAddChild={(p) => { setOrgParent(p); setShowCreateOrg(true); setSelectedOrg(null); }}
          onAddUser={(n) => { setCreateUserDefaults({ orgUnitId: n.id, role: 'collaborator' }); setShowCreateUser(true); setSelectedOrg(null); }}
        />
      )}
      {showCreateOrg && tenantId && (
        <CreateOrgUnitModal
          tenantId={tenantId}
          parent={orgParent ? { id: orgParent.id, name: orgParent.name, level: orgParent.level } : null}
          onClose={() => { setShowCreateOrg(false); setOrgParent(null); }}
          onSuccess={loadAll}
        />
      )}
    </div>
  );
};

export default TenantDetail;
