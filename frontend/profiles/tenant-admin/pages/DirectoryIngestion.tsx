import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../services/api';
import { categoriesApi, DocumentCategory } from '../../../services/categories.api';
import { useAuthStore } from '../../../stores/authStore';
import {
  formatFileSize,
  ImportCommitResponse,
  ImportJobItem,
  ImportJobItemStatus,
  ImportJobWithItems,
  ImportProcessingMode,
  ImportSourceScope,
} from '../../../types';
import { errorMessage } from '../../../utils/errors';

interface OrgUnitOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  full_name: string;
  role_label?: string;
  org_unit_id?: string | null;
  is_active?: boolean;
}

interface WorkflowTemplateOption {
  id: string;
  name: string;
}

interface BatchProgress {
  stage: 'analyze' | 'commit';
  label: string;
  detail: string;
}

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.txt', '.csv', '.rtf',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.webp',
]);

const SOURCE_SCOPE_OPTIONS: Array<{ value: ImportSourceScope; label: string; helper: string }> = [
  {
    value: 'person',
    label: 'Personne',
    helper: 'Le lot est rattache a un agent precis et utilise son perimetre personnel.',
  },
  {
    value: 'service',
    label: 'Service',
    helper: 'Le lot est classe au niveau du service cible et reste partage dans ce perimetre.',
  },
  {
    value: 'subdirectorate',
    label: 'Sous-direction',
    helper: 'Le lot est prepare pour un perimetre organisationnel plus large que le service.',
  },
];

const PROCESSING_MODE_OPTIONS: Array<{ value: ImportProcessingMode; label: string; icon: string; helper: string }> = [
  {
    value: 'archive',
    label: 'Juste les ranger',
    icon: 'folder',
    helper: 'Classement seul. Aucun circuit declenche. Recommande pour la migration initiale.',
  },
  {
    value: 'process',
    label: 'Les ranger et lancer le traitement',
    icon: 'settings',
    helper: 'Declenche le workflow quand le document est suffisamment classifie.',
  },
];

const PREVIEW_STATUS_META: Record<
  ImportJobItemStatus,
  { label: string; className: string; icon: string; helper?: string }
> = {
  classified: {
    label: 'Pret',
    className: 'bg-green-100 text-green-700 border-green-200',
    icon: 'task_alt',
    helper: 'Le document peut etre importe sans revue supplementaire.',
  },
  pending: {
    label: 'A completer',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'hourglass_top',
    helper: 'Aucune regle claire n a ete trouvee. Revue manuelle requise plus tard.',
  },
  needs_review: {
    label: 'Revue requise',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'rule',
    helper: 'Le moteur a detecte une ambiguite ou un target invalide.',
  },
  duplicate: {
    label: 'Doublon',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: 'content_copy',
    helper: 'Le contenu existe deja dans le tenant ou dans ce meme batch.',
  },
  ignored: {
    label: 'Ignore',
    className: 'bg-slate-100 text-slate-500 border-slate-200',
    icon: 'block',
    helper: 'Format non supporte par le flux d import.',
  },
  imported: {
    label: 'Importe',
    className: 'bg-green-100 text-green-700 border-green-200',
    icon: 'check_circle',
  },
  failed: {
    label: 'Erreur',
    className: 'bg-red-100 text-red-700 border-red-200',
    icon: 'error',
    helper: 'Le serveur n a pas pu traiter cet element.',
  },
};

const getFileExtension = (filename: string) => {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : '';
};

const isSupportedFile = (file: File) => SUPPORTED_EXTENSIONS.has(getFileExtension(file.name));

const formatDetectedType = (item: ImportJobItem) => {
  const extension = getFileExtension(item.original_filename).replace('.', '').toUpperCase();
  if (extension) return extension;
  if (item.mime_type) return item.mime_type;
  return 'FICHIER';
};

