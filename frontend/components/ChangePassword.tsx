import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { errorMessage } from '../utils/errors';

const MIN_LENGTH = 12;

// Calcul de la force du mot de passe (ANSSI-inspired)
const getStrength = (pwd: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { score, label: 'Très faible', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'Faible', color: 'bg-orange-400' };
  if (score === 3) return { score, label: 'Moyen', color: 'bg-yellow-400' };
  if (score === 4) return { score, label: 'Fort', color: 'bg-green-400' };
  return { score, label: 'Très fort', color: 'bg-emerald-500' };
};

const EyeToggle: React.FC<{ show: boolean; onToggle: () => void }> = ({ show, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rdpc-blue transition-colors"
  >
    <span className="material-symbols-outlined text-[20px]">{show ? 'visibility_off' : 'visibility'}</span>
  </button>
);

const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, clearMustChangePassword, logout } = useAuthStore();
  const forced = userProfile?.mustChangePassword === true;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle visibilité (RGAA 2.1)
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => getStrength(newPassword), [newPassword]);

  // Critères en temps réel
  const criteria = [
    { label: '12 caractères minimum', ok: newPassword.length >= 12 },
    { label: 'Une lettre majuscule', ok: /[A-Z]/.test(newPassword) },
    { label: 'Un chiffre', ok: /[0-9]/.test(newPassword) },
    { label: 'Un caractère spécial (@, #, &…)', ok: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_LENGTH) {
      setError(`Le mot de passe doit comporter au moins ${MIN_LENGTH} caractères`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas');
      return;
    }
    if (newPassword === currentPassword) {
      setError("Le nouveau mot de passe doit être différent de l'ancien");
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      clearMustChangePassword();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Échec du changement de mot de passe'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6">

      {/* Header institutionnel rassurant */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-rdpc-blue flex items-center justify-center shadow-lg shadow-blue-200">
          <span className="material-symbols-outlined text-white text-xl">shield_lock</span>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">E-Dossier Cameroun</p>
          <p className="text-xs font-bold text-slate-600">Plateforme GED — Accès sécurisé</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl space-y-6"
      >
        {/* Titre */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-rdpc-blue/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-rdpc-blue">lock_reset</span>
          </div>
          <div>
            <h1 className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">
              Changer le mot de passe
            </h1>
            {forced && (
              <p className="text-xs text-amber-700 font-bold mt-0.5">
                Première connexion — un nouveau mot de passe est requis
              </p>
            )}
          </div>
        </div>

        {/* Alerte contexte */}
        {forced && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
            <span className="material-symbols-outlined text-base shrink-0">info</span>
            <p>Pour des raisons de sécurité, vous devez choisir un mot de passe <strong>personnel et confidentiel</strong> avant d'accéder à l'application.</p>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Mot de passe actuel / temporaire */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              {forced ? 'Mot de passe temporaire reçu' : 'Mot de passe actuel'}
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={forced ? 'Saisissez le mot de passe temporaire reçu' : ''}
                className="w-full px-4 py-3 pr-10 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
                autoComplete="current-password"
              />
              <EyeToggle show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
            </div>
            {forced && (
              <p className="text-[10px] text-slate-400 mt-1">C'est le mot de passe provisoire qui vous a été communiqué par l'administration.</p>
            )}
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                minLength={MIN_LENGTH}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pr-10 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
                autoComplete="new-password"
              />
              <EyeToggle show={showNew} onToggle={() => setShowNew(v => !v)} />
            </div>

            {/* Barre de force (ANSSI) */}
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength.score ? strength.color : 'bg-slate-100'}`}
                    />
                  ))}
                </div>
                <p className={`text-[10px] font-bold ${strength.score <= 2 ? 'text-red-500' : strength.score === 3 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                  Force : {strength.label}
                </p>
              </div>
            )}

            {/* Critères temps réel */}
            <ul className="mt-2 space-y-1">
              {criteria.map(c => (
                <li key={c.label} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`material-symbols-outlined text-[14px] ${c.ok ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {c.ok ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className={c.ok ? 'text-emerald-700 font-bold' : 'text-slate-400'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Confirmer */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                minLength={MIN_LENGTH}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 pr-10 rounded-xl bg-slate-50 border-2 outline-none text-sm transition-colors ${
                  confirmPassword.length > 0
                    ? confirmPassword === newPassword
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-red-300 bg-red-50'
                    : 'border-slate-100 focus:border-rdpc-blue'
                }`}
                autoComplete="new-password"
              />
              <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
            </div>

            {/* Barre de correspondance */}
            {confirmPassword.length > 0 && newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      confirmPassword === newPassword ? 'bg-emerald-500' :
                      (confirmPassword.length / newPassword.length) >= 0.75 ? 'bg-yellow-400' :
                      'bg-red-400'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (Array.from(confirmPassword).filter((c, i) => c === newPassword[i]).length /
                          newPassword.length) * 100
                        )
                      )}%`
                    }}
                  />
                </div>
                <p className={`text-[10px] font-bold ${
                  confirmPassword === newPassword ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {confirmPassword === newPassword
                    ? '✓ Les mots de passe correspondent'
                    : 'Les mots de passe ne correspondent pas'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-3 pt-2">
          {forced ? (
            <button
              type="button"
              onClick={async () => { await logout(); navigate('/', { replace: true }); }}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Se déconnecter
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className="flex-1 py-3 rounded-xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all disabled:opacity-50"
          >
            {submitting ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </div>

        {/* Mention sécurité */}
        <p className="text-center text-[9px] text-slate-300 uppercase tracking-widest">
          Connexion sécurisée — Données chiffrées
        </p>
      </form>
    </div>
  );
};

export default ChangePassword;
