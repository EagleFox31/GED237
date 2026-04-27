import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../services/api';
import { categoriesApi, DocumentCategory } from '../../../services/categories.api';
import { useAuthStore } from '../../../stores/authStore';
import { Document } from '../../../types';

interface IngestFileDetail {
  document_id: string;
  filename: string;
  title: string;
  mime_type: string;
  file_size: number;
  rules_matched: string[];
  ocr_queued: boolean;
}

interface IngestError {
  file: string;
  error: string;
}

interface IngestResult {
  total_found: number;
  imported: number;
  skipped: number;
  error_count: number;
  errors: IngestError[];
  details: IngestFileDetail[];
}

interface UploadProgress {
  completed: number;
  total: number;
  currentFile?: string;
}

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.txt', '.csv', '.rtf',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.webp',
]);

const OCR_MIME_TYPES = new Set(['application/pdf']);

const getFileExtension = (filename: string) => {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : '';
};

const isSupportedFile = (file: File) => SUPPORTED_EXTENSIONS.has(getFileExtension(file.name));

const deriveTitle = (filename: string) =>
  filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();

const buildIngestErrorMessage = (error: any) => {
  if (error?.status === 409) {
    return 'Un fichier identique existe deja dans ce tenant.';
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }
  if (error?.status === 400) {
    return 'Le document a ete rejete par les validations du serveur.';
  }
  return "L'import du fichier a echoue.";
};

