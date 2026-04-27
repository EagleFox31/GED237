import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import type { Document } from '../../../types';
import { formatDate, formatFileSize, getFileTypeLabel } from '../../../types';

interface OrgUnitNode {
  id: string;
  name: string;
  code: string;
  children?: OrgUnitNode[];
}

interface UserNode {
  id: string;
  org_unit_id: string;
}

const flattenUnits = (nodes: OrgUnitNode[], depth = 0): Array<OrgUnitNode & { depth: number }> =>
  nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenUnits(node.children ?? [], depth + 1),
  ]);

const collectDescendantIds = (node: OrgUnitNode): string[] => [
  node.id,
  ...(node.children ?? []).flatMap((child) => collectDescendantIds(child)),
];

const SpacesPage: React.FC = () => {
  const navigate = useNavigate();
  const [treeData, setTreeData] = useState<OrgUnitNode[]>([]);
  const [users, setUsers] = useState<UserNode[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recursive, setRecursive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const loadBaseData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [treeResp, usersResp] = await Promise.all([
          api.getOrgUnitsTree(),
          api.getUsers(),
        ]);
        setTreeData(treeResp);
        setUsers(usersResp);
        if (treeResp.length > 0) {
          const flattened = flattenUnits(treeResp);
          setSelectedUnitId(flattened[0]?.id || '');
        }
      } catch (e) {
        console.error('Failed to fetch spaces base data', e);
        setError("Impossible de charger les espaces documentaires.");
      } finally {
        setLoading(false);
      }
    };

    loadBaseData();
  }, []);

  const flatUnits = useMemo(() => flattenUnits(treeData), [treeData]);
  const selectedUnit = useMemo(
    () => flatUnits.find((unit) => unit.id === selectedUnitId) || null,
    [flatUnits, selectedUnitId]
  );

  useEffect(() => {
    const loadDocuments = async () => {
      if (!selectedUnitId) {
        setDocuments([]);
        return;
      }

      try {
        setDocumentsLoading(true);
        setError(null);
        const docs = await api.getWorkspaceDocuments(selectedUnitId, recursive);
        setDocuments(docs);
      } catch (e) {
        console.error('Failed to fetch workspace documents', e);
        setDocuments([]);
        setError("Impossible de charger les documents du service sélectionné.");
      } finally {
        setDocumentsLoading(false);
      }
    };

    loadDocuments();
  }, [selectedUnitId, recursive]);

  const descendantIds = useMemo(
    () => (selectedUnit ? new Set(collectDescendantIds(selectedUnit)) : new Set<string>()),
    [selectedUnit]
  );
  const staffCount = useMemo(
    () => users.filter((user) => descendantIds.has(user.org_unit_id)).length,
    [users, descendantIds]
  );
  const subUnitCount = selectedUnit?.children?.length || 0;
  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set(documents.map((doc) => getFileTypeLabel(doc.mime_type || doc.file_type)).filter(Boolean))
      ).sort(),
    [documents]
  );
  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(documents.map((doc) => doc.category_name || 'Non classé'))
      ).sort((a, b) => a.localeCompare(b)),
    [documents]
  );
  const availableStatuses = useMemo(
    () =>
      Array.from(new Set(documents.map((doc) => doc.status))).sort((a, b) => a.localeCompare(b)),
    [documents]
  );
  const filteredDocuments = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      const typeLabel = getFileTypeLabel(doc.mime_type || doc.file_type);
      const categoryLabel = doc.category_name || 'Non classé';
      const matchesSearch =
        !normalizedQuery ||
        doc.title.toLowerCase().includes(normalizedQuery) ||
        categoryLabel.toLowerCase().includes(normalizedQuery);
      const matchesType = !typeFilter || typeLabel === typeFilter;
      const matchesCategory = !categoryFilter || categoryLabel === categoryFilter;
      const matchesStatus = !statusFilter || doc.status === statusFilter;
      return matchesSearch && matchesType && matchesCategory && matchesStatus;
    });
  }, [documents, searchQuery, typeFilter, categoryFilter, statusFilter]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="max-w-4xl space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-rdpc-blue">
          Espaces documentaires
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Documents Classés Par Service</h1>
          <button
            type="button"
            onClick={() => navigate('/ingestion')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 hover:scale-[1.02]"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Importer
          </button>
        </div>
        <p className="text-sm font-medium text-slate-500">
          Choisissez un service. Les documents rangés dans ce service apparaissent immédiatement ci-dessous.
        </p>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center text-sm font-medium text-slate-500">
          Chargement des espaces...
        </div>
      ) : error && !selectedUnitId ? (
        <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-8">
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm space-y-5">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">1. Choisir le service</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Commencez simplement par sélectionner le service concerné.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Service
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                >
                  {flatUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {`${'— '.repeat(unit.depth)}${unit.name}`}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(e) => setRecursive(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rdpc-blue focus:ring-rdpc-blue"
                />
                <div>
                  <p className="text-sm font-bold text-slate-700">Inclure les sous-services</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Utile pour une direction ou une sous-direction qui supervise plusieurs services.
                  </p>
                </div>
              </label>

              <div className="rounded-[2rem] bg-slate-900 p-5 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Conseil simple</p>
                <p className="mt-3 text-sm font-medium text-slate-200">
                  Si vous cherchez un document d'un bureau précis, décochez les sous-services pour n'afficher que ce bureau.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">2. Résultat</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tighter italic uppercase text-slate-900">
                      {selectedUnit?.name || 'Aucun service'}
                    </h2>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      {recursive ? 'Service et sous-services inclus.' : 'Service uniquement.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 lg:min-w-[360px]">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documents</p>
                      <p className="mt-2 text-3xl font-black text-slate-900">{documentsLoading ? '...' : documents.length}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agents</p>
                      <p className="mt-2 text-3xl font-black text-slate-900">{staffCount}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sous-services</p>
                      <p className="mt-2 text-3xl font-black text-slate-900">{subUnitCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tighter italic uppercase">Liste Des Documents</h3>
                    <p className="text-sm font-medium text-slate-500">
                      Les documents les plus récents du service apparaissent ici.
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-rdpc-blue">
                    {filteredDocuments.length} trouvé{filteredDocuments.length > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">search</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher un document..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                    />
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                  >
                    <option value="">Tous les types</option>
                    {availableTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                  >
                    <option value="">Toutes les catégories</option>
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                  >
                    <option value="">Tous les statuts</option>
                    {availableStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                {error && selectedUnitId ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
                    {error}
                  </div>
                ) : documentsLoading ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-10 text-center text-sm font-medium text-slate-500">
                    Chargement des documents...
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                    <p className="text-base font-bold text-slate-700">
                      {documents.length === 0 ? "Aucun document dans cet espace." : "Aucun document ne correspond à votre recherche."}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-400">
                      {documents.length === 0
                        ? `Utilisez "Import en masse" ou l'ajout de document pour alimenter ce service.`
                        : 'Modifiez les filtres ou la recherche pour élargir le résultat.'}
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
                          <th className="px-6 py-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredDocuments
                          .slice()
                          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                          .map((doc) => (
                            <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{doc.title}</p>
                                  <p className="mt-1 text-[11px] font-medium text-slate-400">{doc.status}</p>
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
          </div>
        </>
      )}
    </div>
  );
};

export default SpacesPage;
