import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type SpaceTreeNode } from '../../../services/api';
import { categoriesApi, type DocumentCategory } from '../../../services/categories.api';
import type { Document } from '../../../types';
import { formatDate, formatFileSize, getFileTypeLabel, getStatusLabel } from '../../../types';
import { ClassificationSlideOver } from '../../../components/ClassificationSlideOver';

interface UserNode {
  id: string;
  org_unit_id: string;
  full_name?: string | null;
}

interface ClassificationDomainOption {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
}

interface ClassificationActivityOption {
  id: string;
  domain_id: string;
  code: string;
  name: string;
  is_active?: boolean;
}

interface FlatUnitNode extends SpaceTreeNode {
  depth: number;
}

const CLASSIFICATION_STATUS_LABELS: Record<string, string> = {
  classified: 'Classe automatiquement',
  needs_review: 'A verifier',
  pending: 'En attente de classement',
  rejected: 'Rejete',
};

const CLASSIFICATION_STATUS_BADGES: Record<string, string> = {
  classified: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  needs_review: 'bg-amber-50 text-amber-700 border-amber-100',
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-100',
};

const SCOPE_LABELS: Record<string, string> = {
  person: 'Personne',
  service: 'Service',
  subdirectorate: 'Sous-direction',
  directorate: 'Direction',
};

const flattenUnits = (
  nodes: SpaceTreeNode[],
  depth = 0
): FlatUnitNode[] =>
  nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenUnits(node.children ?? [], depth + 1),
  ]);

const collectDescendantIds = (node: SpaceTreeNode): string[] => [
  node.id,
  ...(node.children ?? []).flatMap((child) => collectDescendantIds(child)),
];

const getClassificationStatusLabel = (status?: string | null) =>
  CLASSIFICATION_STATUS_LABELS[status || 'pending'] || status || 'En attente de classement';

const getClassificationStatusBadge = (status?: string | null) =>
  CLASSIFICATION_STATUS_BADGES[status || 'pending'] || CLASSIFICATION_STATUS_BADGES.pending;