const DirectoryIngestion: React.FC = () => {
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const userProfile = useAuthStore((state) => state.userProfile);

  const [recursive, setRecursive] = useState(true);
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [targetOrgUnitId, setTargetOrgUnitId] = useState('');
  const [processingMode, setProcessingMode] = useState<'archive' | 'process'>('archive');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectionLabel, setSelectionLabel] = useState('');
  const [unsupportedCount, setUnsupportedCount] = useState(0);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesApi.list(false).then(setCategories).catch(console.error);
    api.getOrgUnits().then(setOrgUnits).catch(console.error);
  }, []);

  useEffect(() => {
    const directoryInput = directoryInputRef.current;
    if (directoryInput) {
      directoryInput.setAttribute('webkitdirectory', '');
      directoryInput.setAttribute('directory', '');
      directoryInput.multiple = true;
    }
  }, []);

  const totalSelectedSize = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + file.size, 0),
    [selectedFiles],
  );

  const defaultCategory = useMemo(
    () => categories.find((category) => category.id === defaultCategoryId) || null,
    [categories, defaultCategoryId],
  );

  const requiresTargetOrgUnit = !userProfile?.orgUnitId;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const resetSelection = () => {
    setSelectedFiles([]);
    setSelectionLabel('');
    setUnsupportedCount(0);
    if (directoryInputRef.current) directoryInputRef.current.value = '';
    if (filesInputRef.current) filesInputRef.current.value = '';
  };

  const handlePickedFiles = (files: FileList | null, source: 'directory' | 'files') => {
    if (!files || files.length === 0) {
      return;
    }

    const allFiles = Array.from(files);
    const supportedFiles = allFiles.filter(isSupportedFile);
    const ignoredFiles = allFiles.length - supportedFiles.length;

    setSelectedFiles(supportedFiles);
    setUnsupportedCount(ignoredFiles);
    setResult(null);
    setError(
      supportedFiles.length === 0
        ? 'Aucun fichier supporte n a ete trouve dans votre selection.'
        : null,
    );

    if (source === 'directory' && supportedFiles.length > 0) {
      const firstRelativePath = supportedFiles[0]?.webkitRelativePath || '';
      const rootName = firstRelativePath.split('/').filter(Boolean)[0] || 'Dossier selectionne';
      setSelectionLabel(rootName);
      return;
    }

    setSelectionLabel(
      source === 'directory'
        ? 'Dossier selectionne'
        : `${supportedFiles.length} fichier(s) selectionne(s)`,
    );
  };

  const handleIngest = async () => {
    if (selectedFiles.length === 0) {
      setError('Selectionnez d abord un dossier ou des fichiers a importer.');
      return;
    }
    if (requiresTargetOrgUnit && !targetOrgUnitId) {
      setError('Choisissez le service cible auquel rattacher les documents importes.');
      return;
    }

    setIsIngesting(true);
    setError(null);
    setResult(null);
    setProgress({ completed: 0, total: selectedFiles.length });

    const details: IngestFileDetail[] = [];
    const errors: IngestError[] = [];

    for (const [index, file] of selectedFiles.entries()) {
      setProgress({
        completed: index,
        total: selectedFiles.length,
        currentFile: file.webkitRelativePath || file.name,
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', deriveTitle(file.name) || file.name);
      formData.append('processing_mode', processingMode);
      if (targetOrgUnitId) {
        formData.append('org_unit_id', targetOrgUnitId);
      }
      if (defaultCategoryId) {
        formData.append('document_category_id', defaultCategoryId);
      }
      if (file.webkitRelativePath) {
        formData.append('description', `Import en masse depuis ${file.webkitRelativePath}`);
      }
      formData.append('tags', 'import-auto,bulk-upload');

      try {
        const document = await api.uploadDocument(formData) as Document;
        const mimeType =
          document.mime_type || document.file_type || file.type || 'application/octet-stream';
        details.push({
          document_id: document.id,
          filename: file.webkitRelativePath || file.name,
          title: document.title,
          mime_type: mimeType,
          file_size: document.file_size || file.size,
          rules_matched: [],
          ocr_queued: mimeType.startsWith('image/') || OCR_MIME_TYPES.has(mimeType),
        });
      } catch (uploadError: any) {
        errors.push({
          file: file.webkitRelativePath || file.name,
          error: buildIngestErrorMessage(uploadError),
        });
      }
    }

    const ingestResult: IngestResult = {
      total_found: selectedFiles.length + unsupportedCount,
      imported: details.length,
      skipped: unsupportedCount,
      error_count: errors.length,
      errors,
      details,
    };

    setResult(ingestResult);
    setProgress({
      completed: selectedFiles.length,
      total: selectedFiles.length,
      currentFile: undefined,
    });
    setIsIngesting(false);
  };

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-32">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-green/10 text-cam-green rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-green/20">
          Import en Masse
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">
          Ingestion <span className="text-cam-green">Repertoire</span>
        </h2>
        <p className="text-slate-500 mt-2 font-medium italic text-lg">
          Selectionnez un dossier ou plusieurs fichiers locaux, puis importez-les dans la GED via un upload reel au serveur.
        </p>
      </div>

      <div className="glass p-10 rounded-[3rem] bg-white/60 border-white space-y-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 bg-cam-green text-white rounded-xl flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-xl">folder_open</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">
            Configuration de l'import
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

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Source locale
            </label>
            <div className="rounded-[2rem] border-2 border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-col md:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => directoryInputRef.current?.click()}
                  disabled={isIngesting}
                  className="flex-1 rounded-2xl bg-cam-green text-white px-5 py-4 font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  Choisir un dossier
                </button>
                <button
                  type="button"
                  onClick={() => filesInputRef.current?.click()}
                  disabled={isIngesting}
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
                      ? `${selectedFiles.length} fichier(s) supporte(s) - ${formatSize(totalSelectedSize)}`
                      : 'Formats supportes : PDF, Office, texte et images usuelles'}
                  </p>
                </div>
                {(selectedFiles.length > 0 || unsupportedCount > 0) && (
                  <button
                    type="button"
                    onClick={resetSelection}
                    disabled={isIngesting}
                    className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 disabled:opacity-60"
                  >
                    Reinitialiser
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Service cible
              </label>
              <select
                value={targetOrgUnitId}
                onChange={(e) => setTargetOrgUnitId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none"
                disabled={isIngesting}
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
                  ? "Votre profil admin n'est pas rattache a un service. Choisissez l'unite qui possedera les documents."
                  : "Laissez vide pour utiliser automatiquement le service de votre profil."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Categorie par defaut
              </label>
              <select
                value={defaultCategoryId}
                onChange={(e) => setDefaultCategoryId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none"
              >
                <option value="">-- Aucune categorie imposee --</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 italic ml-1">
                {defaultCategory
                  ? `Tous les fichiers seront importes sous "${defaultCategory.name}".`
                  : 'Laissez vide seulement si vous acceptez un import sans type documentaire impose.'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Options
            </label>
            <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
                className="w-5 h-5 accent-cam-green rounded"
              />
              <div>
                <p className="text-sm font-bold text-slate-700">Scanner les sous-dossiers</p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Option informative : utilisez "Choisir un dossier" pour conserver l'arborescence selectionnee.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
            Que voulez-vous faire de ces fichiers ?
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProcessingMode('archive')}
              disabled={isIngesting}
              className={`text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-3 ${processingMode === 'archive' ? 'border-cam-green bg-green-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${processingMode === 'archive' ? 'border-cam-green' : 'border-slate-300'}`}>
                {processingMode === 'archive' && <div className="w-2.5 h-2.5 rounded-full bg-cam-green" />}
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">folder</span>
                  Juste les ranger
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  Classement seul. <span className="font-bold">Aucun circuit declenche</span>. Recommande pour la migration initiale.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setProcessingMode('process')}
              disabled={isIngesting}
              className={`text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-3 ${processingMode === 'process' ? 'border-cam-green bg-green-50/50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${processingMode === 'process' ? 'border-cam-green' : 'border-slate-300'}`}>
                {processingMode === 'process' && <div className="w-2.5 h-2.5 rounded-full bg-cam-green" />}
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">settings</span>
                  Les ranger et lancer le traitement
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  Si une regle d'aiguillage correspond, <span className="font-bold">le circuit demarre automatiquement.</span>
                </p>
              </div>
            </button>
          </div>
          {processingMode === 'archive' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">info</span>
              <p>Les fichiers seront <span className="font-bold">archives sans declencher de validation.</span> Vous pourrez lancer un circuit a posteriori depuis la fiche du document.</p>
            </div>
          )}
          {processingMode === 'process' && !defaultCategoryId && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
              <span className="material-symbols-outlined text-blue-600 text-base shrink-0 mt-0.5">info</span>
              <p>Sans categorie documentaire explicite, les regles d'aiguillage basees sur le type risquent de ne pas se declencher.</p>
            </div>
          )}
          {unsupportedCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <span className="material-symbols-outlined text-slate-500 text-base shrink-0 mt-0.5">filter_alt_off</span>
              <p>{unsupportedCount} fichier(s) non supporte(s) seront ignore(s) pendant l'import.</p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
            <span className="material-symbols-outlined text-red-500">error</span>
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        {progress && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-600 uppercase tracking-widest">
              <span>Progression</span>
              <span>{progress.completed}/{progress.total}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-cam-green transition-all"
                style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
              />
            </div>
            {progress.currentFile && (
              <p className="mt-3 text-xs text-slate-500 font-medium truncate">
                Fichier en cours : {progress.currentFile}
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleIngest}
          disabled={isIngesting || selectedFiles.length === 0}
          className="w-full py-5 bg-cam-green text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-green-200 hover:bg-green-700 hover:scale-[1.01] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-3"
        >
          {isIngesting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Upload et import en cours...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-2xl">drive_folder_upload</span>
              Lancer l'ingestion
            </>
          )}
        </button>
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

      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Fichiers trouves" value={result.total_found} icon="search" color="bg-slate-800" />
            <SummaryCard label="Importes" value={result.imported} icon="check_circle" color="bg-cam-green" />
            <SummaryCard label="Ignores" value={result.skipped} icon="block" color="bg-cam-yellow" />
            <SummaryCard label="Erreurs" value={result.error_count} icon="error" color="bg-red-500" />
          </div>

          {result.details.length > 0 && (
            <div className="glass p-8 rounded-[2.5rem] bg-white/60 border-white">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 italic">
                Documents importes ({result.details.length})
              </h4>
              <div className="space-y-3">
                {result.details.map((file) => (
                  <div key={file.document_id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-50 hover:border-green-100 transition-colors">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-cam-green">description</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 uppercase italic truncate">{file.filename}</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {formatSize(file.file_size)} • {file.mime_type}
                        {file.ocr_queued && <span className="text-blue-500 ml-2">OCR en file d'attente</span>}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-green-400 text-lg">check_circle</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="glass p-8 rounded-[2.5rem] bg-red-50/50 border-red-100">
              <h4 className="text-sm font-black uppercase tracking-widest text-red-400 mb-6 italic">
                Erreurs ({result.errors.length})
              </h4>
              <div className="space-y-3">
                {result.errors.map((ingestError, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-red-100">
                    <span className="material-symbols-outlined text-red-400">warning</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate font-mono">{ingestError.file}</p>
                      <p className="text-[10px] text-red-500 font-medium">{ingestError.error}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
