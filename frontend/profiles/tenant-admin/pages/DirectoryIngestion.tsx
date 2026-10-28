import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pushClientOperationError } from '../../../lib/errors';
import { api } from '../../../services/api';
import { categoriesApi, DocumentCategory } from '../../../services/categories.api';
import { useAuthStore } from '../../../stores/authStore';
import { Tooltip } from '../../../components/ui/Tooltip';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { UI_TOOLTIPS } from '../../../content/uiTooltips';
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
import {
  applyLocalFolderPathOverrides,
  arrangeFiles,
  buildLocalClassificationLexicon,
  downloadArrangedAsZip,
  LOCAL_ARRANGEMENT_OPTIONS,
  localArrangementFileKey,
  type LocalClassificationLexicon,
  LocalArrangementStrategy,
  LocalWriteProgress,
  LocalWriteResult,
  pickLocalDirectory,
  prepareBusinessRulesForLocalMatching,
  supportsFileSystemAccess,
  writeArrangedToDirectory,
  writeManifestToDirectory,
} from '../../../services/localOrganizer';
import { SANS_DATE } from '../../../services/localOrganizer/constants';
import {
  getLibraryDestinationHandle,
  getLibraryRun,
  loadLibraryFilesFromFsaDestination,
  newRunId,
  saveLibraryDestinationHandle,
  saveLibraryRun,
} from '../../../services/localLibrary';
import type { ClassificationRule } from '../../../types';

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

type WizardStep = 'select' | 'context' | 'review' | 'confirm';

/**
 * Objectif d'import demandé à la première étape :
 * - 'ged'   : flux historique — classement dans la GED via le serveur (obligatoire).
 * - 'local' : rangement local (création de sous-dossiers sur le poste de l'utilisateur).
 *
 * Le choix est forcé dès l'étape 1 (pas de valeur par défaut) afin d'orienter
 * l'utilisateur sans ajouter une étape supplémentaire au wizard.
 */
type WizardGoal = 'ged' | 'local';

const WIZARD_GOAL_OPTIONS: Array<{ value: WizardGoal; label: string; icon: string; helper: string }> = [
  {
    value: 'ged',
    label: 'Importer dans le Serveur de l\u2019Application',
    icon: 'cloud_upload',
    helper: 'Les fichiers sont déposés sur le serveur de l\u2019application, indexés et accessibles à votre équipe.',
  },
  {
    value: 'local',
    label: 'Ranger sur mon poste',
    icon: 'folder_managed',
    helper: 'Les fichiers restent sur votre ordinateur, regroupés automatiquement en sous-dossiers.',
  },
];

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.txt', '.csv', '.rtf',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.webp',
]);

const SOURCE_SCOPE_OPTIONS: Array<{ value: ImportSourceScope; label: string; helper: string }> = [
  {
    value: 'person',
    label: 'Personne',
    helper: 'Les fichiers seront rattachés à un agent précis et traités dans son espace personnel.',
  },
  {
    value: 'service',
    label: 'Service',
    helper: 'Les fichiers seront classés au niveau du service choisi et resteront partagés dans cet espace.',
  },
  {
    value: 'subdirectorate',
    label: 'Sous-direction',
    helper: 'Les fichiers seront préparés pour un espace plus large que le service simple.',
  },
];

const PROCESSING_MODE_OPTIONS: Array<{ value: ImportProcessingMode; label: string; icon: string; helper: string }> = [
  {
    value: 'archive',
    label: 'Juste les ranger',
    icon: 'folder',
    helper: 'Classement seul. Aucun circuit de validation ne démarre. Recommandé pour une reprise de l’existant.',
  },
  {
    value: 'process',
    label: 'Les ranger et lancer le circuit',
    icon: 'settings',
    helper: 'Démarre automatiquement le circuit de traitement quand le classement est suffisant.',
  },
];

const WIZARD_STEPS: Array<{ id: WizardStep; index: number; title: string; helper: string }> = [
  {
    id: 'select',
    index: 1,
    title: 'Choisir les documents',
    helper: 'Sélectionnez un dossier complet ou seulement quelques fichiers.',
  },
  {
    id: 'context',
    index: 2,
    title: 'Définir la destination',
    helper: 'Précisez le niveau de classement, la destination et le mode de traitement.',
  },
  {
    id: 'review',
    index: 3,
    title: 'Vérifier le classement',
    helper: 'Contrôlez les propositions avant toute création de document définitif.',
  },
  {
    id: 'confirm',
    index: 4,
    title: 'Importer',
    helper: 'Lancez l’import des fichiers prêts et consultez le résultat.',
  },
];

const PREVIEW_STATUS_META: Record<
  ImportJobItemStatus,
  { label: string; className: string; icon: string; helper?: string }
