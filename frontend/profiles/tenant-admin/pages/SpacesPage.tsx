import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type SpaceTreeNode } from '../../../services/api';
import type { Document } from '../../../types';
import { formatDate, formatFileSize, getFileTypeLabel, getStatusLabel } from '../../../types';
import { ClassificationSlideOver } from '../../../components/ClassificationSlideOver';
import { DocumentPreview } from '../../../components/preview';
import { Tooltip } from '../../../components/ui/Tooltip';

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

// Statut absorbé dans la couleur de l'icône (préattentif, WCAG 1.4.1 :
// le tooltip + label texte conservés ailleurs garantissent que la couleur
// n'est pas le seul canal porteur d'information).
const CLASSIFICATION_STATUS_ICON: Record<string, string> = {
  classified: 'text-emerald-600',
  needs_review: 'text-amber-600',
  pending: 'text-rdpc-blue',
  rejected: 'text-rose-600',
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

const buildBreadcrumbSegments = (
  unitId: string,
  unitsById: Map<string, FlatUnitNode>
): FlatUnitNode[] => {
  const path: FlatUnitNode[] = [];
  let current = unitsById.get(unitId) || null;

  while (current) {
    path.unshift(current);
    current = current.parent_id ? unitsById.get(current.parent_id) || null : null;
  }

  return path;
};

const getClassificationStatusLabel = (status?: string | null) =>
  CLASSIFICATION_STATUS_LABELS[status || 'pending'] || status || 'En attente de classement';

const getClassificationStatusBadge = (status?: string | null) =>
  CLASSIFICATION_STATUS_BADGES[status || 'pending'] || CLASSIFICATION_STATUS_BADGES.pending;

const getClassificationStatusIconColor = (status?: string | null) =>
  CLASSIFICATION_STATUS_ICON[status || 'pending'] || CLASSIFICATION_STATUS_ICON.pending;

const truncateLabel = (value: string, maxLength = 28) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const getDocumentFilename = (document: Document) => {
  const candidate = document.source_relative_path || document.file_path || document.title;
  const rawName = candidate.split('/').filter(Boolean).pop() || document.title;
  const hasExtension = /\.[a-z0-9]+$/i.test(rawName);
  if (hasExtension) return rawName;
  if (document.file_type) return `${rawName}.${document.file_type}`;
  return rawName;
};

type ViewMode = 'details' | 'icons';

type ContextMenuState =
  | {
      kind: 'document';
      x: number;
      y: number;
      document: Document;
    };

const SpacesPage: React.FC = () => {
  const navigate = useNavigate();
  const [treeData, setTreeData] = useState<SpaceTreeNode[]>([]);
  const [users, setUsers] = useState<UserNode[]>([]);
  const [domains, setDomains] = useState<ClassificationDomainOption[]>([]);
  const [activities, setActivities] = useState<ClassificationActivityOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recursive, setRecursive] = useState(false);
  // La recherche par texte est portée par l'URL (`?q=`) — la barre de
  // recherche globale (Header) écrit dedans.
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const setSearchQuery = (next: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next) nextParams.set('q', next);
    else nextParams.delete('q');
    setSearchParams(nextParams, { replace: true });
  };
  const [viewMode, setViewMode] = useState<ViewMode>('icons');
  const [documentToClassify, setDocumentToClassify] = useState<Document | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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

        const [usersResult, domainsResult, activitiesResult] = await Promise.allSettled([
          api.getUsers(),
          api.getClassificationDomains(),
          api.getClassificationActivities(),
        ]);

        if (usersResult.status === 'fulfilled') {
          setUsers(usersResult.value);
        } else {
          console.warn('Failed to load users for spaces view', usersResult.reason);
          setUsers([]);
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
  const unitsById = useMemo(
    () => new Map(flatUnits.map((unit) => [unit.id, unit])),
    [flatUnits]
  );
  const selectedUnit = useMemo(
    () => flatUnits.find((unit) => unit.id === selectedUnitId) || null,
    [flatUnits, selectedUnitId]
  );
  const parentUnit = useMemo(
    () => (selectedUnit?.parent_id ? unitsById.get(selectedUnit.parent_id) || null : null),
    [selectedUnit, unitsById]
  );
  const childUnits = selectedUnit?.children ?? [];
  const breadcrumbUnits = useMemo(
    () => (selectedUnitId ? buildBreadcrumbSegments(selectedUnitId, unitsById) : []),
    [selectedUnitId, unitsById]
  );

  const orgUnitNames = useMemo(
    () => new Map(flatUnits.map((unit) => [unit.id, unit.name])),
    [flatUnits]
  );

  const userNames = useMemo(
    () => new Map(users.map((user) => [user.id, user.full_name || user.id])),
    [users]
  );

    const loadDocuments = async () => {
      if (!selectedUnitId) {
        setDocuments([]);
        return;
      }

      try {
        setDocumentsLoading(true);
        setError(null);
        // Une recherche active impose le mode récursif : par définition,
        // l'utilisateur veut chercher partout dans la branche, pas seulement
        // dans le service courant.
        const effective = recursive || Boolean(searchQuery.trim());
        const docs = await api.getSpaceDocuments(selectedUnitId, effective);
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
    // searchQuery participe à la dep : on recharge si l'utilisateur active
    // ou désactive une recherche, pour bénéficier du mode récursif forcé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitId, recursive, Boolean(searchQuery.trim())]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

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
      const targetUnitName = getTargetLabel(doc);
      const searchCorpus = [
        doc.title,
        doc.category_name || 'Non classe',
        getFileTypeLabel(doc.mime_type || doc.file_type),
        doc.logical_space_path || '',
        doc.classification_domain_name || '',
        doc.classification_activity_name || '',
        targetUnitName,
      ]
        .join(' ')
        .toLowerCase();

      return !normalizedQuery || searchCorpus.includes(normalizedQuery);
    });
  }, [documents, orgUnitNames, searchQuery, userNames]);

  const isSearchMode = Boolean(searchQuery.trim());

  const visibleDocuments = useMemo(() => {
    // En mode recherche : on lève la contrainte de portée (le tenant entier
    // visible) — l'utilisateur veut voir tous les matches, pas seulement
    // ceux strictement rattachés au service courant.
    if (isSearchMode) return filteredDocuments;
    if (!selectedUnitId) {
      return filteredDocuments;
    }

    if (childUnits.length === 0) {
      return filteredDocuments;
    }

    return filteredDocuments.filter((doc) => {
      const targetOrgUnitId = doc.classification_target_org_unit_id || doc.org_unit_id;
      return targetOrgUnitId === selectedUnitId;
    });
  }, [childUnits.length, filteredDocuments, isSearchMode, selectedUnitId]);

  const hiddenDescendantDocumentsCount = Math.max(
    filteredDocuments.length - visibleDocuments.length,
    0
  );

  const reviewCount = useMemo(
    () =>
      visibleDocuments.filter(
        (doc) =>
          doc.classification_status === 'needs_review' ||
          doc.classification_status === 'pending'
      ).length,
    [visibleDocuments]
  );

  const openFolder = (unitId: string) => {
    setSelectedUnitId(unitId);
    setContextMenu(null);
  };

  const openPreview = (document: Document) => {
    setPreviewDocument(document);
    setContextMenu(null);
  };

  const openClassification = (document: Document) => {
    setDocumentToClassify(document);
    setContextMenu(null);
  };

  const handleDocumentContextMenu = (
    event: React.MouseEvent,
    document: Document
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      kind: 'document',
      x: event.clientX,
      y: event.clientY,
      document,
    });
  };

  const handleCopyPath = async (path: string) => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      /* no-op */
    } finally {
      setContextMenu(null);
    }
  };

  return (
    <div className="p-8 animate-in fade-in duration-500">
      {loading ? (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center text-sm font-medium text-slate-500">
          Chargement des espaces...
        </div>
      ) : error && !selectedUnitId ? (
        <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : (
        <div className="mx-auto max-w-[1280px] space-y-5">
          <div className="flex flex-wrap items-center gap-3 px-2 text-sm font-semibold text-slate-400">
            {breadcrumbUnits.length > 0 ? (
              breadcrumbUnits.map((unit, index) => (
                <React.Fragment key={unit.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`transition-colors ${
                      index === breadcrumbUnits.length - 1
                        ? 'text-rdpc-blue'
                        : 'hover:text-slate-600'
                    }`}
                  >
                    {unit.name}
                  </button>
                  {index < breadcrumbUnits.length - 1 && <span>/</span>}
                </React.Fragment>
              ))
            ) : (
              <span>Aucun service sélectionné</span>
            )}
          </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-col gap-6 border-b border-slate-100 px-8 py-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-6">
                {parentUnit && (
                  <button
                    type="button"
                    onClick={() => openFolder(parentUnit.id)}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
                    aria-label={`Retour vers ${parentUnit.name}`}
                  >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                  </button>
                )}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-rdpc-blue shadow-sm">
                  <span className="material-symbols-outlined text-4xl">description</span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-4">
                    <h2 className="text-4xl font-black tracking-tight text-slate-900">
                      {selectedUnit?.name || 'Aucun service'}
                    </h2>
                    {selectedUnit?.code && (
                      <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-rdpc-blue">
                        {selectedUnit.code}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
                <span>{visibleDocuments.length} document{visibleDocuments.length > 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{reviewCount} à revoir</span>
                <button
                  type="button"
                  onClick={() => loadDocuments()}
                  className="ml-2 inline-flex items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/ingestion')}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-emerald-700"
                >
                  Importer
                </button>
              </div>
            </div>

            <div className="border-b border-slate-100 px-8 py-7">
              <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px] xl:items-center">
                <label className="inline-flex items-center gap-3 text-base font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(e) => setRecursive(e.target.checked)}
                    className="h-6 w-6 rounded-lg border-slate-300 text-rdpc-blue focus:ring-rdpc-blue"
                  />
                  Inclure les sous-services
                </label>

                {searchQuery && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-[1.4rem] border border-blue-100 bg-blue-50/50">
                    <p className="text-xs text-slate-600 italic truncate">
                      <span className="material-symbols-outlined text-base align-middle text-rdpc-blue mr-1">search</span>
                      Recherche : <span className="font-bold not-italic text-slate-800">« {searchQuery} »</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rdpc-blue shrink-0"
                    >
                      Effacer
                    </button>
                  </div>
                )}

                <div className="flex justify-start xl:justify-end">
                  <div className="inline-flex rounded-[1.35rem] border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('details')}
                      className={`inline-flex items-center gap-3 rounded-[1rem] px-6 py-4 text-sm font-black tracking-[0.16em] transition-colors ${
                        viewMode === 'details'
                          ? 'bg-slate-50 text-slate-800'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">table_rows</span>
                      Détails
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('icons')}
                      className={`inline-flex items-center gap-3 rounded-[1rem] px-6 py-4 text-sm font-black tracking-[0.16em] transition-colors ${
                        viewMode === 'icons'
                          ? 'bg-slate-50 text-rdpc-blue'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">grid_view</span>
                      Icônes
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-[560px] px-8 py-8">
              {childUnits.length > 0 && !isSearchMode && (
                <div className="mb-8 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Sous-services
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {childUnits.map((child) => {
                      const isTruncated = child.name.length > 34;
                      return (
                        <Tooltip
                          key={child.id}
                          content={isTruncated ? child.name : undefined}
                          align="left"
                          className="block"
                        >
                          <button
                            type="button"
                            onClick={() => openFolder(child.id)}
                            onDoubleClick={() => openFolder(child.id)}
                            className="group w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-rdpc-blue hover:bg-blue-50"
                          >
                            <div className="flex items-start gap-4">
                              <span className="material-symbols-outlined text-4xl text-amber-500">folder</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-lg font-bold text-slate-800">
                                  {truncateLabel(child.name, 34)}
                                </p>
                                <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                                  {child.code}
                                </p>
                              </div>
                            </div>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              )}

              {childUnits.length > 0 && hiddenDescendantDocumentsCount > 0 && !isSearchMode && (
                <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-slate-600">
                  {hiddenDescendantDocumentsCount} document{hiddenDescendantDocumentsCount > 1 ? 's' : ''} disponible{hiddenDescendantDocumentsCount > 1 ? 's' : ''} dans les sous-services.
                </div>
              )}

              {error && selectedUnitId && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
                  {error}
                </div>
              )}

              {!error && documentsLoading && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-10 text-center text-sm font-medium text-slate-500">
                  Chargement des documents...
                </div>
              )}

              {!error && !documentsLoading && visibleDocuments.length > 0 && viewMode === 'icons' && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleDocuments
                    .slice()
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                    .map((doc) => {
                      const isTitleTruncated = doc.title.length > 26;
                      // Chemin du service de rattachement du doc — affiché en
                      // mode recherche pour donner le contexte de l'origine.
                      const docUnitId = doc.classification_target_org_unit_id || doc.org_unit_id;
                      const docPath = docUnitId
                        ? buildBreadcrumbSegments(docUnitId, unitsById).map((s) => s.name).join(' / ')
                        : '';
                      // Tooltip = nom complet + statut humain (couleur seule
                      // n'est pas porteuse d'info — WCAG 1.4.1) + chemin.
                      const tooltipContent = (
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800">{doc.title}</p>
                          <p className="text-[11px] uppercase tracking-widest text-slate-400">
                            {getClassificationStatusLabel(doc.classification_status)}
                          </p>
                          {docPath && (
                            <p className="text-[11px] text-slate-500 italic">{docPath}</p>
                          )}
                        </div>
                      );
                      return (
                        <Tooltip
                          key={doc.id}
                          content={tooltipContent}
                          align="left"
                          className="block"
                        >
                          <button
                            type="button"
                            onClick={() => openPreview(doc)}
                            onContextMenu={(event) => handleDocumentContextMenu(event, doc)}
                            aria-label={`${doc.title} — ${getClassificationStatusLabel(doc.classification_status)}`}
                            className="group w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-rdpc-blue"
                          >
                            <div className="flex items-start gap-4">
                              <span
                                className={`material-symbols-outlined text-4xl shrink-0 ${getClassificationStatusIconColor(doc.classification_status)}`}
                              >
                                description
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-base font-bold leading-tight text-slate-800 truncate">
                                  {isTitleTruncated ? truncateLabel(doc.title, 26) : doc.title}
                                </p>
                                <p className="mt-1 text-xs font-medium text-slate-400">
                                  {getFileTypeLabel(doc.mime_type || doc.file_type)}
                                  {' · '}
                                  {formatFileSize(doc.file_size)}
                                  {' · '}
                                  {formatDate(doc.updated_at)}
                                </p>
                                {isSearchMode && docPath && (
                                  <p className="mt-1.5 text-[10px] font-medium text-rdpc-blue/80 truncate flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">folder_open</span>
                                    {docPath}
                                  </p>
                                )}
                              </div>
                              <span className="material-symbols-outlined text-lg text-slate-300 group-hover:text-slate-500 transition-colors">
                                more_vert
                              </span>
                            </div>
                          </button>
                        </Tooltip>
                      );
                    })}
                </div>
              )}

              {!error && !documentsLoading && visibleDocuments.length > 0 && viewMode === 'details' && (
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
                      {visibleDocuments
                        .slice()
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                        .map((doc) => {
                          const targetUnitName = getTargetLabel(doc);
                          return (
                            <tr
                              key={doc.id}
                              onDoubleClick={() => openPreview(doc)}
                              onContextMenu={(event) => handleDocumentContextMenu(event, doc)}
                              className="align-top transition-colors hover:bg-slate-50"
                            >
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
                                    type="button"
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

      {contextMenu && (
        <div
          className="fixed z-50 min-w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <>
              <button
                type="button"
                onClick={() => openPreview(contextMenu.document)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-base text-slate-400">preview</span>
                Ouvrir
              </button>
              {(!contextMenu.document.classification_status
                || contextMenu.document.classification_status === 'pending'
                || contextMenu.document.classification_status === 'needs_review') && (
                <button
                  type="button"
                  onClick={() => openClassification(contextMenu.document)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-base text-slate-400">rule</span>
                  Classer
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopyPath(contextMenu.document.logical_space_path || '')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-base text-slate-400">content_copy</span>
                Copier le chemin logique
              </button>
          </>
        </div>
      )}

      {previewDocument && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/45 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setPreviewDocument(null)} />

          <div className="relative flex h-full w-full max-w-[95vw] animate-in slide-in-from-right duration-300 flex-col bg-white shadow-2xl lg:max-w-[88vw] lg:flex-row">
            <div className="flex min-h-0 flex-1 flex-col border-b border-slate-200 bg-slate-100 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Aperçu du document
                  </p>
                  <h3 className="truncate text-lg font-black text-slate-900">
                    {previewDocument.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDocument(null)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
                <DocumentPreview
                  documentId={previewDocument.id}
                  filename={getDocumentFilename(previewDocument)}
                  mimeType={previewDocument.mime_type}
                  className="h-full w-full"
                />
              </div>
            </div>

            <aside className="flex w-full flex-col bg-white lg:w-[340px]">
              <div className="border-b border-slate-100 px-6 py-5">
                <h4 className="text-lg font-black tracking-tight text-slate-900">Détails du document</h4>
                <p className="text-xs font-medium text-slate-500">Consultation rapide et actions disponibles</p>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Type</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {getFileTypeLabel(previewDocument.mime_type || previewDocument.file_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Taille</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatFileSize(previewDocument.file_size)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mise à jour</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatDate(previewDocument.updated_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Classement</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {previewDocument.logical_space_path || 'Chemin logique non encore determine'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 px-6 py-4">
                <div className="flex flex-wrap gap-3">
                  {(!previewDocument.classification_status
                    || previewDocument.classification_status === 'pending'
                    || previewDocument.classification_status === 'needs_review') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewDocument(null);
                        openClassification(previewDocument);
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-rdpc-blue px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-blue-700"
                    >
                      Classer ce document
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyPath(previewDocument.logical_space_path || '')}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 transition-colors hover:bg-slate-200"
                  >
                    Copier le chemin
                  </button>
                </div>
              </div>
            </aside>
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
