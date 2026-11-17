// frontend/components/DocumentNewVersion.tsx
//
// « Nouvelle version » dans l'onglet historique de la fiche (#275) : choisir un fichier, une note
// optionnelle, envoyer. Masqué dans la corbeille ; bloqué si une autre personne a réservé le document.
import React, { useRef, useState } from 'react';
import type { Document } from '../types';
import { api } from '../services/api';
import { ApiError } from '../lib/errors';
import { useAuthStore } from '../stores/authStore';
import { reservationView } from '../lib/documentReservation';
import { versionUploadErrorMessage } from '../lib/documentVersionUpload';
import { CAN_RELEASE_ANY_RESERVATION, CAN_RESERVE_DOCUMENT } from './DocumentReservation';

// Même règle que la réservation : « documents update » ou « update_own » (policy.csv). L'API fait foi.
const CAN_UPLOAD_VERSION = CAN_RESERVE_DOCUMENT;

interface DocumentNewVersionProps {
  document: Document;
  /** Appelé après l'envoi pour relire la fiche et l'historique. */
  onUploaded: () => void | Promise<void>;
}

const DocumentNewVersion: React.FC<DocumentNewVersionProps> = ({ document, onUploaded }) => {
  const profileId = useAuthStore((s) => s.userProfile?.id);
  const userId = useAuthStore((s) => s.userProfile?.userId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!profileId || !CAN_UPLOAD_VERSION.has(profileId) || document.deleted_at) return null;

  const reservation = reservationView(document, userId, new Date());
  const blockedBy =
    reservation.kind === 'other' && !CAN_RELEASE_ANY_RESERVATION.has(profileId) ? reservation.who : null;

  const reset = () => {
    setFile(null);
    setNote('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const { version } = await api.uploadDocumentVersion(document.id, file, note.trim() || undefined);
      setDone(`Version ${version} ajoutée.`);
      reset();
      await onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? versionUploadErrorMessage(err.status, err.errorCode) : versionUploadErrorMessage(0));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass p-5 rounded-3xl border border-slate-100 space-y-3" data-testid="document-new-version">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="font-bold text-slate-800">Nouvelle version</h4>
        <label
          className={`text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 ${
            blockedBy || busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 cursor-pointer'
          }`}
          title={blockedBy ? `Réservé par ${blockedBy}` : 'Remplace le fichier ; les versions précédentes restent dans l’historique.'}
        >
          {file ? 'Changer de fichier' : 'Choisir un fichier'}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            aria-label="Fichier de la nouvelle version"
            disabled={!!blockedBy || busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
              setDone(null);
            }}
          />
        </label>
      </div>
      {blockedBy && <p className="text-xs text-amber-700">Réservé par {blockedBy} : envoi impossible pour l’instant.</p>}
      {file && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-600 truncate max-w-[16rem]" title={file.name}>
            {file.name}
          </span>
          <input
            type="text"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ce qui change (optionnel)"
            aria-label="Ce qui change"
            className="flex-1 min-w-[10rem] text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-rdpc-blue"
          />
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-rdpc-blue text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Envoi…' : 'Envoyer'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={reset}
            className="text-xs font-bold px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-xs font-semibold text-emerald-700">
          {done}
        </p>
      )}
    </div>
  );
};

export default DocumentNewVersion;
