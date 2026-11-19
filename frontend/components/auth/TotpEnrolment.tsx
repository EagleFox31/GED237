import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { api, type AuthSession } from '../../services/api';
import type { TotpSecret } from '../../services/resources/auth.api';
import { ApiError } from '../../lib/errors';
import { groupSecret, isSixDigits } from './otpRules';
import { SESSION_EXPIRED, authErrorMessage } from './authErrors';

const statusOf = (err: unknown) => (err instanceof ApiError ? err.status : undefined);
/** Jeton d'enrôlement refusé (401) ou inconnu/expiré (404) : retour à la connexion. */
const isExpired = (err: unknown) => statusOf(err) === 401 || statusOf(err) === 404;
const messageOf = (err: unknown, fallback: string) =>
  err instanceof ApiError ? authErrorMessage(err.status, err.raw.detail, fallback) : fallback;

interface TotpEnrolmentProps {
  enrolmentToken: string;
  onDone: (session: AuthSession) => void;
  /** Jeton expiré ou refusé : retour à l'écran de connexion avec ce message. */
  onExpired: (message: string) => void;
}

/**
 * Enrôlement imposé aux administrateurs (#193) : QR à scanner, clé lisible à la main, premier
 * code. Pas de « plus tard » : la connexion ne se termine qu'avec un code valide.
 */
export const TotpEnrolment: React.FC<TotpEnrolmentProps> = ({ enrolmentToken, onDone, onExpired }) => {
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .startTotpEnrolment(enrolmentToken)
      .then((result) => {
        if (alive) setSecret(result);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (isExpired(err)) onExpired(SESSION_EXPIRED);
        else setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [enrolmentToken, onExpired]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSixDigits(code)) {
      setError('Saisissez les 6 chiffres affichés.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await api.confirmTotpEnrolment(enrolmentToken, code));
    } catch (err) {
      if (isExpired(err)) {
        onExpired(SESSION_EXPIRED);
        return;
      }
      setCode('');
      setError(messageOf(err, 'Code incorrect'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right duration-500 max-w-xl">
      <div className="space-y-3">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">
          Protégez votre compte
        </h1>
        <p className="text-slate-500 text-lg font-medium leading-relaxed">
          Scannez ce QR code avec votre application d&apos;authentification.
        </p>
        {error && (
          <p role="alert" className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-xl">{error}</p>
        )}
      </div>

      {loadFailed ? (
        <p role="alert" className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-xl">
          QR code indisponible pour le moment. Reconnectez-vous.
        </p>
      ) : secret ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="rounded-2xl border-2 border-slate-100 bg-white p-4">
            <QRCodeSVG value={secret.otpauth_uri} size={176} title="QR code à scanner" />
          </div>
          <div className="flex-1 space-y-2">
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-expanded={showKey}
              className="text-xs font-black uppercase tracking-widest text-rdpc-blue hover:underline"
            >
              Saisir la clé à la main
            </button>
            {showKey && (
              <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-sm font-bold text-slate-800" aria-label="Clé de configuration">
                {groupSecret(secret.secret)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Chargement…</p>
      )}

      <form onSubmit={submit} className="space-y-6">
        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 ml-1">Code à 6 chiffres</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            disabled={!secret}
            className="block w-full px-6 py-4 border-2 border-slate-100 rounded-2xl bg-slate-50 text-center text-2xl font-black tracking-[0.5em] text-rdpc-blue outline-none focus:border-rdpc-blue"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !secret}
          className="w-full py-5 rounded-2xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-[0.4em] transition-all hover:bg-blue-800 disabled:opacity-70"
        >
          {busy ? 'Validation…' : 'Valider'}
        </button>
      </form>
    </div>
  );
};
