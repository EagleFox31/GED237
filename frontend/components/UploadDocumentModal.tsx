// frontend/components/UploadDocumentModal.tsx
import React, { useState, useRef, useCallback } from 'react';
import { Document } from '../types';
import { api } from '../services/api';
import {
  fileTooLargeMessage, formatFileSize, nextTitle, unreadableFormatNotice, uploadErrorMessage,
} from '../lib/uploadFeedback';
import { categoriesApi, DocumentCategory } from '../services/categories.api';
import { MAX_UPLOAD_MB } from '../constants';
import { resolvePreviewStrategy } from './preview/PreviewStrategyRegistry';
import { onActivationKey } from '../lib/keyboardActivation';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

/** Avertissement de format pour le fichier choisi (aperçu : mêmes règles que la fenêtre de détail). */
function formatNoticeFor(f: File): string | null {
  const mime = f.type.toLowerCase();
  const canPreview = resolvePreviewStrategy({ mime, filename: f.name }).id !== 'unsupported';
  return unreadableFormatNotice(mime, canPreview);
}

interface UploadDocumentModalProps {
  onClose: () => void;
  onSuccess: (doc: Document) => void;
}

const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [titleEditedByHand, setTitleEditedByHand] = useState(false);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [processingMode, setProcessingMode] = useState<'archive' | 'process'>('process');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEscapeToClose(onClose, !isLoading);

  React.useEffect(() => {
    categoriesApi.list(false).then(setCategories).catch(console.error);
  }, []);

  const handleFile = (f: File | null) => {
    if (!f) return;
    // Refus immédiat : inutile de remplir le formulaire puis d'attendre l'échec de l'envoi.
    const tooLarge = fileTooLargeMessage(f.size, MAX_UPLOAD_MB);
    if (tooLarge) {
      setFile(null);
      setError(tooLarge);
      // Permet de rechoisir le même fichier (sinon onChange ne se redéclenche pas).
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(f);
    // Le titre suit le fichier, sauf s'il a été saisi à la main.
    setTitle(nextTitle(title, titleEditedByHand, f.name));
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, [title, titleEditedByHand]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!file) { setError('Veuillez sélectionner un fichier.'); return; }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setError('Le titre est obligatoire.'); return; }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', trimmedTitle);
    formData.append('processing_mode', processingMode);
    if (category) formData.append('document_category_id', category);
    if (description.trim()) formData.append('description', description.trim());
    // Nettoyage des tags CSV : split, trim, supprimer les vides
    const cleanTags = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .join(',');
    if (cleanTags) formData.append('tags', cleanTags);

    setIsLoading(true);
    try {
      const doc = await api.uploadDocument(formData) as Document;
      onSuccess(doc);
    } catch (err: any) {
      setError(uploadErrorMessage(err?.status, err?.userMessage ?? err?.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-[2rem] shadow-2xl shadow-slate-900/20 w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Nouveau Document</h2>
            <p className="text-sm text-slate-400 font-medium mt-0.5">Déposez un fichier puis choisissez s'il doit être archivé ou soumis au traitement</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Fermer"
            className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 space-y-5">

          {/* Zone Drag & Drop */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={onActivationKey(() => fileInputRef.current?.click())}
            className={`relative flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300
              ${isDragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            <span className={`material-symbols-outlined text-4xl ${file ? 'text-green-500' : 'text-slate-300'}`}>
              {file ? 'check_circle' : 'upload_file'}
            </span>
            {file ? (
              <div className="text-center">
                <p className="font-bold text-slate-700 text-sm">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatFileSize(file.size)}</p>
                {formatNoticeFor(file) && (
                  <p data-testid="upload-format-notice" className="text-xs font-medium text-amber-800 mt-1">{formatNoticeFor(file)}</p>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="font-bold text-slate-500 text-sm">Glissez un fichier ici</p>
                <p className="text-xs text-slate-400 mt-0.5">ou cliquez pour sélectionner</p>
                <p data-testid="upload-limits" className="text-xs text-slate-500 mt-1">PDF, images, Word, Excel · {MAX_UPLOAD_MB} Mo max</p>
              </div>
            )}
          </div>

          {/* Que voulez-vous faire avec ce fichier ? */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              Que voulez-vous faire avec ce fichier ?
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setProcessingMode('archive')}
                disabled={isLoading}
                className={`text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3 ${processingMode === 'archive' ? 'border-rdpc-blue bg-blue-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${processingMode === 'archive' ? 'border-rdpc-blue' : 'border-slate-300'}`}>
                  {processingMode === 'archive' && <div className="w-2.5 h-2.5 rounded-full bg-rdpc-blue" />}
                </div>
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">folder</span>
                    Juste le ranger
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    Le fichier est classé et consultable. <span className="font-bold">Aucune validation, aucun circuit déclenché.</span> Idéal pour archives, copies, rangement initial.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setProcessingMode('process')}
                disabled={isLoading}
                className={`text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3 ${processingMode === 'process' ? 'border-rdpc-blue bg-blue-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${processingMode === 'process' ? 'border-rdpc-blue' : 'border-slate-300'}`}>
                  {processingMode === 'process' && <div className="w-2.5 h-2.5 rounded-full bg-rdpc-blue" />}
                </div>
                <div className="flex-1">
                  <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">settings</span>
                    Le ranger et lancer le traitement
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    Si une règle d'aiguillage correspond, le <span className="font-bold">circuit de validation démarre automatiquement.</span> Idéal pour pièces actives à valider.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Titre */}
          <div className="space-y-1.5">
            <label htmlFor="upload-title" className="text-xs font-black uppercase tracking-wider text-slate-500">
              Titre <span className="text-red-400">*</span>
            </label>
            <input id="upload-title"
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleEditedByHand(e.target.value !== ''); }}
              placeholder="Nom du document..."
              maxLength={200}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              disabled={isLoading}
            />
          </div>

          {/* Catégorie — liste déroulante dynamique */}
          <div className="space-y-1.5">
            <label htmlFor="upload-category" className="text-xs font-black uppercase tracking-wider text-slate-500">
              Catégorie
            </label>
            <select id="upload-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none"
              disabled={isLoading}
            >
              <option value="">Sélectionnez une catégorie...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label htmlFor="upload-tags" className="text-xs font-black uppercase tracking-wider text-slate-500">
              Tags <span className="text-slate-300 font-medium normal-case">(séparés par des virgules)</span>
            </label>
            <input id="upload-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="budget, 2025, DAFP..."
              className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="upload-description" className="text-xs font-black uppercase tracking-wider text-slate-500">Description</label>
            <textarea id="upload-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte ou note sur ce document..."
              rows={2}
              maxLength={500}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Message d'erreur */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 text-red-600">
              <span className="material-symbols-outlined text-lg mt-0.5 shrink-0">error</span>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Actions : collées au bas de la fenêtre, visibles sans défiler sur petit écran (1366×768, zoom 125 %). */}
          <div data-testid="upload-actions" className="sticky bottom-0 z-10 -mx-8 px-8 pt-4 pb-8 flex gap-3 bg-white border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-3 rounded-2xl text-sm font-black uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !file}
              className="flex-2 flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">upload</span>
                  Envoyer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadDocumentModal;
