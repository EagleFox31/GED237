import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { CreateOrgUnitModal } from '../../super-admin/pages/tenant-detail/CreateOrgUnitModal';
import { CreateAdminModal } from '../../super-admin/pages/tenant-detail/CreateAdminModal';
import type { OrgUnitNode as SuperOrgUnitNode, TenantUser } from '../../super-admin/pages/tenant-detail/types';
import type { Document } from '../../../types';
import { formatDate, formatFileSize, getFileTypeLabel } from '../../../types';

// Interface matching the backend Schema
interface OrgUnitNode {
  id: string;
  name: string;
  code: string;
  level?: number;
  description?: string;
  parent_id?: string;
  children?: OrgUnitNode[];
}

interface UserNode {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  matricule: string;
  is_active: boolean;
  org_unit_id: string;
  role?: string;
  role_label?: string;
}

// Composant Récursif pour l'Arbre
interface OrgTreeNodeProps {
  node: OrgUnitNode;
  selectedId: string | null;
  onSelect: (n: OrgUnitNode) => void;
  depth?: number;
}

const OrgTreeNode: React.FC<OrgTreeNodeProps> = ({ node, selectedId, onSelect, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div className="select-none">
      <div
        onClick={() => onSelect(node)}
        className={`group flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-all duration-200 ${isSelected ? 'bg-rdpc-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        style={{ marginLeft: `${depth * 12}px` }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${hasChildren ? 'hover:bg-white/20' : 'invisible'}`}
        >
          <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>chevron_right</span>
        </button>

        <span className="material-symbols-outlined text-lg opacity-80">
          {depth === 0 ? 'account_balance' : depth === 1 ? 'admin_panel_settings' : 'folder'}
        </span>

        <span className={`text-[11px] font-bold uppercase tracking-tight truncate ${isSelected ? 'text-white' : ''}`}>
          {node.name}
        </span>
      </div>

      {hasChildren && (
        <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="relative">
            {/* Ligne verticale de hiérarchie */}
            <div className="absolute left-[27px] top-0 bottom-0 w-px bg-slate-200" style={{ left: `${(depth * 12) + 27}px` }}></div>
            {node.children!.map(child => (
              <OrgTreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const OrganizationPage: React.FC = () => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [treeData, setTreeData] = useState<OrgUnitNode[]>([]);
  const [allUsers, setAllUsers] = useState<UserNode[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<OrgUnitNode | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'staff' | 'chart'>('info');
  const [loading, setLoading] = useState(true);
  const [unitDocuments, setUnitDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [createdUserInfo, setCreatedUserInfo] = useState<{ matricule: string; password?: string } | null>(null);
  const [orgModalParent, setOrgModalParent] = useState<{ id: string; name: string; level: number } | null | undefined>(undefined);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const loadUnitDocuments = async () => {
      if (!selectedUnit) {
        setUnitDocuments([]);
        setDocumentsError(null);
        return;
      }

      try {
        setDocumentsLoading(true);
        setDocumentsError(null);
        const docs = await api.getWorkspaceDocuments(selectedUnit.id, true);
        setUnitDocuments(docs);
      } catch (e) {
        console.error('Failed to fetch workspace documents', e);
        setUnitDocuments([]);
        setDocumentsError("Impossible de charger les documents de ce service.");
      } finally {
        setDocumentsLoading(false);
      }
    };

    loadUnitDocuments();
  }, [selectedUnit?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [treeResp, usersResp] = await Promise.all([
        api.getOrgUnitsTree(),
        api.getUsers()
      ]);
      setTreeData(treeResp);
      setAllUsers(usersResp);
      if (treeResp.length > 0) {
        setSelectedUnit(treeResp[0]);
      }
    } catch (e) {
      console.error("Failed to fetch org units or users", e);
    } finally {
      setLoading(false);
    }
  };

  const collectDescendantIds = (node: OrgUnitNode): string[] => {
    const ids = [node.id];
    node.children?.forEach((c) => ids.push(...collectDescendantIds(c)));
    return ids;
  };

  const flattenTree = (nodes: OrgUnitNode[]): OrgUnitNode[] =>
    nodes.flatMap((n) => [n, ...flattenTree(n.children ?? [])]);
  const orgById = new Map(flattenTree(treeData).map((n) => [n.id, n]));

  const getUnitStaff = () => {
    if (!selectedUnit) return [];
    const ids = new Set(collectDescendantIds(selectedUnit));
    return allUsers.filter(u => ids.has(u.org_unit_id));
  };

  const unitStaff = getUnitStaff();

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden bg-slate-50 animate-in fade-in duration-700">

      {/* Sidebar Gauche - Arbre Hiérarchique */}
      <div className="w-[320px] shrink-0 border-r border-slate-200 bg-white/50 backdrop-blur-sm flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Hiérarchie</h3>
            <button onClick={fetchData} className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rdpc-blue hover:text-white transition-colors">
              <span className="material-symbols-outlined text-sm">refresh</span>
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Filtrer la structure..."
              className="w-full bg-slate-100 border-none rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-rdpc-blue/20"
            />
            <span className="material-symbols-outlined text-slate-400 absolute left-2.5 top-2 text-sm">filter_list</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <p className="text-xs text-slate-400 italic font-medium p-4 text-center">Chargement...</p>
          ) : treeData.length === 0 ? (
            <p className="text-xs text-slate-400 italic font-medium p-4 text-center">Aucune structure d'organisation définie.</p>
          ) : (
            treeData.map(rootNode => (
              <OrgTreeNode key={rootNode.id} node={rootNode} selectedId={selectedUnit?.id || null} onSelect={setSelectedUnit} />
            ))
          )}
        </div>
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => setOrgModalParent(null)} className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs font-bold hover:bg-slate-50 hover:border-rdpc-blue hover:text-rdpc-blue transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg">add</span>
            Nouveau service racine
          </button>
        </div>
      </div>

      {/* Contenu Principal - Détails */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {selectedUnit ? (
          <>
            {/* En-tête Unité */}
            <div className="p-8 pb-0">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                <span>Admin. Centrale</span>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-rdpc-blue">{selectedUnit.code}</span>
              </div>

              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{selectedUnit.name}</h1>
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full tracking-widest">Actif</span>
                  </div>
                  <div className="flex items-center gap-6 mt-2 text-sm font-medium text-slate-500">
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-slate-400">grid_goldenratio</span>
                      Code: {selectedUnit.code}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-slate-400">calendar_month</span>
                      ID: {selectedUnit.id.substring(0, 8)}...
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setOrgModalParent({ id: selectedUnit.id, name: selectedUnit.name, level: selectedUnit.level ?? 0 })}
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">add</span> Ajouter sous-service
                  </button>
                  <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined text-lg">delete</span> Supprimer
                  </button>
                  <button className="px-5 py-2.5 bg-rdpc-blue text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-200 hover:bg-blue-800 transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">edit</span> Modifier
                  </button>
                </div>
              </div>

              {/* Onglets */}
              <div className="flex gap-8 border-b border-slate-200">
                {[
                  { id: 'info', label: 'Informations Générales', icon: 'info' },
                  { id: 'config', label: 'Règles GED', icon: 'gavel' },
                  { id: 'staff', label: 'Personnel', icon: 'group', count: unitStaff.length },
                  { id: 'chart', label: 'Organigramme', icon: 'account_tree' },
                  { id: 'stats', label: 'Statistiques', icon: 'analytics' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative ${activeTab === tab.id ? 'text-rdpc-blue' : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                    {tab.label}
                    {tab.count !== undefined && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[9px]">{tab.count}</span>}
                    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rdpc-blue rounded-t-full"></div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Contenu Onglets */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">

              {activeTab === 'info' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-green-400">description</span>
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documents Actifs</p>
                        <p className="text-3xl font-black mt-1">
                          {documentsLoading ? '...' : unitDocuments.length}
                        </p>
                        <p className="mt-2 text-[11px] font-medium text-slate-400">
                          {documentsError ? documentsError : 'Cette unité et ses sous-services'}
                        </p>
                      </div>
                      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white/5 to-transparent skew-x-12"></div>
                    </div>

                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm relative overflow-hidden group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                          <span className="material-symbols-outlined text-red-500">groups</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agents Assignés</p>
                      <p className="text-3xl font-black text-slate-800 mt-1">{unitStaff.length}</p>
                    </div>

                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm relative overflow-hidden group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                          <span className="material-symbols-outlined text-yellow-600">account_tree</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sous-Unités</p>
                      <p className="text-3xl font-black text-slate-800 mt-1">{selectedUnit.children ? selectedUnit.children.length : 0}</p>
                    </div>
                  </div>

                  {/* General Info Form */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-rdpc-blue">domain</span>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Identité de l'Unité</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nom de l'unité</label>
                        <input type="text" value={selectedUnit.name} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Parent ID</label>
                        <input type="text" value={selectedUnit.parent_id || 'Aucun (Racine)'} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Code Unité (Unique)</label>
                        <input type="text" value={selectedUnit.code} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-mono font-bold text-slate-700 focus:outline-none" />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Description / Missions</label>
                        <textarea rows={3} value={selectedUnit.description || ''} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium text-slate-700 focus:outline-none resize-none" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tighter italic uppercase">Documents Du Service</h3>
                        <p className="text-sm font-medium text-slate-500">
                          Vue simple des documents rangés dans cette unité et ses sous-services.
                        </p>
                      </div>
                      <div className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-widest">
                        {documentsLoading ? 'Chargement...' : `${unitDocuments.length} document${unitDocuments.length > 1 ? 's' : ''}`}
                      </div>
                    </div>

                    {documentsError ? (
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
                        {documentsError}
                      </div>
                    ) : documentsLoading ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-8 text-center text-sm font-medium text-slate-500">
                        Chargement des documents...
                      </div>
                    ) : unitDocuments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                        <p className="text-sm font-bold text-slate-600">Aucun document visible dans ce service.</p>
                        <p className="mt-2 text-xs font-medium text-slate-400">
                          Importez un document dans ce service ou dans l'un de ses sous-services pour le voir apparaître ici.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-[2rem] border border-slate-100">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <tr>
                              <th className="px-6 py-4">Document</th>
                              <th className="px-6 py-4">Type</th>
                              <th className="px-6 py-4">Catégorie</th>
                              <th className="px-6 py-4">Taille</th>
                              <th className="px-6 py-4">Mis à jour</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 bg-white">
                            {unitDocuments.slice(0, 8).map((doc) => (
                              <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-4">
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{doc.title}</p>
                                    <p className="mt-1 text-[11px] font-medium text-slate-400">V{doc.current_version_number || '1.0'}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-600">
                                  {getFileTypeLabel(doc.mime_type || doc.file_type)}
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                  {doc.category_name || 'Non classé'}
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                  {formatFileSize(doc.file_size)}
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                  {formatDate(doc.updated_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'staff' && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-right-8 duration-500">
                  <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Effectif du Service</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setIsUserModalOpen(true)} className="px-4 py-2 bg-rdpc-blue text-white rounded-xl text-[10px] font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">person_add</span> Créer Utilisateur
                      </button>
                    </div>
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Agent</th>
                        <th className="px-6 py-4">Matricule</th>
                        <th className="px-6 py-4">Rôle</th>
                        <th className="px-6 py-4">Service</th>
                        <th className="px-6 py-4">Contact</th>
                        <th className="px-6 py-4 text-center">Statut</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {unitStaff.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400 text-xs uppercase font-bold tracking-widest">
                            Aucun agent assigné
                          </td>
                        </tr>
                      ) : (
                        unitStaff.map((agent: UserNode) => (
                          <tr key={agent.id} className="group hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.first_name}`} alt="" className="w-10 h-10 rounded-xl bg-slate-100" />
                                <span className="text-sm font-bold text-slate-700">{agent.first_name} {agent.last_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-600">{agent.matricule}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold uppercase tracking-wide">
                                {agent.role_label || agent.role || '—'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                              {orgById.get(agent.org_unit_id)?.name ?? '—'}
                              {agent.org_unit_id === selectedUnit.id && (
                                <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-rdpc-blue rounded text-[9px]">ICI</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-500 font-mono">{agent.email}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide ${agent.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                }`}>
                                {agent.is_active ? 'Actif' : 'Inactif'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-slate-400 hover:text-rdpc-blue transition-colors mr-2"><span className="material-symbols-outlined">edit</span></button>
                              <button className="text-slate-400 hover:text-red-500 transition-colors"><span className="material-symbols-outlined">delete</span></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'chart' && (
                <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-100 rounded-[3rem] border border-dashed border-slate-300 relative animate-in zoom-in duration-500">
                  <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 shadow-sm border border-slate-200">
                    Vue Hiérarchique
                  </div>

                  {/* Arbre Visuel Simplifié */}
                  <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
                    {/* Niveau 1 : Chef */}
                    <div className="flex flex-col items-center relative z-10">
                      <div className="w-48 p-4 bg-white rounded-2xl shadow-xl border-t-4 border-rdpc-blue flex flex-col items-center text-center group cursor-pointer hover:-translate-y-1 transition-transform">
                        <p className="text-xs font-black text-slate-800">{selectedUnit.name}</p>
                        <p className="text-[10px] font-bold text-rdpc-blue uppercase mt-1">{selectedUnit.code}</p>
                      </div>
                      {selectedUnit.children && selectedUnit.children.length > 0 && (
                        <div className="h-8 w-px bg-slate-300"></div>
                      )}
                    </div>

                    {/* Niveau 2 : Sous-services */}
                    {selectedUnit.children && selectedUnit.children.length > 0 && (
                      <div className="flex gap-8 relative flex-wrap justify-center">
                        {/* Connecteur horizontal */}
                        {selectedUnit.children.length > 1 && (
                          <div className="absolute -top-4 left-10 right-10 h-4 border-t border-l border-r border-slate-300 rounded-t-xl hidden md:block"></div>
                        )}

                        {selectedUnit.children.map((child: OrgUnitNode) => (
                          <div key={child.id} className="flex flex-col items-center relative">
                            <div className="h-4 w-px bg-slate-300 absolute -top-4 hidden md:block"></div>
                            <div className="w-40 p-3 bg-white rounded-xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                  {child.name.charAt(0)}
                                </div>
                                <div className="text-left w-24 overflow-hidden">
                                  <p className="text-[10px] font-black text-slate-700 leading-tight truncate">{child.name}</p>
                                  <p className="text-[8px] font-medium text-slate-400 truncate">{child.code}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8 bg-white border border-slate-200 rounded-[3rem] shadow-sm">
              <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 animate-pulse">domain_disabled</span>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sélectionnez ou créez une structure</p>
            </div>
          </div>
        )}
      </div>

      {isUserModalOpen && userProfile?.tenantId && selectedUnit && (
        <CreateAdminModal
          tenantId={userProfile.tenantId}
          orgTree={treeData as unknown as SuperOrgUnitNode[]}
          existingUsers={allUsers as unknown as TenantUser[]}
          defaultOrgUnitId={selectedUnit.id}
          defaultRole="collaborator"
          onClose={() => setIsUserModalOpen(false)}
          onSuccess={fetchData}
          onCreated={(info) => setCreatedUserInfo({ matricule: info.matricule, password: info.password })}
        />
      )}

      {createdUserInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Compte créé</h3>
            <p className="text-sm text-slate-600">Communiquez ces identifiants à l'utilisateur. Il sera obligé de changer son mot de passe à la première connexion.</p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 font-mono text-sm">
              <div><span className="text-slate-400">Matricule:</span> <strong>{createdUserInfo.matricule}</strong></div>
              {createdUserInfo.password && <div><span className="text-slate-400">Mot de passe:</span> <strong>{createdUserInfo.password}</strong></div>}
            </div>
            <button onClick={() => setCreatedUserInfo(null)} className="w-full py-3 rounded-xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-widest hover:bg-blue-800">Fermer</button>
          </div>
        </div>
      )}

      {orgModalParent !== undefined && userProfile?.tenantId && (
        <CreateOrgUnitModal
          tenantId={userProfile.tenantId}
          parent={orgModalParent}
          onClose={() => setOrgModalParent(undefined)}
          onSuccess={fetchData}
        />
      )}

    </div>
  );
};

export default OrganizationPage;
