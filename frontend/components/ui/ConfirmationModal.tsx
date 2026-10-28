import React from 'react';

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  eyebrow?: string;
  icon?: string;
  bullets?: string[];
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  eyebrow,
  icon = 'info',
  bullets = [],
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cam-green text-white shadow-lg">
            <span className="material-symbols-outlined text-xl">{icon}</span>
          </div>
          <div className="flex-1">
            {eyebrow && (
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {eyebrow}
              </p>
            )}
            <h3 className="mt-1 text-2xl font-black uppercase italic tracking-tight text-slate-900">
              {title}
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{message}</p>
            {bullets.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="font-bold text-slate-800">Avant de continuer :</p>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-6">
                  {bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-cam-green px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-green-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