const SpacesPage: React.FC = () => {
  const navigate = useNavigate();
  const [treeData, setTreeData] = useState<SpaceTreeNode[]>([]);
  const [users, setUsers] = useState<UserNode[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [domains, setDomains] = useState<ClassificationDomainOption[]>([]);
  const [activities, setActivities] = useState<ClassificationActivityOption[]>([]);
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
  const [classificationStatusFilter, setClassificationStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [documentToClassify, setDocumentToClassify] = useState<Document | null>(null);

  useEffect(() => {
    const loadBaseData = async () => {
      try {
        setLoading(true);
        setError(null);
        const treeResp = await api.getSpacesTree();
        setTreeData(treeResp);
        if (treeResp.length > 0) {
          const flattened = flattenUnits(treeResp);
          setSelectedUnitId(flattened[0]?.id || '');
        }

        const [usersResult, categoriesResult, domainsResult, activitiesResult] = await Promise.allSettled([
          api.getUsers(),
          categoriesApi.list(),
          api.getClassificationDomains(),
          api.getClassificationActivities(),
        ]);

        if (usersResult.status === 'fulfilled') {
          setUsers(usersResult.value);
        } else {
          console.warn('Failed to load users for spaces view', usersResult.reason);
          setUsers([]);
        }

        if (categoriesResult.status === 'fulfilled') {
          setCategories(categoriesResult.value);
        } else {
          console.warn('Failed to load categories for spaces view', categoriesResult.reason);
          setCategories([]);
        }

        if (domainsResult.status === 'fulfilled') {
          setDomains(
            domainsResult.value.filter((domain: ClassificationDomainOption) => domain.is_active !== false)
          );
        } else {
          console.warn('Failed to load classification domains for spaces view', domainsResult.reason);
          setDomains([]);
        }

        if (activitiesResult.status === 'fulfilled') {
          setActivities(
            activitiesResult.value.filter((activity: ClassificationActivityOption) => activity.is_active !== false)
          );
        } else {
          console.warn('Failed to load classification activities for spaces view', activitiesResult.reason);
          setActivities([]);
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

  const orgUnitNames = useMemo(
    () => new Map(flatUnits.map((unit) => [unit.id, unit.name])),
    [flatUnits]
  );

  const userNames = useMemo(
    () => new Map(users.map((user) => [user.id, user.full_name || user.id])),
    [users]
  );

  useEffect(() => {
    if (!activityFilter) {
      return;
    }
    const activity = activities.find((item) => item.id === activityFilter);
    if (activity && domainFilter && activity.domain_id !== domainFilter) {
      setActivityFilter('');
    }
  }, [activities, activityFilter, domainFilter]);

    const loadDocuments = async () => {
      if (!selectedUnitId) {
        setDocuments([]);
        return;
      }

      try {
        setDocumentsLoading(true);
        setError(null);
        const docs = await api.getSpaceDocuments(selectedUnitId, recursive);
        setDocuments(docs);
      } catch (e) {
        console.error('Failed to fetch space documents', e);
        setDocuments([]);
        const message =
          e instanceof Error && e.message
            ? e.message
            : "Impossible de charger les documents du service selectionne.";
        setError(message);
      } finally {
        setDocumentsLoading(false);
      }
    };

  useEffect(() => {
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
    () => categories.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const availableWorkflowStatuses = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.status))).sort((a, b) => a.localeCompare(b)),
    [documents]
  );

  const availableActivities = useMemo(() => {
    const source = domainFilter
      ? activities.filter((activity) => activity.domain_id === domainFilter)
      : activities;
    return source.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [activities, domainFilter]);

  const availableYears = useMemo(
    () =>
      Array.from(
        new Set(
          documents
            .map((doc) => doc.classification_year)
            .filter((year): year is number => typeof year === 'number')
        )
      ).sort((a, b) => b - a),
    [documents]
  );

  const getTargetLabel = (doc: Document) => {
    if (doc.classification_scope === 'person' && doc.classification_target_user_id) {
      return userNames.get(doc.classification_target_user_id) || 'Utilisateur cible';
    }
    const orgUnitKey = doc.classification_target_org_unit_id || doc.org_unit_id;
    return (
      (orgUnitKey ? orgUnitNames.get(orgUnitKey) : undefined) ||
      'Service non defini'
    );
  };

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      const typeLabel = getFileTypeLabel(doc.mime_type || doc.file_type);
      const categoryLabel = doc.category_name || 'Non classe';
      const targetUnitName = getTargetLabel(doc);
      const searchCorpus = [
        doc.title,
        categoryLabel,
        doc.logical_space_path || '',
        doc.classification_domain_name || '',
        doc.classification_activity_name || '',
        targetUnitName,
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedQuery || searchCorpus.includes(normalizedQuery);
      const matchesType = !typeFilter || typeLabel === typeFilter;
      const matchesCategory = !categoryFilter || doc.document_category_id === categoryFilter;
      const matchesWorkflowStatus = !statusFilter || doc.status === statusFilter;
      const matchesClassificationStatus =
        !classificationStatusFilter || (doc.classification_status || 'pending') === classificationStatusFilter;
      const matchesDomain = !domainFilter || doc.classification_domain_id === domainFilter;
      const matchesActivity = !activityFilter || doc.classification_activity_id === activityFilter;
      const matchesYear = !yearFilter || String(doc.classification_year || '') === yearFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesWorkflowStatus &&
        matchesClassificationStatus &&
        matchesDomain &&
        matchesActivity &&
        matchesYear
      );
    });
  }, [
    activityFilter,
    categoryFilter,
    classificationStatusFilter,
    documents,
    domainFilter,
    orgUnitNames,
    searchQuery,
    statusFilter,
    typeFilter,
    userNames,
    yearFilter,
  ]);

  const classifiedCount = useMemo(
    () => documents.filter((doc) => doc.classification_status === 'classified').length,
    [documents]
  );

  const reviewCount = useMemo(
    () => documents.filter((doc) => doc.classification_status === 'needs_review' || doc.classification_status === 'pending').length,
    [documents]
  );

  const distinctPathsCount = useMemo(
    () =>
      new Set(documents.map((doc) => doc.logical_space_path).filter((path): path is string => Boolean(path))).size,
    [documents]
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="max-w-5xl space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-rdpc-blue">
          Espaces documentaires
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">
              Vue documentaire metier
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Retrouvez les documents classes par service, domaine, activite et annee sans quitter la structure de votre organisation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/ingestion')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 hover:scale-[1.02]"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Importer
          </button>
        </div>
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
        <div className="space-y-6">
          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)_minmax(280px,0.8fr)] xl:items-start">
              <div className="space-y-3">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">1. Cibler le service</h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Choisissez l'unite organisationnelle qui porte les documents a consulter.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Service
                  </label>
                  <select
                    aria-label="Service documentaire"
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
              </div>

              <label className="flex items-start gap-3 rounded-[2rem] border border-slate-100 bg-slate-50 px-5 py-5 cursor-pointer h-full">
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(e) => setRecursive(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rdpc-blue focus:ring-rdpc-blue"
                />
                <div>
                  <p className="text-sm font-bold text-slate-700">Inclure les sous-services</p>
                  <p className="mt-1 text-xs font-medium leading-6 text-slate-400">
                    Utilisez cette vue pour une direction complete ou limitez-vous a un bureau precis.
                  </p>
                </div>
              </label>

              <div className="rounded-[2rem] bg-slate-900 p-5 text-white h-full">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Lecture metier</p>
                <p className="mt-3 text-sm font-medium text-slate-200">
                  Le chemin logique conserve le rangement documentaire attendu, sans imposer une arborescence physique fragile sur le serveur.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">2. Espace cible</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tighter italic uppercase text-slate-900">
                    {selectedUnit?.name || 'Aucun service'}
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    {recursive ? 'Service et sous-services inclus.' : 'Service uniquement.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:min-w-[420px] xl:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documents</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{documentsLoading ? '...' : documents.length}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classes</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{documentsLoading ? '...' : classifiedCount}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">A revoir</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{documentsLoading ? '...' : reviewCount}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chemins</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{documentsLoading ? '...' : distinctPathsCount}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agents</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{staffCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sous-services</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{subUnitCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Domaines actifs</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{domains.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activites actives</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{activities.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-black text-slate-800 tracking-tighter italic uppercase">Liste des documents</h3>
                  <p className="text-sm font-medium text-slate-500">
                    Filtrez les documents par criteres metier et verifiez leur chemin logique de classement.
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-80">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">search</span>
                    <input
                      aria-label="Recherche documentaire"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher (document, chemin...)"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                    />
                  </div>
                  <div className="shrink-0 rounded-full bg-blue-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-rdpc-blue">
                    {filteredDocuments.length} trouve{filteredDocuments.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                <select
                  aria-label="Filtre domaine"
                  value={domainFilter}
                  onChange={(e) => {
                    setDomainFilter(e.target.value);
                    setActivityFilter('');
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                >
                  <option value="">Tous les domaines</option>
                  {domains
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((domain) => (
                      <option key={domain.id} value={domain.id}>{domain.name}</option>
                    ))}
                </select>

                <select
                  aria-label="Filtre activite"
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                >
                  <option value="">Toutes les activites</option>
                  {availableActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>{activity.name}</option>
                  ))}
                </select>

                <select
                  aria-label="Filtre annee"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                >
                  <option value="">Toutes les annees</option>
                  {availableYears.map((year) => (
                    <option key={year} value={String(year)}>{year}</option>
                  ))}
                </select>

                <select
                  aria-label="Filtre statut de classement"
                  value={classificationStatusFilter}
                  onChange={(e) => setClassificationStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                >
                  <option value="">Tous les statuts de classement</option>
                  {Object.entries(CLASSIFICATION_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                <select
                  aria-label="Filtre statut GED"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                >
                  <option value="">Tous les statuts GED</option>
                  {availableWorkflowStatuses.map((status) => (
                    <option key={status} value={status}>{getStatusLabel(status)}</option>
                  ))}
                </select>

                <select
                  aria-label="Filtre categorie"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                >
                  <option value="">Toutes les categories</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>

                <select
                  aria-label="Filtre type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                >
                  <option value="">Tous les types</option>
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
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
                    {documents.length === 0 ? 'Aucun document dans cet espace.' : 'Aucun document ne correspond a vos criteres.'}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-400">
                    {documents.length === 0
                      ? 'Utilisez l import en masse ou l ajout de document pour alimenter cet espace.'
                      : 'Elargissez les filtres ou la recherche pour retrouver le document attendu.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[2rem] border border-slate-100">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <tr>
                        <th className="px-6 py-4">Document</th>
                        <th className="px-6 py-4">Classement</th>
                        <th className="px-6 py-4">Cible metier</th>
                        <th className="px-6 py-4">Taille</th>
                        <th className="px-6 py-4">Mise a jour</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredDocuments
                        .slice()
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                        .map((doc) => {
                          const targetUnitName = getTargetLabel(doc);
                          return (
                            <tr key={doc.id} className="align-top transition-colors hover:bg-slate-50">
                              <td className="px-6 py-5">
                                <div className="space-y-2">
                                  <p className="text-sm font-bold text-slate-800">{doc.title}</p>
                                  <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
                                    <span className="rounded-full bg-slate-100 px-3 py-1">{doc.category_name || 'Non classe'}</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1">{getFileTypeLabel(doc.mime_type || doc.file_type)}</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1">{getStatusLabel(doc.status)}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="space-y-2">
                                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide ${getClassificationStatusBadge(doc.classification_status)}`}>
                                    {getClassificationStatusLabel(doc.classification_status)}
                                  </span>
                                  <p className="text-sm font-semibold text-slate-700">
                                    {doc.logical_space_path || 'Chemin logique non encore determine'}
                                  </p>
                                  <p className="text-xs font-medium text-slate-500">
                                    {[doc.classification_domain_name, doc.classification_activity_name, doc.classification_year]
                                      .filter(Boolean)
                                      .join(' / ') || 'Classement metier incomplet'}
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-xs font-medium text-slate-600">
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-700">{targetUnitName}</p>
                                  <p>{SCOPE_LABELS[doc.classification_scope || 'service'] || doc.classification_scope || 'Service'}</p>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-xs font-medium text-slate-500">
                                {formatFileSize(doc.file_size)}
                              </td>
                              <td className="px-6 py-5 text-xs font-medium text-slate-500">
                                {formatDate(doc.updated_at)}
                              </td>
                              <td className="px-6 py-5 text-right align-middle">
                                {(!doc.classification_status || doc.classification_status === 'pending' || doc.classification_status === 'needs_review') && (
                                  <button
                                    onClick={() => setDocumentToClassify(doc)}
                                    className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-rdpc-blue hover:text-white"
                                  >
                                    Classer
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ClassificationSlideOver
        isOpen={!!documentToClassify}
        onClose={() => setDocumentToClassify(null)}
        document={documentToClassify}
        domains={domains}
        activities={activities}
        flatUnits={flatUnits}
        onSuccess={() => {
          setDocumentToClassify(null);
          loadDocuments();
        }}
      />
    </div>
  );
};

export default SpacesPage;