> = {
  classified: {
    label: 'Prêt',
    className: 'bg-green-100 text-green-700 border-green-200',
    icon: 'task_alt',
    helper: 'Le document peut être importé sans vérification supplémentaire.',
  },
  pending: {
    label: 'À compléter',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'hourglass_top',
    helper: 'Aucune règle claire n’a été trouvée. Une reprise manuelle sera nécessaire.',
  },
  needs_review: {
    label: 'À vérifier',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'rule',
    helper: 'Le moteur a détecté une ambiguïté ou une destination incohérente.',
  },
  duplicate: {
    label: 'Doublon',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: 'content_copy',
    helper: 'Le contenu existe déjà dans l’espace documentaire ou dans cette importation.',
  },
  ignored: {
    label: 'Ignoré',
    className: 'bg-slate-100 text-slate-500 border-slate-200',
    icon: 'block',
    helper: 'Le format de fichier n’est pas pris en charge par cette importation.',
  },
  imported: {
    label: 'Importé',
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

/** Navigation depuis la bibliothèque locale — rejouer avec fichiers réels si poignée FSA encore en IndexedDB. */
interface LocalReplayFromLibraryState {
  localReplayFromLibrary: {
    runId?: string;
    mode?: 'fsa' | 'zip';
    strategy: string;
    files: Array<{ name: string; last_modified: number }>;
  };
}

const LOCAL_STRATEGY_VALUES: readonly LocalArrangementStrategy[] = [
  'by_business_rules',
  'by_type',
  'by_year',
  'by_type_year',
];

const coerceIncomingLocalStrategy = (raw: string): LocalArrangementStrategy =>
  LOCAL_STRATEGY_VALUES.includes(raw as LocalArrangementStrategy)
    ? (raw as LocalArrangementStrategy)
    : 'by_business_rules';

const formatDetectedType = (item: ImportJobItem) => {
  const extension = getFileExtension(item.original_filename).replace('.', '').toUpperCase();
  if (extension) return extension;
  if (item.mime_type) return item.mime_type;
  return 'FICHIER';
};

const DirectoryIngestion: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const localReplayAppliedRef = useRef(false);
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
  const [currentStep, setCurrentStep] = useState<WizardStep>('select');
  // Choix forcé à l'étape 1 : null tant que l'utilisateur n'a pas tranché GED vs local.
  const [goal, setGoal] = useState<WizardGoal | null>(null);

  // États du mode local (rangement sur le poste). Aucune donnée n'est envoyée
  // au serveur dans ce mode — tout reste dans le navigateur de l'utilisateur.
  const [localStrategy, setLocalStrategy] = useState<LocalArrangementStrategy>('by_business_rules');
  const [localRules, setLocalRules] = useState<ClassificationRule[] | null>(null);
  const [localLexicon, setLocalLexicon] = useState<LocalClassificationLexicon | null>(null);
  const [isLoadingLocalReference, setIsLoadingLocalReference] = useState(false);
  const [localDestMode, setLocalDestMode] = useState<'fsa' | 'zip'>(
    supportsFileSystemAccess() ? 'fsa' : 'zip',
  );
  const [localDirHandle, setLocalDirHandle] = useState<any | null>(null);
  const [localDirName, setLocalDirName] = useState<string>('');
  // Sous-dossier optionnel à créer dans le dossier choisi. Permet à l'utilisateur
  // de regrouper toute l'opération sous un wrapper « Rangement 2026 » par
  // exemple, sans avoir à passer par le bouton « Nouveau dossier » de la
  // boîte de dialogue Windows.
  const [localWrapperName, setLocalWrapperName] = useState<string>('');
  /** Choix utilisateur quand plusieurs dossiers taxonomiques sont plausibles (clé stable par fichier). */
  const [localPathOverrides, setLocalPathOverrides] = useState<Record<string, string>>({});
  const [isLocalRunning, setIsLocalRunning] = useState(false);
  const [localProgress, setLocalProgress] = useState<LocalWriteProgress | null>(null);
  const [localResult, setLocalResult] = useState<LocalWriteResult | null>(null);
  const [localResultMode, setLocalResultMode] = useState<'fsa' | 'zip' | null>(null);
  const [showDirectoryPrompt, setShowDirectoryPrompt] = useState(false);
  const [analyzedJob, setAnalyzedJob] = useState<ImportJobWithItems | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Manifeste rejoué depuis la bibliothèque : aperçu OK, écriture/ZIP interdits jusqu’à nouvelle sélection disque. */
  const [libraryReplayStubMode, setLibraryReplayStubMode] = useState(false);

  useEffect(() => {
    // Les données de référence (catégories, org units, agents, templates) sont
    // réservées aux profils admin qui orchestrent l'import en masse. Inutile —
    // et 403-isant — de les charger pour les profils opérationnels qui voient
    // une vue simplifiée verrouillée.
    const isAdminWizard = userProfile?.id === 'super' || userProfile?.id === 'tenant';
    if (!isAdminWizard) {
      return;
    }

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
  }, [userProfile?.id]);

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

  useEffect(() => {
    const payload = (location.state as LocalReplayFromLibraryState | null)?.localReplayFromLibrary;
    if (!payload?.files?.length) {
      localReplayAppliedRef.current = false;
      return;
    }
    if (localReplayAppliedRef.current) return;
    localReplayAppliedRef.current = true;

    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });

    let cancelled = false;

    // Effet fire-and-forget : remplit le wizard depuis un run bibliothèque.
    // eslint-disable-next-line no-void -- intentionnellement non attendu (pas de cleanup Promise)
    void (async () => {
      const stubs = payload.files.map(
        (f) => new File([], f.name, { lastModified: f.last_modified }),
      );

      let stubMode = true;
      let filesToSelect: File[] = [];
      let unsupported = 0;
      let dirHandle: unknown | null = null;
      let dirNameStr = '';
      let wrapperRestore = '';

      if (payload.runId && payload.mode === 'fsa') {
        try {
          const [persistedHandle, meta] = await Promise.all([
            getLibraryDestinationHandle(payload.runId),
            getLibraryRun(payload.runId),
          ]);
          if (
            persistedHandle &&
            meta?.files?.length &&
            meta.files.length === payload.files.length
          ) {
            type DirHandleWithPerm = FileSystemDirectoryHandle & {
              requestPermission?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
            };
            const dirH = persistedHandle as DirHandleWithPerm;
            let accessOk = true;
            if (typeof dirH.requestPermission === 'function') {
              const perm = await dirH.requestPermission({ mode: 'readwrite' });
              accessOk = perm === 'granted';
            }
            if (accessOk) {
              const realFiles = await loadLibraryFilesFromFsaDestination(
                persistedHandle,
                meta.wrapper,
                meta.files,
              );
              const allSupported =
                realFiles.length === meta.files.length && realFiles.every((file) => isSupportedFile(file));
              if (allSupported) {
                stubMode = false;
                filesToSelect = realFiles;
                unsupported = 0;
                dirHandle = persistedHandle;
                dirNameStr = (persistedHandle as { name?: string }).name || '';
                wrapperRestore = meta.wrapper?.trim() || '';
              }
            }
          }
        } catch (hydrateErr) {
          console.warn('Reprise depuis le dossier enregistré :', hydrateErr);
        }
      }

      if (stubMode) {
        filesToSelect = stubs.filter(isSupportedFile);
        unsupported = stubs.length - filesToSelect.length;
        dirHandle = null;
        dirNameStr = '';
        wrapperRestore = '';
      }

      if (cancelled) return;

      if (filesToSelect.length === 0) {
        setError(
          'Impossible de rejouer ce rangement : aucun fichier lisible ou extension non prise en charge.',
        );
        localReplayAppliedRef.current = false;
        return;
      }

      setLibraryReplayStubMode(stubMode);
      setGoal('local');
      setLocalStrategy(coerceIncomingLocalStrategy(payload.strategy));
      setSelectedFiles(filesToSelect);
      setUnsupportedCount(unsupported);
      setSelectionLabel(
        stubMode
          ? `Historique bibliothèque · ${filesToSelect.length} fichier(s)`
          : `Dossier enregistré · ${filesToSelect.length} fichier(s)`,
      );

      if (!stubMode) {
        setLocalDestMode('fsa');
        setLocalDirHandle(dirHandle);
        setLocalDirName(dirNameStr || 'Dossier destination');
        setLocalWrapperName(wrapperRestore);
      } else {
        setLocalDestMode(payload.mode === 'zip' ? 'zip' : 'fsa');
        setLocalDirHandle(null);
        setLocalDirName('');
        setLocalWrapperName('');
      }

      setAnalyzedJob(null);
      setCommitResult(null);
      setProgress(null);
      setLocalResult(null);
      setLocalProgress(null);
      setLocalResultMode(null);
      setLocalPathOverrides({});
      setError(null);
      setCurrentStep('review');
    })();

    return () => {
      cancelled = true;
    };
  }, [location.state, location.pathname, location.search, navigate]);

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
  const busy = isAnalyzing || isCommitting || isLocalRunning;
  const requiresTargetOrgUnit = sourceScope !== 'person' && !userProfile?.orgUnitId;

  const getItemCategoryName = (item: ImportJobItem) => {
    if (item.detected_document_category_id) {
      return categoriesById.get(item.detected_document_category_id) || 'Categorie selectionnee';
    }
    return 'Aucune categorie';
  };

  const getItemWorkflowLabel = (item: ImportJobItem) => {
    if (!item.workflow_template_id) {
      return 'Aucun circuit';
    }
    return templatesById.get(item.workflow_template_id) || 'Circuit associé';
  };

  const getItemTargetLabel = (item: ImportJobItem) => {
    if (item.logical_space_path) return item.logical_space_path;
    if (item.resolved_target_user_id) {
      return usersById.get(item.resolved_target_user_id) || 'Utilisateur cible';
    }
    if (item.resolved_target_org_unit_id) {
      return orgUnitsById.get(item.resolved_target_org_unit_id) || 'Service cible';
    }
    return 'Aucune destination déterminée';
  };

  const resetSelection = () => {
    setSelectedFiles([]);
    setSelectionLabel('');
    setUnsupportedCount(0);
    setCurrentStep('select');
    clearBatchState();
    setLocalResult(null);
    setLocalProgress(null);
    setLocalResultMode(null);
    setLocalWrapperName('');
    setLocalPathOverrides({});
    setLibraryReplayStubMode(false);
    if (directoryInputRef.current) directoryInputRef.current.value = '';
    if (filesInputRef.current) filesInputRef.current.value = '';
  };

  const openDirectoryPicker = () => {
    setShowDirectoryPrompt(false);
    directoryInputRef.current?.click();
  };

  const handlePickedFiles = (files: FileList | null, source: 'directory' | 'files') => {
    if (!files || files.length === 0) {
      return;
    }

    const allFiles = Array.from(files);
    const supportedCount = allFiles.filter(isSupportedFile).length;
    const ignoredFiles = allFiles.length - supportedCount;

    setSelectedFiles(allFiles);
    setLibraryReplayStubMode(false);
    setUnsupportedCount(ignoredFiles);
    setCurrentStep('select');
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
      return 'Sélectionnez d abord un dossier ou des fichiers à analyser.';
    }
    if (sourceScope === 'person' && !targetUserId) {
      return 'Choisissez l agent concerné pour un classement personnel.';
    }
    if (requiresTargetOrgUnit && !resolvedTargetOrgUnitId) {
      return 'Choisissez le service de destination auquel rattacher ces fichiers.';
    }
    if (forcedYearInput.trim() && !Number.isInteger(forcedYear)) {
      return 'L année imposée doit être un nombre entier à 4 chiffres.';
    }
    return null;
  };

  const validateStepSelect = () => {
    if (goal === null) {
      return 'Choisissez d abord votre objectif : ranger dans le serveur de l application ou ranger sur votre poste.';
    }
    if (selectedFiles.length === 0) {
      return 'Choisissez d abord un dossier ou des fichiers avant de continuer.';
    }
    return null;
  };

  const validateStepContext = () => {
    if (goal === 'local') {
      // En mode local, la « destination » est soit un dossier sur le poste,
      // soit un téléchargement ZIP — pas besoin de catégorie / org-unit.
      if (localDestMode === 'fsa' && !localDirHandle) {
        return 'Choisissez d abord le dossier de destination sur votre poste.';
      }
      return null;
    }
    if (sourceScope === 'person' && !targetUserId) {
      return 'Choisissez l agent concerné pour un classement personnel.';
    }
    if (requiresTargetOrgUnit && !resolvedTargetOrgUnitId) {
      return 'Choisissez le service de destination auquel rattacher ces fichiers.';
    }
    if (forcedYearInput.trim() && !Number.isInteger(forcedYear)) {
      return 'L année imposée doit être un nombre entier à 4 chiffres.';
    }
    return null;
  };

  const goToStep = (step: WizardStep) => {
    const order = WIZARD_STEPS.map((item) => item.id);
    const targetIndex = order.indexOf(step);
    const currentIndex = order.indexOf(currentStep);

    if (targetIndex <= currentIndex) {
      setCurrentStep(step);
      return;
    }

    if (targetIndex >= 1) {
      const selectError = validateStepSelect();
      if (selectError) {
        setError(selectError);
        setCurrentStep('select');
        return;
      }
    }

    if (targetIndex >= 2) {
      const contextError = validateStepContext();
      if (contextError) {
        setError(contextError);
        setCurrentStep('context');
        return;
      }
    }

    if (targetIndex >= 3 && goal !== 'local' && !analyzedJob) {
      setError('Lancez d abord la vérification du classement avant de continuer.');
      setCurrentStep('review');
      return;
    }
    if (targetIndex >= 3 && goal === 'local' && !localResult) {
      // En mode local, l'étape « confirm » n'est atteinte que par
      // handleLocalRun() après écriture/ZIP. Tout autre chemin retombe sur
      // l'aperçu pour éviter une page vide.
      setError(null);
      setCurrentStep('review');
      return;
    }

    setError(null);
    setCurrentStep(step);
  };

  // Chargement paresseux : règles métier + référentiel domaines / activités
  // (plan de classement) pour la stratégie « intelligent » — tout reste
  // évalué localement après coup ; seul ce fetch touche le réseau.
  useEffect(() => {
    if (goal !== 'local') return;
    if (localRules !== null || isLoadingLocalReference) return;
    let cancelled = false;
    setIsLoadingLocalReference(true);
    Promise.allSettled([
      api.getClassificationRules(),
      api.getClassificationDomains(false),
      api.getClassificationActivities({}),
    ])
      .then((results) => {
        if (cancelled) return;
        const [rulesRes, domainsRes, activitiesRes] = results;
        if (rulesRes.status === 'fulfilled') {
          setLocalRules(prepareBusinessRulesForLocalMatching(rulesRes.value || []));
        } else {
          console.warn('Chargement des règles métier impossible :', rulesRes.reason);
          setLocalRules([]);
        }
        if (domainsRes.status === 'fulfilled' && activitiesRes.status === 'fulfilled') {
          setLocalLexicon(
            buildLocalClassificationLexicon(domainsRes.value || [], activitiesRes.value || []),
          );
        } else {
          if (domainsRes.status === 'rejected') {
            console.warn('Chargement des domaines impossible :', domainsRes.reason);
          }
          if (activitiesRes.status === 'rejected') {
            console.warn('Chargement des activités impossible :', activitiesRes.reason);
          }
          setLocalLexicon({ domains: [], activities: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLocalReference(false);
      });
    return () => {
      cancelled = true;
    };
  }, [goal, localRules, isLoadingLocalReference]);

  // Aperçu de l'arborescence proposée (recalculé quand la sélection, la
  // stratégie ou les règles changent). Mémoïsé pour éviter de retrier à
  // chaque rerender.
  const localTree = useMemo(
    () =>
      goal === 'local'
        ? arrangeFiles(selectedFiles, localStrategy, localRules ?? undefined, localLexicon ?? undefined)
        : null,
    [goal, selectedFiles, localStrategy, localRules, localLexicon],
  );

  const effectiveLocalTree = useMemo(
    () => (localTree ? applyLocalFolderPathOverrides(localTree, localPathOverrides) : null),
    [localTree, localPathOverrides],
  );

  const localAmbiguousFiles = useMemo(() => {
    if (!effectiveLocalTree) return [];
    return effectiveLocalTree.files.filter(
      (f) => f.taxonomyCandidates && f.taxonomyCandidates.length > 1,
    );
  }, [effectiveLocalTree]);

  useEffect(() => {
    setLocalPathOverrides({});
  }, [selectedFiles, localStrategy, localRules, localLexicon]);

  const handlePickLocalDirectory = async () => {
    try {
      const handle = await pickLocalDirectory();
      if (handle) {
        setLocalDirHandle(handle);
        setLocalDirName((handle as any).name || 'Dossier sélectionné');
        setError(null);
      }
    } catch (pickErr) {
      const msg = errorMessage(pickErr, 'Impossible d ouvrir le sélecteur de dossier.');
      pushClientOperationError(pickErr, {
        fallbackDetail: 'Impossible d ouvrir le sélecteur de dossier.',
        errorCode: 'LOCAL_DIRECTORY_PICKER_FAILED',
        retryable: true,
      });
      setError(msg);
    }
  };

  const handleLocalRun = async () => {
    const treeToWrite = effectiveLocalTree;
    if (!treeToWrite || treeToWrite.total === 0) {
      setError('Aucun fichier à ranger.');
      return;
    }
    if (localDestMode === 'fsa' && !localDirHandle) {
      setError('Choisissez d abord le dossier de destination sur votre poste.');
      return;
    }
    if (libraryReplayStubMode) {
      setError(
        'Aperçu depuis l\'historique sans fichiers réels : choisissez le dossier à l\'étape 1, ou rouvrez depuis le même navigateur après un rangement sur le disque.',
      );
      return;
    }

    setIsLocalRunning(true);
    setError(null);
    setLocalResult(null);
    setLocalProgress({ written: 0, total: treeToWrite.total, current: '' });

    try {
      let mode: 'fsa' | 'zip' = 'zip';
      let okCount = 0;
      let destinationLabel = '';
      if (localDestMode === 'fsa' && localDirHandle) {
        // Si l'utilisateur a saisi un nom de sous-dossier dédié, on le crée
        // dans le dossier choisi et on s'en sert comme racine d'écriture.
        // Sanitize basique pour éviter les caractères interdits Windows.
        const trimmedWrapper = localWrapperName.trim();
        let writeRoot: any = localDirHandle;
        if (trimmedWrapper) {
          const safeWrapper = trimmedWrapper
            // eslint-disable-next-line no-control-regex
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 60);
          if (safeWrapper) {
            writeRoot = await localDirHandle.getDirectoryHandle(safeWrapper, { create: true });
          }
        }
        const result = await writeArrangedToDirectory(writeRoot, treeToWrite, (p) => setLocalProgress(p));
        writeManifestToDirectory(writeRoot, treeToWrite, 'json').catch((manifestErr) => {
          console.warn('Manifest rangement local non écrit :', manifestErr);
        });
        setLocalResult(result);
        setLocalResultMode('fsa');
        mode = 'fsa';
        okCount = result.ok;
        destinationLabel = localDirName || 'Poste local';
      } else {
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const zipName = `rangement_local_${stamp}.zip`;
        const zipResult = await downloadArrangedAsZip(treeToWrite, zipName, (p) => setLocalProgress(p));
        setLocalResult(zipResult);
        setLocalResultMode('zip');
        mode = 'zip';
        okCount = zipResult.ok;
        destinationLabel = zipName;
      }
      setCurrentStep('confirm');

      const libraryRunId = newRunId();
      const libraryRun = {
        id: libraryRunId,
        created_at: Date.now(),
        destination: destinationLabel,
        wrapper: localWrapperName.trim() || null,
        strategy: localStrategy,
        mode,
        total_files: treeToWrite.total,
        total_folders: treeToWrite.foldersCreated,
        files_unranged: treeToWrite.filesUnranged,
        files: treeToWrite.files.map((f) => ({
          name: f.newName,
          folder_path: f.folderPath,
          size: f.file.size,
          last_modified: f.file.lastModified,
        })),
      };

      // Bibliothèque locale (navigateur) : IndexedDB pour recherche hors-ligne.
      saveLibraryRun(libraryRun).catch((libErr) => {
        console.warn('Sauvegarde bibliothèque locale échouée :', libErr);
      });
      if (mode === 'fsa' && localDirHandle) {
        saveLibraryDestinationHandle(libraryRun.id, localDirHandle as FileSystemDirectoryHandle).catch((hErr) => {
          console.warn('Poignée dossier destination non conservée :', hErr);
        });
      }

      // Copie « dernier rangement » sur le compte utilisateur (PostgreSQL) pour
      // retrouver le catalogue depuis un autre navigateur ou poste. Les noms de
      // fichiers et chemins relatifs sont alors stockés côté serveur — best-effort.
      api.putLocalArrangementSnapshot(libraryRun).catch((snapErr) => {
        console.warn('Synchronisation bibliothèque (serveur) échouée :', snapErr);
      });

      // Telemetry best-effort : enregistrer un compteur anonyme côté serveur
      // pour qu'un admin tenant puisse mesurer l'usage du mode local depuis
      // /reports. Aucun nom de fichier ni contenu n'est envoyé. Un échec
      // (réseau coupé, serveur down) ne doit jamais bloquer l'utilisateur.
      api
        .recordLocalOrganize({
          file_count: okCount,
          folders_created: treeToWrite.foldersCreated,
          files_unranged: treeToWrite.filesUnranged,
          strategy: localStrategy,
          mode,
        })
        .catch((telemetryErr) => {
          console.warn('Telemetry recordLocalOrganize a échoué :', telemetryErr);
        });
    } catch (runErr) {
      const msg = errorMessage(runErr, 'Le rangement local a échoué.');
      pushClientOperationError(runErr, {
        fallbackDetail: 'Le rangement local a échoué.',
        errorCode: 'LOCAL_ORGANIZE_FAILED',
        retryable: true,
      });
      setError(msg);
    } finally {
      setIsLocalRunning(false);
    }
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
      label: 'Analyse des fichiers',
      detail: `${selectedFiles.length} fichier(s) envoyés au moteur de préparation.`,
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
      setCurrentStep('review');
      setProgress(null);
    } catch (analyzeError) {
      setError(errorMessage(analyzeError, 'Analyse des fichiers impossible.'));
      setProgress(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!analyzedJob) {
      setError('Analysez d abord les fichiers avant de lancer l import.');
      return;
    }
    if (importableCount === 0) {
      setError('Aucun fichier ne peut être importé pour le moment. Corrigez le contexte ou ajustez les règles.');
      return;
    }

    setIsCommitting(true);
    setError(null);
    setProgress({
      stage: 'commit',
      label: 'Import final',
      detail: `${importableCount} fichier(s) prêts vont être importés dans la GED.`,
    });

    try {
      const result = await api.commitImportJob(analyzedJob.id);
      setCommitResult(result);
      setAnalyzedJob(result.job);
      setCurrentStep('confirm');
      setProgress(null);
    } catch (commitError) {
      setError(errorMessage(commitError, 'Import final impossible.'));
      setProgress(null);
    } finally {
      setIsCommitting(false);
    }
  };

  const statusCardValue = commitResult ? commitResult.imported_documents : previewCounts.classified;
  const analyzeTooltip = busy
    ? UI_TOOLTIPS.directoryIngestion.analyzeDisabledBusy
    : selectedFiles.length === 0
      ? UI_TOOLTIPS.directoryIngestion.analyzeDisabledNoFiles
      : UI_TOOLTIPS.directoryIngestion.analyzeReady;
  const commitTooltip = !analyzedJob
    ? UI_TOOLTIPS.directoryIngestion.commitDisabledNoAnalysis
    : importableCount === 0
      ? UI_TOOLTIPS.directoryIngestion.commitDisabledNoImportable
      : UI_TOOLTIPS.directoryIngestion.commitReady;
  const currentStepIndex = Math.max(0, WIZARD_STEPS.findIndex((step) => step.id === currentStep));
  const currentStepMeta = WIZARD_STEPS[currentStepIndex] ?? WIZARD_STEPS[0]!;
  const selectStepError = validateStepSelect();
  const contextStepError = validateStepContext();
  const canContinueFromSelect = !selectStepError;
  const canContinueFromContext = !contextStepError && !selectStepError;
  const canContinueFromReview = !!analyzedJob;
  const directImportSummary = [
    `${previewCounts.classified} prêt(s)`,
    `${previewCounts.needsReview + previewCounts.pending} à revoir`,
    `${previewCounts.duplicate + previewCounts.ignored} ignoré(s) ou déjà présent(s)`,
  ].join(' • ');

  // Wizard complet réservé aux administrateurs (super, tenant). Les autres profils
  // arrivent sur une vue simplifiée verrouillée — ils n'ont pas à gérer la
  // configuration GED (catégorie, scope, mode de traitement, circuits…).
  const isAdminWizard = userProfile?.id === 'super' || userProfile?.id === 'tenant';

  if (!isAdminWizard) {
    return (
      <div className="p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-32">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-slate-200">
            Espace personnel
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">
            Ranger mon bureau<br />
            <span className="text-cam-green">ou importer des documents</span>
          </h2>
          <p className="text-slate-500 mt-2 font-medium italic text-lg max-w-3xl">
            Deux usages possibles : déposer des documents sur le serveur de l’application, ou regrouper des fichiers en sous-dossiers sur votre poste.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Que voulez-vous faire ?"
          className="rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Choisir une action</p>
            <h3 className="mt-1 text-lg font-black uppercase italic tracking-tight text-slate-900">
              Que voulez-vous faire ?
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Les deux options ci-dessous arrivent prochainement. Pour l’instant, votre administrateur prend en charge les imports en masse.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {WIZARD_GOAL_OPTIONS.map((option) => {
              const isServerOption = option.value === 'ged';
              const lockMessage = isServerOption
                ? 'Verrouillé pour votre profil — sera ouvert pour lancer un circuit.'
                : 'Bientôt disponible — création automatique de sous-dossiers sur votre poste.';
              return (
                <div
                  key={option.value}
                  role="radio"
                  aria-checked={false}
                  aria-disabled
                  className="text-left rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4 opacity-90"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-2xl shrink-0 text-slate-400">
                      {option.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black uppercase tracking-wide text-slate-700">{option.label}</p>
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700">
                          {isServerOption ? 'Verrouillé' : 'Bientôt'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 leading-snug">{option.helper}</p>
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">lock</span>
                        {lockMessage}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span className="material-symbols-outlined text-slate-500 text-base shrink-0 mt-0.5">support_agent</span>
          <p>
            Besoin d’ajouter des documents dès maintenant ? Demandez à votre administrateur de les importer pour votre service.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-32">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-green/10 text-cam-green rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-green/20">
          Assistant guidé
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">
          Assistant d’<span className="text-cam-green">import documentaire</span>
        </h2>
        <p className="text-slate-500 mt-2 font-medium italic text-lg max-w-4xl">
          Ajoutez un lot de documents, définissez leur destination, vérifiez le classement proposé, puis importez uniquement les fichiers prêts.
        </p>
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

      <ConfirmationModal
        open={showDirectoryPrompt}
        eyebrow="Import massif"
        icon="folder_open"
        title="Ouvrir un dossier complet"
        message="L’application va vous demander un dossier local. Si ce dossier contient beaucoup de fichiers, le navigateur affichera ensuite sa propre confirmation de sécurité."
        bullets={[
          'Choisissez seulement un dossier métier utile à cette importation.',
          'Évitez les répertoires trop larges ou temporaires si vous n’en avez pas besoin.',
          'Le navigateur peut vous redemander une confirmation pour un volume important.',
        ]}
        cancelLabel="Annuler"
        confirmLabel="Choisir un dossier"
        onCancel={() => setShowDirectoryPrompt(false)}
        onConfirm={openDirectoryPicker}
      />

      <div className="rounded-[3rem] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)] p-8 md:p-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {WIZARD_STEPS.map((step) => {
            const isCurrent = currentStep === step.id;
            const isDone = WIZARD_STEPS.findIndex((item) => item.id === step.id) < currentStepIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => goToStep(step.id)}
                className={`text-left rounded-[2rem] border px-5 py-4 transition-all ${
                  isCurrent
                    ? 'border-cam-green bg-green-50 shadow-md'
                    : isDone
                      ? 'border-slate-200 bg-white hover:border-slate-300'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black ${
                    isCurrent ? 'bg-cam-green text-white' : isDone ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'
                  }`}>
                    {isDone ? <span className="material-symbols-outlined text-base">check</span> : step.index}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Étape {step.index}</p>
                    <p className="text-sm font-black text-slate-800">{step.title}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{step.helper}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 px-5 py-4 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-2 text-slate-600">
            <span className="material-symbols-outlined text-base text-slate-400">folder</span>
            {selectionLabel || 'Aucun lot sélectionné'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-2 text-slate-600">
            <span className="material-symbols-outlined text-base text-slate-400">inventory_2</span>
            {selectedFiles.length > 0 ? `${selectedFiles.length} fichier(s) • ${formatFileSize(totalSelectedSize)}` : 'Aucun fichier prêt'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-2 text-slate-600">
            <span className="material-symbols-outlined text-base text-slate-400">place_item</span>
            {SOURCE_SCOPE_OPTIONS.find((option) => option.value === sourceScope)?.label || sourceScope}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-2 text-slate-600">
            <span className="material-symbols-outlined text-base text-slate-400">domain</span>
            {sourceScope === 'person'
              ? (selectedUser?.full_name || 'Agent à choisir')
              : (orgUnitsById.get(resolvedTargetOrgUnitId) || (requiresTargetOrgUnit ? 'Service à choisir' : 'Service de votre profil'))}
          </span>
          {previewJob && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-2 text-blue-700">
              <span className="material-symbols-outlined text-base">rule</span>
              {directImportSummary}
            </span>
          )}
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
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                {progress.stage === 'analyze' ? 'Étape 3 sur 4' : 'Étape 4 sur 4'}
              </p>
              <p className="text-lg font-black text-slate-800 italic mt-1">{progress.label}</p>
              <p className="text-sm text-slate-500 mt-1">{progress.detail}</p>
            </div>
          </div>
        )}

        <div className="rounded-[2.5rem] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)] p-8 md:p-10 space-y-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-xl">
                  {currentStep === 'select' ? 'folder_open' : currentStep === 'context' ? 'tune' : currentStep === 'review' ? 'preview' : 'drive_folder_upload'}
                </span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Étape {currentStepMeta.index} sur {WIZARD_STEPS.length}
                </p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight italic uppercase">
                  {currentStepMeta.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 max-w-3xl">{currentStepMeta.helper}</p>
              </div>
            </div>
          </div>

          {currentStep === 'select' && (
            <div className="space-y-6">
              {/* Objectif d'import — choix forcé en tête d'étape 1, sans ajouter de step au wizard. */}
              <div
                role="radiogroup"
                aria-label="Objectif d'import"
                className="rounded-[2rem] border-2 border-slate-100 bg-white p-5"
              >
                <div className="mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Étape 1 · Objectif</p>
                  <h3 className="mt-1 text-lg font-black uppercase italic tracking-tight text-slate-900">
                    Que voulez-vous faire de ces fichiers ?
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Choisissez d&apos;abord. Le reste de l&apos;étape s&apos;active ensuite.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {WIZARD_GOAL_OPTIONS.map((option) => {
                    const isActive = goal === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => setGoal(option.value)}
                        disabled={busy}
                        className={`text-left rounded-2xl border-2 p-4 transition-all disabled:opacity-60 ${
                          isActive
                            ? 'border-cam-green bg-green-50/60 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`material-symbols-outlined text-2xl shrink-0 ${isActive ? 'text-cam-green' : 'text-slate-400'}`}>
                            {option.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black uppercase tracking-wide text-slate-800">{option.label}</p>
                            <p className="mt-1 text-xs text-slate-500 leading-snug">{option.helper}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {goal === 'local' && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">verified</span>
                    <p>
                      Mode <span className="font-bold">« Ranger sur mon poste »</span> activé.
                      {supportsFileSystemAccess()
                        ? ' Aucun fichier ne sera envoyé au serveur — vous choisirez le dossier de destination à l\u2019étape suivante.'
                        : ' Votre navigateur ne permet pas l\u2019écriture directe ; le rangement vous sera livré sous forme d\u2019un fichier ZIP organisé.'}
                    </p>
                  </div>
                )}
              </div>

              <div className={`rounded-[2rem] border-2 border-slate-100 bg-slate-50 p-5 transition-opacity ${goal === null ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="flex flex-col md:flex-row gap-3">
                  <Tooltip content={UI_TOOLTIPS.directoryIngestion.chooseDirectory} align="left">
                    <span className="flex-1">
                      <button
                        type="button"
                        onClick={() => setShowDirectoryPrompt(true)}
                        disabled={busy || goal === null}
                        className="w-full rounded-2xl bg-cam-green text-white px-5 py-4 font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-colors disabled:opacity-60"
                      >
                        Choisir un dossier
                      </button>
                    </span>
                  </Tooltip>
                  <Tooltip content={UI_TOOLTIPS.directoryIngestion.chooseFiles} align="right">
                    <span className="flex-1">
                      <button
                        type="button"
                        onClick={() => filesInputRef.current?.click()}
                        disabled={busy || goal === null}
                        className="w-full rounded-2xl bg-white border-2 border-slate-200 text-slate-700 px-5 py-4 font-black uppercase tracking-widest text-xs hover:border-slate-300 transition-colors disabled:opacity-60"
                      >
                        Choisir des fichiers
                      </button>
                    </span>
                  </Tooltip>
                </div>

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      {selectionLabel || 'Aucune sélection pour le moment'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedFiles.length > 0
                        ? `${selectedFiles.length} fichier(s) sélectionné(s) • ${formatFileSize(totalSelectedSize)}`
                        : 'Choisissez un dossier complet ou seulement quelques fichiers.'}
                    </p>
                  </div>
                  {(selectedFiles.length > 0 || unsupportedCount > 0) && (
                    <button
                      type="button"
                      onClick={resetSelection}
                      disabled={busy}
                      className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 disabled:opacity-60"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>

              <Tooltip content={UI_TOOLTIPS.directoryIngestion.recursive} align="left">
                <label className={`flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 transition-colors shadow-sm ${goal === null ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}`}>
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(e) => setRecursive(e.target.checked)}
                    disabled={goal === null}
                    className="w-5 h-5 accent-cam-green rounded"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-700">Conserver la lecture récursive du dossier</p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Les sous-dossiers restent visibles pendant la préparation et les chemins relatifs sont conservés.
                    </p>
                  </div>
                </label>
              </Tooltip>

              {unsupportedCount > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <span className="material-symbols-outlined text-slate-500 text-base shrink-0 mt-0.5">filter_alt_off</span>
                  <p>{unsupportedCount} fichier(s) non pris en charge seront signalés comme ignorés lors de la vérification.</p>
                </div>
              )}

              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">Voir les formats acceptés</summary>
                <div className="flex flex-wrap gap-2 mt-4">
                  {Array.from(SUPPORTED_EXTENSIONS).map((ext) => (
                    <span key={ext} className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider">
                      {ext}
                    </span>
                  ))}
                </div>
              </details>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                {selectStepError && (
                  <p className="text-xs font-medium text-amber-700 sm:mr-auto sm:max-w-xl">
                    {selectStepError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => goToStep('context')}
                  disabled={!canContinueFromSelect}
                  className="rounded-2xl bg-slate-900 text-white px-6 py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  Continuer vers la destination
                </button>
              </div>
            </div>
          )}

          {currentStep === 'context' && goal === 'local' && (
            <div className="space-y-6">
              <div className="rounded-[2rem] border-2 border-slate-100 bg-white p-5">
                <div className="mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Étape 2 · Destination locale</p>
                  <h3 className="mt-1 text-lg font-black uppercase italic tracking-tight text-slate-900">
                    Où ranger sur votre poste ?
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Rien n&apos;est envoyé au serveur. Les fichiers sont copiés tels quels dans les sous-dossiers proposés.
                  </p>
                </div>
                {supportsFileSystemAccess() ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLocalDestMode('fsa')}
                      className={`text-left rounded-2xl border-2 p-4 transition-all ${localDestMode === 'fsa' ? 'border-cam-green bg-green-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`material-symbols-outlined text-2xl shrink-0 ${localDestMode === 'fsa' ? 'text-cam-green' : 'text-slate-400'}`}>folder_managed</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black uppercase tracking-wide text-slate-800">Écrire dans un dossier de mon poste</p>
                          <p className="mt-1 text-xs text-slate-500 leading-snug">Les sous-dossiers sont créés directement à l&apos;emplacement choisi.</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalDestMode('zip')}
                      className={`text-left rounded-2xl border-2 p-4 transition-all ${localDestMode === 'zip' ? 'border-cam-green bg-green-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`material-symbols-outlined text-2xl shrink-0 ${localDestMode === 'zip' ? 'text-cam-green' : 'text-slate-400'}`}>folder_zip</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black uppercase tracking-wide text-slate-800">Télécharger un ZIP organisé</p>
                          <p className="mt-1 text-xs text-slate-500 leading-snug">Un fichier .zip avec la même arborescence, à extraire où vous voulez.</p>
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    Votre navigateur ne permet pas d&apos;écrire directement dans un dossier. Le rangement sera livré sous forme d&apos;un fichier ZIP organisé à télécharger.
                  </div>
                )}

                {localDestMode === 'fsa' && supportsFileSystemAccess() && (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dossier choisi</p>
                        <p className="mt-1 text-sm font-bold text-slate-700 truncate">
                          {localDirName || 'Aucun dossier sélectionné pour le moment'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Astuce : la boîte de dialogue propose un bouton <span className="font-bold">« Nouveau dossier »</span> en haut à gauche pour créer un emplacement dédié.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePickLocalDirectory}
                        disabled={busy}
                        className="rounded-2xl bg-cam-green text-white px-5 py-3 font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-colors disabled:opacity-60 shrink-0"
                      >
                        {localDirHandle ? 'Changer de dossier' : 'Choisir un dossier'}
                      </button>
                    </div>

                    {/* Wrapper optionnel : éviter d'avoir à utiliser le bouton
                        « Nouveau dossier » de la boîte Windows pour les utilisateurs
                        qui ne le connaissent pas. */}
                    {localDirHandle && (
                      <div className="rounded-2xl bg-white border border-slate-200 p-4">
                        <label htmlFor="local-wrapper-name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Créer un sous-dossier dédié <span className="font-medium text-slate-400 normal-case">(facultatif)</span>
                        </label>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <span className="text-xs text-slate-500 truncate min-w-0">
                            {localDirName} <span className="text-slate-300">/</span>
                          </span>
                          <input
                            id="local-wrapper-name"
                            type="text"
                            value={localWrapperName}
                            onChange={(e) => setLocalWrapperName(e.target.value)}
                            placeholder="ex. Rangement 2026"
                            disabled={busy}
                            maxLength={60}
                            className="flex-1 min-w-0 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-cam-green focus:outline-none disabled:opacity-60"
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Optionnel : tout part dans ce sous-dossier.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border-2 border-slate-100 bg-white p-5">
                <div className="mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stratégie de rangement</p>
                  <h3 className="mt-1 text-lg font-black uppercase italic tracking-tight text-slate-900">
                    Comment regrouper les fichiers ?
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {LOCAL_ARRANGEMENT_OPTIONS.map((option) => {
                    const isActive = localStrategy === option.value;
                    const isBusiness = option.value === 'by_business_rules';
                    const businessUnavailable = isBusiness && localRules !== null && localRules.length === 0;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setLocalStrategy(option.value)}
                        disabled={busy}
                        className={`text-left rounded-2xl border-2 p-4 transition-all disabled:opacity-60 ${isActive ? 'border-cam-green bg-green-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-black uppercase tracking-wide text-slate-800">{option.label}</p>
                          {isBusiness && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-700">
                              GED
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 leading-snug">{option.helper}</p>
                        {isBusiness && isLoadingLocalReference && (
                          <p className="mt-2 text-[11px] font-medium text-slate-400">
                            Chargement…
                          </p>
                        )}
                        {isBusiness && businessUnavailable && (
                          <p className="mt-2 text-[11px] font-medium text-amber-700">
                            Pas de règle : plan ou nom du fichier.
                          </p>
                        )}
                        {isBusiness &&
                          localLexicon &&
                          localLexicon.activities.length > 0 &&
                          localRules !== null &&
                          localRules.length === 0 && (
                            <p className="mt-2 text-[11px] font-medium text-slate-600">
                              Plan : {localLexicon.domains.length} domaines · {localLexicon.activities.length}{' '}
                              activités
                            </p>
                          )}
                        {isBusiness && localRules && localRules.length > 0 && (
                          <p className="mt-2 text-[11px] font-medium text-emerald-700">
                            {localRules.length} règle(s) active(s)
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => goToStep('select')}
                  disabled={busy}
                  className="rounded-2xl bg-white border-2 border-slate-200 text-slate-700 px-5 py-3 font-black uppercase tracking-widest text-xs hover:border-slate-300 transition-colors disabled:opacity-60"
                >
                  Revenir à la sélection
                </button>
                <button
                  type="button"
                  onClick={() => goToStep('review')}
                  disabled={!canContinueFromContext || busy}
                  className="rounded-2xl bg-slate-900 text-white px-6 py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  Voir l&apos;aperçu du rangement
                </button>
              </div>
            </div>
          )}

          {currentStep === 'context' && goal !== 'local' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-3 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Ces documents concernent
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
                        className={`text-left p-5 rounded-2xl border-2 transition-all ${sourceScope === option.value ? 'border-cam-green bg-green-50/50 shadow-md' : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'}`}
                      >
                        <p className="font-black text-slate-800 text-sm">{option.label}</p>
                        <p className="text-xs text-slate-500 mt-1 leading-snug">{option.helper}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {sourceScope !== 'person' && (
                  <div className="space-y-2 xl:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Service de destination
                    </label>
                    <select
                      value={targetOrgUnitId}
                      onChange={(e) => {
                        setTargetOrgUnitId(e.target.value);
                        clearBatchState();
                      }}
                      disabled={busy}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none shadow-sm"
                    >
                      <option value="">
                        {requiresTargetOrgUnit ? '-- Choisir un service --' : '-- Service de votre profil --'}
                      </option>
                      {orgUnits.map((orgUnit) => (
                        <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 italic ml-1">
                      {requiresTargetOrgUnit
                        ? 'Votre profil n’est pas rattaché à un service. Ce choix est obligatoire.'
                        : 'Laissez vide pour utiliser automatiquement le service de votre profil.'}
                    </p>
                  </div>
                )}

                {sourceScope === 'person' && (
                  <>
                    <div className="space-y-2 xl:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Agent concerné
                      </label>
                      <select
                        value={targetUserId}
                        onChange={(e) => {
                          setTargetUserId(e.target.value);
                          clearBatchState();
                        }}
                        disabled={busy}
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none shadow-sm"
                      >
                        <option value="">-- Choisir un agent --</option>
                        {ownerOptions.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.full_name} {user.role_label ? `- ${user.role_label}` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 italic ml-1">
                        Requis uniquement pour un classement personnel. Le service sera repris depuis l’agent choisi.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p className="font-bold text-slate-700">Service repris automatiquement</p>
                      <p className="mt-1">
                        {selectedUser?.org_unit_id
                          ? orgUnitsById.get(selectedUser.org_unit_id) || 'Service de l’agent'
                          : 'Le service sera repris automatiquement depuis le profil de l’agent choisi.'}
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Année
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
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 shadow-sm"
                  />
                  <p className="text-[11px] text-slate-400 italic ml-1">
                    Laissez vide pour laisser le système proposer l’année la plus adaptée.
                  </p>
                </div>

                <div className="space-y-2 xl:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Catégorie documentaire
                  </label>
                  <select
                    value={defaultCategoryId}
                    onChange={(e) => {
                      setDefaultCategoryId(e.target.value);
                      clearBatchState();
                    }}
                    disabled={busy}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none shadow-sm"
                  >
                    <option value="">-- Aucune catégorie imposée --</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 italic ml-1">
                    {defaultCategory
                      ? `Tous les fichiers seront préparés avec la catégorie "${defaultCategory.name}".`
                      : 'Laissez vide si vous acceptez une préparation sans catégorie documentaire imposée.'}
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
                    <p>Sans catégorie documentaire explicite, certaines règles de classement ou certains circuits risquent de ne pas se déclencher.</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => goToStep('select')}
                  className="rounded-2xl border border-slate-200 bg-white text-slate-700 px-6 py-4 font-black uppercase tracking-widest text-xs hover:border-slate-300 transition-colors"
                >
                  Retour à la sélection
                </button>
                <button
                  type="button"
                  onClick={() => goToStep('review')}
                  disabled={!canContinueFromContext}
                  className="rounded-2xl bg-slate-900 text-white px-6 py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  Continuer vers la vérification
                </button>
              </div>
            </div>
          )}

          {currentStep === 'review' && goal === 'local' && effectiveLocalTree && (
            <div className="space-y-6">
              {libraryReplayStubMode ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex gap-3 items-start">
                  <span className="material-symbols-outlined text-lg shrink-0 text-amber-700" aria-hidden>
                    info
                  </span>
                  <p className="leading-relaxed">
                    <span className="font-black uppercase tracking-wide text-[10px] text-amber-900">
                      Aperçu seul
                    </span>
                    <span className="block mt-1">
                      Pas de fichiers sur ce navigateur : nouvelle lecture du dossier à l&apos;étape 1 pour copier ou ZIP.
                    </span>
                  </p>
                </div>
              ) : null}
              <div className="rounded-[2rem] border-2 border-slate-100 bg-white p-5">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Étape 3 · Aperçu</p>
                    <h3 className="mt-1 text-lg font-black uppercase italic tracking-tight text-slate-900">
                      Arborescence proposée
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {effectiveLocalTree.total} fichier(s) · {formatFileSize(effectiveLocalTree.totalBytes)} · {effectiveLocalTree.folders.length} dossier(s) à créer
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-3xl text-slate-300">account_tree</span>
                </div>

                {localAmbiguousFiles.length > 0 && localTree && (
                  <div className="mb-4 rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-4">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-xl text-amber-700 shrink-0">help</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-wide text-amber-900">
                          Plusieurs dossiers possibles
                        </p>
                        <p className="mt-1 text-xs text-amber-900/90">
                          Pour les fichiers ci-dessous, plusieurs rattachements du plan de classement sont aussi plausibles.
                          Choisissez le dossier qui correspond le mieux : l&apos;aperçu, la copie et le ZIP utiliseront ce choix.
                        </p>
                        <ul className="mt-3 space-y-4">
                          {localAmbiguousFiles.map((row) => {
                            const key = localArrangementFileKey(row.file);
                            const arrangementRow = localTree.files.find(
                              (r) => localArrangementFileKey(r.file) === key,
                            );
                            const primaryPath = arrangementRow?.folderPath ?? row.folderPath;
                            const groupName = `local-taxonomy-${key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)}`;
                            return (
                              <li key={key} className="rounded-xl border border-amber-200/80 bg-white p-3">
                                <p className="text-xs font-bold text-slate-800 truncate" title={row.file.name}>
                                  {row.file.name}
                                </p>
                                <fieldset className="mt-2 space-y-2 border-0 p-0">
                                  <legend className="sr-only">Dossier pour {row.file.name}</legend>
                                  {row.taxonomyCandidates!.map((c) => (
                                    <label
                                      key={c.folderPath}
                                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                                        row.folderPath === c.folderPath
                                          ? 'border-amber-400 bg-amber-50'
                                          : 'border-slate-100 bg-slate-50/80 hover:border-slate-200'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={groupName}
                                        className="mt-0.5 shrink-0"
                                        checked={row.folderPath === c.folderPath}
                                        onChange={() => {
                                          setLocalPathOverrides((prev) => {
                                            const next = { ...prev };
                                            if (c.folderPath === primaryPath) delete next[key];
                                            else next[key] = c.folderPath;
                                            return next;
                                          });
                                        }}
                                      />
                                      <span className="min-w-0 flex-1">
                                        <span className="font-semibold text-slate-800 block break-all">{c.folderPath}</span>
                                        <span className="text-[11px] text-slate-500">
                                          {c.domainName} · {c.activityName}
                                          {c.folderPath === primaryPath ? ' · proposition par défaut' : ''}
                                        </span>
                                      </span>
                                    </label>
                                  ))}
                                </fieldset>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {effectiveLocalTree.folders.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                    Aucun fichier à ranger pour le moment.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white max-h-96 overflow-auto custom-scrollbar">
                    {effectiveLocalTree.folders.map((folder) => (
                      <li key={folder.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-slate-400 text-base shrink-0">folder</span>
                          <span className="text-sm font-bold text-slate-700 truncate">{folder.path || '(racine)'}</span>
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {folder.count} fichier(s) · {formatFileSize(folder.bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isLocalRunning && localProgress && (
                <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">Rangement en cours…</p>
                    <p className="text-xs font-mono">{localProgress.written} / {localProgress.total}</p>
                  </div>
                  {localProgress.current && (
                    <p className="mt-1 text-xs text-blue-700 truncate">{localProgress.current}</p>
                  )}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{
                        width: `${localProgress.total > 0 ? Math.round((localProgress.written / localProgress.total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => goToStep('context')}
                  disabled={busy}
                  className="rounded-2xl bg-white border-2 border-slate-200 text-slate-700 px-5 py-3 font-black uppercase tracking-widest text-xs hover:border-slate-300 transition-colors disabled:opacity-60"
                >
                  Modifier la stratégie
                </button>
                <button
                  type="button"
                  onClick={handleLocalRun}
                  disabled={
                    busy ||
                    libraryReplayStubMode ||
                    effectiveLocalTree.total === 0 ||
                    (localDestMode === 'fsa' && !localDirHandle)
                  }
                  className="rounded-2xl bg-cam-green text-white px-6 py-4 font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {isLocalRunning
                    ? 'Rangement en cours…'
                    : localDestMode === 'fsa'
                      ? 'Créer les dossiers et copier'
                      : 'Télécharger le ZIP organisé'}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'review' && goal !== 'local' && (
            <div className="space-y-8">
              <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700">Les fichiers sont vérifiés sans créer de documents définitifs.</p>
                  <p className="text-xs text-slate-400 mt-1">L’aperçu montre les fichiers prêts, à vérifier, ignorés ou déjà présents.</p>
                </div>
                <Tooltip content={analyzeTooltip} align="right">
                  <span>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={busy || selectedFiles.length === 0}
                      className="rounded-2xl bg-slate-900 text-white px-6 py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors disabled:opacity-60"
                    >
                      {isAnalyzing ? 'Vérification en cours...' : 'Vérifier le classement'}
                    </button>
                  </span>
                </Tooltip>
              </div>

              {previewJob ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryCard label="Fichiers analysés" value={previewJob.total_files} icon="inventory_2" color="bg-slate-800" />
                    <SummaryCard label={commitResult ? 'Importés' : 'Prêts'} value={statusCardValue} icon={commitResult ? 'check_circle' : 'task_alt'} color="bg-cam-green" />
                    <SummaryCard label="À revoir" value={previewCounts.needsReview + previewCounts.pending} icon="rule" color="bg-amber-500" />
                    <SummaryCard label="Ignorés / doublons" value={previewCounts.duplicate + previewCounts.ignored} icon="filter_alt_off" color="bg-blue-500" />
                  </div>

                  <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-[0.2em]">
                          <tr>
                            <th className="px-5 py-4 text-left">Document</th>
                            <th className="px-5 py-4 text-left">Classement proposé</th>
                            <th className="px-5 py-4 text-left">Destination</th>
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
                                  <p className="text-xs text-slate-400 mt-1">
                                    {formatDetectedType(item)} • {formatFileSize(item.file_size)}{item.resolved_year ? ` • ${item.resolved_year}` : ''}
                                  </p>
                                </td>
                                <td className="px-5 py-4 min-w-[240px]">
                                  <p className="text-slate-700 font-medium">{getItemCategoryName(item)}</p>
                                  <p className="text-xs text-slate-400 mt-1">{getItemWorkflowLabel(item)}</p>
                                </td>
                                <td className="px-5 py-4 min-w-[260px]">
                                  <p className="text-slate-700 font-medium break-words">{getItemTargetLabel(item)}</p>
                                  {item.error_message && (
                                    <p className="text-xs text-slate-400 mt-1">{item.error_message}</p>
                                  )}
                                </td>
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
                  <p className="text-sm font-bold text-slate-600 mt-3">Aucune vérification lancée pour le moment.</p>
                  <p className="text-xs text-slate-400 mt-1">Confirmez la destination, puis lancez la vérification.</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => goToStep('context')}
                  className="rounded-2xl border border-slate-200 bg-white text-slate-700 px-6 py-4 font-black uppercase tracking-widest text-xs hover:border-slate-300 transition-colors"
                >
                  Modifier la destination
                </button>
                <button
                  type="button"
                  onClick={() => goToStep('confirm')}
                  disabled={!canContinueFromReview}
                  className="rounded-2xl bg-slate-900 text-white px-6 py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  Continuer vers l’import
                </button>
              </div>
            </div>
          )}

          {currentStep === 'confirm' && goal === 'local' && localResult && effectiveLocalTree && (
            <div className="space-y-6">
              <div className="rounded-[2rem] border-2 border-cam-green/30 bg-green-50/40 p-6">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-4xl text-cam-green shrink-0">task_alt</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-cam-green">Étape 4 · Terminé</p>
                    <h3 className="mt-1 text-2xl font-black uppercase italic tracking-tight text-slate-900">
                      {localResultMode === 'zip' ? 'ZIP organisé téléchargé' : 'Rangement local effectué'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {localResult.ok} fichier(s) rangé(s)
                      {localResult.errors.length > 0 ? ` · ${localResult.errors.length} en erreur` : ''}
                      {localResultMode === 'fsa' && localDirName
                        ? ` · dans « ${localDirName}${localWrapperName.trim() ? `/${localWrapperName.trim()}` : ''} »`
                        : ''}.
                    </p>
                    {localResultMode === 'zip' && (
                      <p className="mt-2 text-xs text-slate-500">
                        Le fichier a été placé dans le dossier <span className="font-bold">Téléchargements</span> de votre navigateur.
                        Il vous reste à l&apos;extraire à l&apos;endroit voulu.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Récap chiffré : ce qui a été créé / ce qui reste à arbitrer. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border-2 border-slate-100 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dossiers créés</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{effectiveLocalTree.foldersCreated}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Dont <span className="font-bold">{effectiveLocalTree.foldersCreated - effectiveLocalTree.foldersUnranged}</span> bien classés
                    {effectiveLocalTree.foldersUnranged > 0 ? ` · ${effectiveLocalTree.foldersUnranged} d'arbitrage` : ''}.
                  </p>
                </div>
                <div className="rounded-2xl border-2 border-slate-100 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fichiers rangés</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{localResult.ok}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Sur {effectiveLocalTree.total} fichier(s) sélectionné(s).
                  </p>
                </div>
                <div className={`rounded-2xl border-2 p-4 ${effectiveLocalTree.filesUnranged > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${effectiveLocalTree.filesUnranged > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                    À arbitrer
                  </p>
                  <p className={`mt-1 text-3xl font-black ${effectiveLocalTree.filesUnranged > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
                    {effectiveLocalTree.filesUnranged}
                  </p>
                  <p className={`mt-1 text-xs ${effectiveLocalTree.filesUnranged > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                    {effectiveLocalTree.filesUnranged > 0
                      ? 'Fichiers rangés dans « Autres » ou dossier année « Sans date » (segment Sans_date).'
                      : 'Aucun fichier en attente d\u2019arbitrage. '}
                  </p>
                </div>
              </div>

              {/* Bloc d'arbitrage : seulement si quelque chose à arbitrer. */}
              {effectiveLocalTree.filesUnranged > 0 && (
                <div className="rounded-[2rem] border-2 border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-2xl text-amber-600 shrink-0">rule_folder</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase tracking-wide text-amber-800">À vous d&apos;arbitrer</p>
                      <p className="mt-1 text-sm text-amber-800">
                        <span className="font-bold">{effectiveLocalTree.filesUnranged}</span> fichier(s) que le système n&apos;a pas su classer avec confiance se trouvent dans
                        <span className="font-bold"> &laquo;&nbsp;Autres&nbsp;&raquo;</span>
                        {effectiveLocalTree.folders.some((f) => f.path.includes(SANS_DATE)) ? ' ou ' : ''}
                        {effectiveLocalTree.folders.some((f) => f.path.includes(SANS_DATE)) && (
                          <span className="font-bold">&laquo;&nbsp;Sans date&nbsp;&raquo; ({SANS_DATE})</span>
                        )}
                        . Vous pouvez :
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-amber-800 list-disc pl-5">
                        <li>les <span className="font-bold">déplacer</span> dans un des dossiers déjà créés (PDF, Tableurs, Images, etc.) ;</li>
                        <li>ou <span className="font-bold">créer un nouveau dossier</span> de votre choix sur votre poste et y déplacer les fichiers.</li>
                      </ul>
                      {effectiveLocalTree.folders.filter((f) => f.catchAll).length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-amber-900">
                          {effectiveLocalTree.folders
                            .filter((f) => f.catchAll)
                            .map((folder) => (
                              <li key={folder.path} className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">folder_special</span>
                                <span className="font-bold">{folder.path}</span>
                                <span className="text-amber-700">— {folder.count} fichier(s)</span>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {localResult.errors.length > 0 && (
                <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-black text-rose-800">Fichiers en erreur</p>
                  <ul className="mt-2 space-y-1 text-xs text-rose-800 max-h-48 overflow-auto custom-scrollbar">
                    {localResult.errors.map((err, idx) => (
                      <li key={`${err.file}-${idx}`} className="truncate">
                        <span className="font-bold">{err.file}</span> — {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={resetSelection}
                  disabled={busy}
                  className="rounded-2xl bg-white border-2 border-slate-200 text-slate-700 px-5 py-3 font-black uppercase tracking-widest text-xs hover:border-slate-300 transition-colors disabled:opacity-60"
                >
                  Ranger un autre lot
                </button>
              </div>
            </div>
          )}

          {currentStep === 'confirm' && goal !== 'local' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
                    <span className="material-symbols-outlined text-slate-500 mt-0.5">account_tree</span>
                    <div>
                      <p className="font-bold text-slate-700">Niveau retenu</p>
                      <p>{SOURCE_SCOPE_OPTIONS.find((option) => option.value === sourceScope)?.label || sourceScope}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
                    <span className="material-symbols-outlined text-slate-500 mt-0.5">domain</span>
                    <div>
                      <p className="font-bold text-slate-700">Destination finale</p>
                      <p>
                        {sourceScope === 'person'
                          ? (selectedUser?.full_name || 'Agent concerné requis')
                          : (orgUnitsById.get(resolvedTargetOrgUnitId) || 'Service de votre profil')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
                    <span className="material-symbols-outlined text-slate-500 mt-0.5">calendar_today</span>
                    <div>
                      <p className="font-bold text-slate-700">Année imposée</p>
                      <p>{forcedYearInput.trim() ? forcedYearInput : 'Aucune année forcée'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Résumé avant import</p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-slate-500 text-sm">Fichiers analysés</p>
                      <p className="text-3xl font-black italic text-slate-900">{previewJob?.supported_files || 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">Prêts à importer</p>
                      <p className="text-3xl font-black italic text-slate-900">{importableCount}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">À revoir</p>
                      <p className="text-3xl font-black italic text-slate-900">{previewCounts.needsReview + previewCounts.pending}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">Ignorés / doublons</p>
                      <p className="text-3xl font-black italic text-slate-900">{previewCounts.duplicate + previewCounts.ignored}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                    Les fichiers prêts seront importés maintenant. Les cas à vérifier, en attente ou déjà présents resteront dans le suivi sans être importés automatiquement.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => goToStep('review')}
                    className="rounded-2xl border border-slate-200 bg-white text-slate-700 px-6 py-4 font-black uppercase tracking-widest text-xs hover:border-slate-300 transition-colors"
                  >
                    Retour à la vérification
                  </button>

                  <Tooltip content={commitTooltip} align="left">
                    <span>
                      <button
                        type="button"
                        onClick={handleCommit}
                        disabled={busy || !analyzedJob || importableCount === 0}
                        className="rounded-2xl bg-cam-green text-white px-6 py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
                      >
                        {isCommitting ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Import en cours...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xl">drive_folder_upload</span>
                            Importer les documents
                          </>
                        )}
                      </button>
                    </span>
                  </Tooltip>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  {analyzedJob
                    ? importableCount > 0
                      ? 'Seuls les fichiers prêts seront importés. Les autres resteront à traiter manuellement.'
                      : 'Aucun fichier n’est prêt à être importé pour le moment.'
                    : 'L’import reste indisponible tant que la vérification n’a pas été produite.'}
                </p>
              </div>

              <Tooltip content={UI_TOOLTIPS.directoryIngestion.batchSummary} align="right">
                <div className="rounded-[2rem] border border-blue-100 bg-blue-50 p-5 space-y-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Avant de lancer l’import</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        Vérifiez surtout le nombre de fichiers prêts et les documents qui devront être repris.
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-blue-400">lightbulb</span>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-base text-blue-500 mt-0.5">check_circle</span>
                      <span>{importableCount} fichier(s) peuvent partir immédiatement en import.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-base text-amber-500 mt-0.5">rule</span>
                      <span>{previewCounts.needsReview + previewCounts.pending} fichier(s) devront être revus manuellement.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-base text-slate-500 mt-0.5">filter_alt_off</span>
                      <span>{previewCounts.duplicate + previewCounts.ignored} fichier(s) seront laissés de côté.</span>
                    </li>
                  </ul>
                </div>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {commitResult && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Importés" value={commitResult.imported_documents} icon="check_circle" color="bg-cam-green" />
            <SummaryCard label="À arbitrer" value={commitResult.pending_review_items} icon="rule" color="bg-amber-500" />
            <SummaryCard label="Doublons" value={previewCounts.duplicate} icon="content_copy" color="bg-blue-500" />
            <SummaryCard label="Erreurs" value={commitResult.failed_items} icon="error" color="bg-red-500" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="p-8 rounded-[2.5rem] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 italic">
                Documents importés ({previewJob?.items.filter((item) => item.status === 'imported').length || 0})
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

            <div className="p-8 rounded-[2.5rem] border border-amber-200 bg-amber-50 shadow-[0_16px_40px_rgba(245,158,11,0.08)]">
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
                          <p className="text-[11px] text-slate-500 mt-2">{item.error_message || statusMeta.helper || 'À vérifier avant traitement complémentaire.'}</p>
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
  <div className="p-6 rounded-[2rem] border border-slate-200 bg-white shadow-sm text-center">
    <div className={`w-12 h-12 ${color} text-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
      <span className="material-symbols-outlined text-xl">{icon}</span>
    </div>
    <p className="text-3xl font-black text-slate-800 italic">{value}</p>
    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</p>
  </div>
);

export default DirectoryIngestion;
