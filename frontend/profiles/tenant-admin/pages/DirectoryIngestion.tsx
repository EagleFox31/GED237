import React, { useState } from 'react';
import { api } from '../../../services/api';

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

const DirectoryIngestion: React.FC = () => {
  const [directoryPath, setDirectoryPath] = useState('');
  const [recursive, setRecursive] = useState(true);
  const [defaultCategory, setDefaultCategory] = useState('');
  const [processingMode, setProcessingMode] = useState<'archive' | 'process'>('archive');
  const [isIngesting, setIsIngesting] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleIngest = async () => {
    if (!directoryPath.trim()) {
      setError("Veuillez saisir un chemin de répertoire.");
      return;
    }

    setIsIngesting(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.ingestDirectory(
        directoryPath.trim(),
        recursive,
        defaultCategory.trim() || undefined,
        processingMode,
      );
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'ingestion");
    } finally {
      setIsIngesting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-32">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-green/10 text-cam-green rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-green/20">
          Import en Masse
        </div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">
          Ingestion <span className="text-cam-green">Répertoire</span>
        </h2>
        <p className="text-slate-500 mt-2 font-medium italic text-lg">
          Scannez un dossier local et importez automatiquement tous les documents dans la GED.
        </p>
      </div>

      {/* Config Form */}
      <div className="glass p-10 rounded-[3rem] bg-white/60 border-white space-y-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 bg-cam-green text-white rounded-xl flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-xl">folder_open</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">
            Configuration de l'import
          </h3>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Chemin du répertoire source
            </label>
            <input
              type="text"
              value={directoryPath}
              onChange={(e) => setDirectoryPath(e.target.value)}
              placeholder="Ex: C:\Documents\Inbox ou /home/user/documents"
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 px-5 font-bold text-slate-700 outline-none focus:border-cam-green/50 focus:ring-4 focus:ring-green-500/10 transition-all font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Catégorie par défaut
              </label>
              <select
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none"
              >
                <option value="">-- Aucune (classement par règles) --</option>
                <option value="Note">Note de Service</option>
                <option value="Courrier">Courrier</option>
                <option value="Facture">Facture / Bordereau</option>
                <option value="Rapport">Rapport</option>
                <option value="Contrat">Contrat</option>
                <option value="Autre">Autre Document</option>
              </select>
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
                  <p className="text-[10px] text-slate-400 font-medium">Inclure récursivement tous les fichiers des sous-répertoires</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Mode de traitement — choix critique pour migration vs flux courant */}
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
                  Classement seul. <span className="font-bold">Aucun circuit déclenché</span>, même si des règles correspondent. <span className="italic">Recommandé pour la migration initiale.</span>
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
                  Pour chaque fichier dont le type correspond à une règle, <span className="font-bold">le circuit démarre automatiquement.</span>
                </p>
              </div>
            </button>
          </div>
          {processingMode === 'archive' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">info</span>
              <p>Les fichiers seront <span className="font-bold">archivés sans déclencher de validation.</span> Vous pourrez lancer un circuit a posteriori sur n'importe quelle pièce depuis sa fiche.</p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
            <span className="material-symbols-outlined text-red-500">error</span>
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        <button
          onClick={handleIngest}
          disabled={isIngesting || !directoryPath.trim()}
          className="w-full py-5 bg-cam-green text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-green-200 hover:bg-green-700 hover:scale-[1.01] transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-3"
        >
          {isIngesting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Scan et import en cours...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-2xl">drive_folder_upload</span>
              Lancer l'ingestion
            </>
          )}
        </button>
      </div>

      {/* Supported formats */}
      <div className="glass p-8 rounded-[2.5rem] bg-white/40 border-white">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
          Formats pris en charge
        </h4>
        <div className="flex flex-wrap gap-2">
          {['PDF', 'DOCX', 'DOC', 'XLSX', 'XLS', 'PPTX', 'PPT', 'ODT', 'ODS', 'TXT', 'CSV', 'RTF', 'PNG', 'JPG', 'TIFF', 'BMP', 'GIF', 'WEBP'].map((ext) => (
            <span key={ext} className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider">
              .{ext.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Fichiers trouvés" value={result.total_found} icon="search" color="bg-slate-800" />
            <SummaryCard label="Importés" value={result.imported} icon="check_circle" color="bg-cam-green" />
            <SummaryCard label="Ignorés" value={result.skipped} icon="block" color="bg-cam-yellow" />
            <SummaryCard label="Erreurs" value={result.error_count} icon="error" color="bg-red-500" />
          </div>

          {/* Imported files */}
          {result.details.length > 0 && (
            <div className="glass p-8 rounded-[2.5rem] bg-white/60 border-white">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 italic">
                Documents importés ({result.details.length})
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
                        {formatSize(file.file_size)} &bull; {file.mime_type}
                        {file.ocr_queued && <span className="text-blue-500 ml-2">OCR en file d'attente</span>}
                      </p>
                    </div>
                    {file.rules_matched.length > 0 && (
                      <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                        {file.rules_matched.map((rule, i) => (
                          <span key={i} className="text-[8px] bg-cam-green/10 text-cam-green px-2 py-0.5 rounded-md font-bold uppercase">
                            {rule}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="material-symbols-outlined text-green-400 text-lg">check_circle</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="glass p-8 rounded-[2.5rem] bg-red-50/50 border-red-100">
              <h4 className="text-sm font-black uppercase tracking-widest text-red-400 mb-6 italic">
                Erreurs ({result.errors.length})
              </h4>
              <div className="space-y-3">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-red-100">
                    <span className="material-symbols-outlined text-red-400">warning</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate font-mono">{err.file}</p>
                      <p className="text-[10px] text-red-500 font-medium">{err.error}</p>
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