const DirectoryIngestion: React.FC = () => {
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const userProfile = useAuthStore((state) => state.userProfile);

  const [recursive, setRecursive] = useState(true);
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [targetOrgUnitId, setTargetOrgUnitId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [forcedYearInput, setForcedYearInput] = useState('');
  const [sourceScope, setSourceScope] = useState<ImportSourceScope>('service');
  const [processingMode, setProcessingMode] = useState<ImportProcessingMode>('archive');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectionLabel, setSelectionLabel] = useState('');
  const [unsupportedCount, setUnsupportedCount] = useState(0);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateOption[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [analyzedJob, setAnalyzedJob] = useState<ImportJobWithItems | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [categoryData, orgUnitData, userData, templateData] = await Promise.all([
          categoriesApi.list(false),
          api.getOrgUnits(),
          api.getUsers(),
          api.getTemplates().catch(() => []),
        ]);
        setCategories(categoryData || []);
        setOrgUnits((orgUnitData || []).map((orgUnit: any) => ({ id: orgUnit.id, name: orgUnit.name })));
        setUsers((userData || []).filter((user: any) => user?.is_active !== false));
        setWorkflowTemplates((templateData || []).map((tpl: any) => ({ id: tpl.id, name: tpl.name })));
      } catch (loadError) {
        console.error(loadError);
        setError('Impossible de charger les donnees de reference de l import.');
      }
    };

    loadReferenceData();
  }, []);

  useEffect(() => {
    const directoryInput = directoryInputRef.current;
    if (directoryInput) {
      directoryInput.setAttribute('webkitdirectory', '');
      directoryInput.setAttribute('directory', '');
      directoryInput.multiple = true;
    }
  }, []);

  const clearBatchState = () => {
    setAnalyzedJob(null);
    setCommitResult(null);
    setProgress(null);
    setError(null);
  };

  const totalSelectedSize = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + file.size, 0),
    [selectedFiles],
  );

  const defaultCategory = useMemo(
    () => categories.find((category) => category.id === defaultCategoryId) || null,
    [categories, defaultCategoryId],
  );

  const templatesById = useMemo(
    () => new Map(workflowTemplates.map((template) => [template.id, template.name])),
    [workflowTemplates],
  );

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const orgUnitsById = useMemo(
    () => new Map(orgUnits.map((orgUnit) => [orgUnit.id, orgUnit.name])),
    [orgUnits],
  );

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user.full_name || user.id])),
    [users],
  );

  const selectedUser = useMemo(
    () => users.find((user) => user.id === targetUserId) || null,
    [targetUserId, users],
  );

  const ownerOptions = useMemo(() => {
    if (!targetOrgUnitId) {
      return users;
    }
    const scopedUsers = users.filter((user) => user.org_unit_id === targetOrgUnitId);
    return scopedUsers.length > 0 ? scopedUsers : users;
  }, [targetOrgUnitId, users]);

  useEffect(() => {
    if (targetUserId && !ownerOptions.some((user) => user.id === targetUserId)) {
      setTargetUserId('');
    }
  }, [ownerOptions, targetUserId]);

  const resolvedTargetOrgUnitId = useMemo(() => {
    if (sourceScope === 'person') {
      return selectedUser?.org_unit_id || targetOrgUnitId || userProfile?.orgUnitId || '';
    }
    return targetOrgUnitId || userProfile?.orgUnitId || '';
  }, [selectedUser?.org_unit_id, sourceScope, targetOrgUnitId, userProfile?.orgUnitId]);

  const forcedYear = useMemo(() => {
    if (!forcedYearInput.trim()) return undefined;
    const value = Number(forcedYearInput);
    return Number.isInteger(value) ? value : NaN;
  }, [forcedYearInput]);

  const previewJob = commitResult?.job || analyzedJob;

  const previewCounts = useMemo(() => {
    const items = previewJob?.items || [];
    return {
      classified: items.filter((item) => item.status === 'classified').length,
      imported: items.filter((item) => item.status === 'imported').length,
      pending: items.filter((item) => item.status === 'pending').length,
      needsReview: items.filter((item) => item.status === 'needs_review').length,
      duplicate: items.filter((item) => item.status === 'duplicate').length,
      ignored: items.filter((item) => item.status === 'ignored').length,
      failed: items.filter((item) => item.status === 'failed').length,
    };
  }, [previewJob]);

  const importableCount = previewCounts.classified;
  const busy = isAnalyzing || isCommitting;
  const requiresTargetOrgUnit = sourceScope !== 'person' && !userProfile?.orgUnitId;

  const getItemCategoryName = (item: ImportJobItem) => {
    if (item.detected_document_category_id) {
      return categoriesById.get(item.detected_document_category_id) || 'Categorie selectionnee';
    }
    return 'Aucune categorie';
  };

  const getItemWorkflowLabel = (item: ImportJobItem) => {
    if (!item.workflow_template_id) {
      return 'Aucun workflow';
    }
    return templatesById.get(item.workflow_template_id) || 'Workflow associe';
  };

  const getItemTargetLabel = (item: ImportJobItem) => {
    if (item.logical_space_path) return item.logical_space_path;
    if (item.resolved_target_user_id) {
      return usersById.get(item.resolved_target_user_id) || 'Utilisateur cible';
    }
    if (item.resolved_target_org_unit_id) {
      return orgUnitsById.get(item.resolved_target_org_unit_id) || 'Service cible';
    }
    return 'Aucune destination determinee';
  };

  const resetSelection = () => {
    setSelectedFiles([]);
    setSelectionLabel('');
    setUnsupportedCount(0);
    clearBatchState();
    if (directoryInputRef.current) directoryInputRef.current.value = '';
    if (filesInputRef.current) filesInputRef.current.value = '';
  };

  const handlePickedFiles = (files: FileList | null, source: 'directory' | 'files') => {
    if (!files || files.length === 0) {
      return;
    }

    const allFiles = Array.from(files);
    const supportedCount = allFiles.filter(isSupportedFile).length;
    const ignoredFiles = allFiles.length - supportedCount;

    setSelectedFiles(allFiles);
    setUnsupportedCount(ignoredFiles);
    clearBatchState();
    setError(null);

    if (source === 'directory' && allFiles.length > 0) {
      const firstRelativePath = allFiles[0]?.webkitRelativePath || '';
      const rootName = firstRelativePath.split('/').filter(Boolean)[0] || 'Dossier selectionne';
      setSelectionLabel(rootName);
      return;
    }

    setSelectionLabel(
      source === 'directory'
        ? 'Dossier selectionne'
        : `${allFiles.length} fichier(s) selectionne(s)`,
    );
  };

  const validateBeforeAnalyze = () => {
    if (selectedFiles.length === 0) {
      return 'Selectionnez d abord un dossier ou des fichiers a analyser.';
    }
    if (sourceScope === 'person' && !targetUserId) {
      return 'Choisissez l utilisateur cible pour un import personnel.';
    }
    if (requiresTargetOrgUnit && !resolvedTargetOrgUnitId) {
      return 'Choisissez le service cible auquel rattacher ce batch.';
    }
    if (forcedYearInput.trim() && !Number.isInteger(forcedYear)) {
      return 'L annee imposee doit etre un nombre entier a 4 chiffres.';
    }
    return null;
  };

  const handleAnalyze = async () => {
    const validationError = validateBeforeAnalyze();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setCommitResult(null);
    setProgress({
      stage: 'analyze',
      label: 'Analyse du lot',
      detail: `${selectedFiles.length} fichier(s) envoyes au moteur de previsualisation.`,
    });

    try {
      const job = await api.analyzeImportJob({
        files: selectedFiles,
        sourceScope,
        processingMode,
        targetOrgUnitId: sourceScope === 'person' ? undefined : resolvedTargetOrgUnitId || undefined,
        targetUserId: sourceScope === 'person' ? targetUserId : undefined,
        defaultDocumentCategoryId: defaultCategoryId || undefined,
        forcedYear: typeof forcedYear === 'number' && Number.isFinite(forcedYear) ? forcedYear : undefined,
        sourceRelativePaths: selectedFiles.map((file) => file.webkitRelativePath || file.name),
      });
      setAnalyzedJob(job);
      setProgress(null);
    } catch (analyzeError) {
      setError(errorMessage(analyzeError, 'Analyse du batch impossible.'));
      setProgress(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!analyzedJob) {
      setError('Analysez d abord le lot avant de lancer l import.');
      return;
    }
    if (importableCount === 0) {
      setError('Aucun fichier n est importable dans ce batch. Corrigez le contexte ou ajustez les regles.');
      return;
    }

    setIsCommitting(true);
    setError(null);
    setProgress({
      stage: 'commit',
      label: 'Execution du batch',
      detail: `${importableCount} fichier(s) classifie(s) vont etre importes sur le serveur central.`,
    });

    try {
      const result = await api.commitImportJob(analyzedJob.id);
      setCommitResult(result);
      setAnalyzedJob(result.job);
      setProgress(null);
    } catch (commitError) {
      setError(errorMessage(commitError, 'Execution du batch impossible.'));
      setProgress(null);
    } finally {
      setIsCommitting(false);
    }
  };

  const statusCardValue = commitResult ? commitResult.imported_documents : previewCounts.classified;

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-32">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-green/10 text-cam-green rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-green/20">
          Sprint 4
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">
          Import <span className="text-cam-green">Batch Pilote</span>
        </h2>
        <p className="text-slate-500 mt-2 font-medium italic text-lg max-w-4xl">
          Analysez un lot complet avant execution, visualisez les destinations estimees, puis importez seulement les fichiers classifies.
        </p>
      </div>

      <div className="glass p-10 rounded-[3rem] bg-white/60 border-white space-y-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 bg-cam-green text-white rounded-xl flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-xl">folder_open</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">
            Bloc 1. Selection locale
          </h3>
        </div>

        <input
          ref={directoryInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handlePickedFiles(e.target.files, 'directory')}
        />
        <input
          ref={filesInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handlePickedFiles(e.target.files, 'files')}
        />

        <div className="rounded-[2rem] border-2 border-slate-100 bg-slate-50 p-5">
          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="button"
              onClick={() => directoryInputRef.current?.click()}
              disabled={busy}
              className="flex-1 rounded-2xl bg-cam-green text-white px-5 py-4 font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              Choisir un dossier
            </button>
            <button
              type="button"
              onClick={() => filesInputRef.current?.click()}
              disabled={busy}
              className="flex-1 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 px-5 py-4 font-black uppercase tracking-widest text-xs hover:border-slate-300 transition-colors disabled:opacity-60"
            >
              Choisir des fichiers
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">
                {selectionLabel || 'Aucune selection pour le moment'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} fichier(s) selectionne(s) - ${formatFileSize(totalSelectedSize)}`
                  : 'Formats supportes : PDF, Office, texte et images usuelles'}
              </p>
            </div>
            {(selectedFiles.length > 0 || unsupportedCount > 0) && (
              <button
                type="button"
                onClick={resetSelection}
                disabled={busy}
                className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 disabled:opacity-60"
              >
                Reinitialiser
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
            Option de parcours
          </label>
          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
              className="w-5 h-5 accent-cam-green rounded"
            />
            <div>
              <p className="text-sm font-bold text-slate-700">Conserver la lecture recursive du dossier</p>
              <p className="text-[10px] text-slate-400 font-medium">
                Option informative pour l utilisateur. La previsualisation reprend les chemins relatifs renvoyes par le navigateur.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="glass p-10 rounded-[3rem] bg-white/60 border-white space-y-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-xl">tune</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">
            Bloc 2. Contexte d'import
          </h3>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-3 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Portee du batch
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SOURCE_SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSourceScope(option.value);
                    clearBatchState();
                  }}
                  disabled={busy}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${sourceScope === option.value ? 'border-cam-green bg-green-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <p className="font-black text-slate-800 text-sm">{option.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{option.helper}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Service cible
            </label>
            <select
              value={targetOrgUnitId}
              onChange={(e) => {
                setTargetOrgUnitId(e.target.value);
                clearBatchState();
              }}
              disabled={busy || sourceScope === 'person'}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none disabled:opacity-60"
            >
              <option value="">
                {sourceScope === 'person'
                  ? '-- Derive de l utilisateur cible --'
                  : requiresTargetOrgUnit
                    ? '-- Choisir un service --'
                    : '-- Service de votre profil --'}
              </option>
              {orgUnits.map((orgUnit) => (
                <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 italic ml-1">
              {sourceScope === 'person'
                ? 'Le service sera derive de l utilisateur cible si vous choisissez une portee personnelle.'
                : requiresTargetOrgUnit
                  ? 'Votre profil n est pas rattache a un service. Ce choix est obligatoire.'
                  : 'Laissez vide pour utiliser automatiquement le service de votre profil.'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Utilisateur cible
            </label>
            <select
              value={targetUserId}
              onChange={(e) => {
                setTargetUserId(e.target.value);
                clearBatchState();
              }}
              disabled={busy || sourceScope !== 'person'}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none disabled:opacity-60"
            >
              <option value="">-- Choisir un utilisateur --</option>
              {ownerOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} {user.role_label ? `- ${user.role_label}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 italic ml-1">
              Requis uniquement pour les imports personnels. Le backend empeche qu un non-admin cible un autre utilisateur.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Annee imposee
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={2000}
              max={2100}
              placeholder="Ex. 2026"
              value={forcedYearInput}
              onChange={(e) => {
                setForcedYearInput(e.target.value);
                clearBatchState();
              }}
              disabled={busy}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50"
            />
            <p className="text-[11px] text-slate-400 italic ml-1">
              Laissez vide pour utiliser l annee issue du moteur de classement ou du contexte courant.
            </p>
          </div>

          <div className="space-y-2 xl:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Categorie par defaut
            </label>
            <select
              value={defaultCategoryId}
              onChange={(e) => {
                setDefaultCategoryId(e.target.value);
                clearBatchState();
              }}
              disabled={busy}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none"
            >
              <option value="">-- Aucune categorie imposee --</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 italic ml-1">
              {defaultCategory
                ? `Tous les fichiers seront analyses sous la categorie \"${defaultCategory.name}\".`
                : 'Laissez vide seulement si vous acceptez une previsualisation sans categorie documentaire imposee.'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
            Mode de traitement
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PROCESSING_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setProcessingMode(option.value);
                  clearBatchState();
                }}
                disabled={busy}
                className={`text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-3 ${processingMode === option.value ? 'border-cam-green bg-green-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${processingMode === option.value ? 'border-cam-green' : 'border-slate-300'}`}>
                  {processingMode === option.value && <div className="w-2.5 h-2.5 rounded-full bg-cam-green" />}
                </div>
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">{option.icon}</span>
                    {option.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{option.helper}</p>
                </div>
              </button>
            ))}
          </div>
          {processingMode === 'process' && !defaultCategoryId && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
              <span className="material-symbols-outlined text-blue-600 text-base shrink-0 mt-0.5">info</span>
              <p>Sans categorie documentaire explicite, certaines regles de classement ou de workflow risquent de ne pas se declencher.</p>
            </div>
          )}
          {unsupportedCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <span className="material-symbols-outlined text-slate-500 text-base shrink-0 mt-0.5">filter_alt_off</span>
              <p>{unsupportedCount} fichier(s) non supporte(s) seront analyses puis signales comme ignores dans la preview.</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
          <span className="material-symbols-outlined text-red-500">error</span>
          <p className="text-sm font-bold text-red-600">{error}</p>
        </div>
      )}

      {progress && (
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 px-6 py-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cam-green text-white flex items-center justify-center shrink-0 shadow-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{progress.stage === 'analyze' ? 'Bloc 3. Analyse' : 'Bloc 4. Execution'}</p>
            <p className="text-lg font-black text-slate-800 italic mt-1">{progress.label}</p>
            <p className="text-sm text-slate-500 mt-1">{progress.detail}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
        <div className="glass p-10 rounded-[3rem] bg-white/60 border-white space-y-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-xl">preview</span>
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">
              Bloc 3. Analyse
            </h3>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">Le lot est analyse sans creer de documents finaux.</p>
              <p className="text-xs text-slate-400 mt-1">La previsualisation montre les fichiers prets, ambigus, ignores ou deja presents.</p>
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={busy || selectedFiles.length === 0}
              className="rounded-2xl bg-slate-900 text-white px-6 py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors disabled:opacity-60"
            >
              {isAnalyzing ? 'Analyse en cours...' : 'Analyser le lot'}
            </button>
          </div>

          {previewJob ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Fichiers" value={previewJob.total_files} icon="inventory_2" color="bg-slate-800" />
                <SummaryCard label={commitResult ? 'Importes' : 'Prets'} value={statusCardValue} icon={commitResult ? 'check_circle' : 'task_alt'} color="bg-cam-green" />
                <SummaryCard label="Revue" value={previewCounts.needsReview + previewCounts.pending} icon="rule" color="bg-amber-500" />
                <SummaryCard label="Doublons / ignores" value={previewCounts.duplicate + previewCounts.ignored} icon="filter_alt_off" color="bg-blue-500" />
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-[0.2em]">
                      <tr>
                        <th className="px-5 py-4 text-left">Fichier</th>
                        <th className="px-5 py-4 text-left">Type</th>
                        <th className="px-5 py-4 text-left">Categorie retenue</th>
                        <th className="px-5 py-4 text-left">Destination estimee</th>
                        <th className="px-5 py-4 text-left">Workflow estime</th>
                        <th className="px-5 py-4 text-left">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewJob.items.map((item) => {
                        const statusMeta = PREVIEW_STATUS_META[item.status];
                        return (
                          <tr key={item.id} className="border-t border-slate-100 align-top">
                            <td className="px-5 py-4 min-w-[260px]">
                              <p className="font-bold text-slate-800 break-all">{item.source_relative_path || item.original_filename}</p>
                              <p className="text-xs text-slate-400 mt-1">{formatFileSize(item.file_size)}{item.resolved_year ? ` • ${item.resolved_year}` : ''}</p>
                            </td>
                            <td className="px-5 py-4 text-slate-600 font-bold whitespace-nowrap">{formatDetectedType(item)}</td>
                            <td className="px-5 py-4 text-slate-600">{getItemCategoryName(item)}</td>
                            <td className="px-5 py-4 min-w-[260px]">
                              <p className="text-slate-700 font-medium break-words">{getItemTargetLabel(item)}</p>
                              {item.error_message && (
                                <p className="text-xs text-slate-400 mt-1">{item.error_message}</p>
                              )}
                            </td>
                            <td className="px-5 py-4 text-slate-600">{getItemWorkflowLabel(item)}</td>
                            <td className="px-5 py-4">
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-widest ${statusMeta.className}`}>
                                <span className="material-symbols-outlined text-sm">{statusMeta.icon}</span>
                                {statusMeta.label}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-300">psychology</span>
              <p className="text-sm font-bold text-slate-600 mt-3">Aucune analyse lancee pour le moment.</p>
              <p className="text-xs text-slate-400 mt-1">Selectionnez un lot, renseignez le contexte, puis lancez l analyse.</p>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="glass p-8 rounded-[3rem] bg-white/60 border-white space-y-6 sticky top-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-xl">play_arrow</span>
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">
                Bloc 4. Execution
              </h3>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="material-symbols-outlined text-slate-500 mt-0.5">account_tree</span>
                <div>
                  <p className="font-bold text-slate-700">Portee retenue</p>
                  <p>{SOURCE_SCOPE_OPTIONS.find((option) => option.value === sourceScope)?.label || sourceScope}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="material-symbols-outlined text-slate-500 mt-0.5">domain</span>
                <div>
                  <p className="font-bold text-slate-700">Cible effective</p>
                  <p>
                    {sourceScope === 'person'
                      ? (selectedUser?.full_name || 'Utilisateur cible requis')
                      : (orgUnitsById.get(resolvedTargetOrgUnitId) || 'Service du profil')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="material-symbols-outlined text-slate-500 mt-0.5">calendar_today</span>
                <div>
                  <p className="font-bold text-slate-700">Annee imposee</p>
                  <p>{forcedYearInput.trim() ? forcedYearInput : 'Aucune annee forcee'}</p>
                </div>
              </div>
            </div>

            {previewJob && (
              <div className="rounded-[2rem] bg-slate-900 text-white p-5 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Batch pret</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/60">Items analysables</p>
                    <p className="text-2xl font-black italic">{previewJob.supported_files}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Items importables</p>
                    <p className="text-2xl font-black italic">{importableCount}</p>
                  </div>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Les items en revue, en attente ou en doublon restent traces dans le job mais ne sont pas importes automatiquement.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleCommit}
              disabled={busy || !analyzedJob || importableCount === 0}
              className="w-full py-5 bg-cam-green text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-green-200 hover:bg-green-700 hover:scale-[1.01] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-3"
            >
              {isCommitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Import en cours...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-2xl">drive_folder_upload</span>
                  Lancer l'import
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-400 italic">
              {analyzedJob
                ? importableCount > 0
                  ? 'Le commit cree les documents finaux uniquement pour les lignes pretes.'
                  : 'Le bouton reste bloque tant qu aucun item n est importable.'
                : 'Le commit reste indisponible tant que l analyse n a pas ete produite.'}
            </p>
          </div>
        </div>
      </div>

      <div className="glass p-8 rounded-[2.5rem] bg-white/40 border-white">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
          Formats pris en charge
        </h4>
        <div className="flex flex-wrap gap-2">
          {Array.from(SUPPORTED_EXTENSIONS).map((ext) => (
            <span key={ext} className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider">
              {ext}
            </span>
          ))}
        </div>
      </div>

      {commitResult && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Importes" value={commitResult.imported_documents} icon="check_circle" color="bg-cam-green" />
            <SummaryCard label="A arbitrer" value={commitResult.pending_review_items} icon="rule" color="bg-amber-500" />
            <SummaryCard label="Doublons" value={previewCounts.duplicate} icon="content_copy" color="bg-blue-500" />
            <SummaryCard label="Erreurs" value={commitResult.failed_items} icon="error" color="bg-red-500" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="glass p-8 rounded-[2.5rem] bg-white/60 border-white">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 italic">
                Documents importes ({previewJob?.items.filter((item) => item.status === 'imported').length || 0})
              </h4>
              <div className="space-y-3">
                {(previewJob?.items || [])
                  .filter((item) => item.status === 'imported')
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-50 hover:border-green-100 transition-colors">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-cam-green">description</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-800 uppercase italic truncate">{item.source_relative_path || item.original_filename}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {getItemTargetLabel(item)}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-green-400 text-lg">check_circle</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="glass p-8 rounded-[2.5rem] bg-amber-50/50 border-amber-100">
              <h4 className="text-sm font-black uppercase tracking-widest text-amber-500 mb-6 italic">
                Points de vigilance
              </h4>
              <div className="space-y-3">
                {(previewJob?.items || [])
                  .filter((item) => item.status !== 'imported')
                  .map((item) => {
                    const statusMeta = PREVIEW_STATUS_META[item.status];
                    return (
                      <div key={item.id} className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-amber-100">
                        <span className={`material-symbols-outlined text-lg ${item.status === 'failed' ? 'text-red-500' : 'text-amber-500'}`}>
                          {statusMeta.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-bold text-slate-700 break-all">{item.source_relative_path || item.original_filename}</p>
                            <span className={`px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-2">{item.error_message || statusMeta.helper || 'A verifier avant traitement complementaire.'}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) => (
  <div className="glass p-6 rounded-[2rem] bg-white/60 border-white text-center">
    <div className={`w-12 h-12 ${color} text-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
      <span className="material-symbols-outlined text-xl">{icon}</span>
    </div>
    <p className="text-3xl font-black text-slate-800 italic">{value}</p>
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</p>
  </div>
);

export default DirectoryIngestion;
