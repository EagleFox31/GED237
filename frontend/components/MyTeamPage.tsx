import React, { useEffect, useState } from 'react';

import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { ReportingBlock } from './ReportingBlock';

/**
 * « Mon équipe » (#277, partie C) : chaîne de chefs et N-1 directs de la personne connectée,
 * pour tous les rôles. Les noms sont du texte : la fiche d'un agent relève de l'écran Utilisateurs.
 */
const MyTeamPage: React.FC = () => {
  const userId = useAuthStore((s) => s.userProfile?.userId);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [failed, setFailed] = useState(false);

  // Profil enregistré avant l'ajout de `userId` : relu une fois sur le serveur, puis gardé.
  useEffect(() => {
    if (userId) return undefined;
    let cancelled = false;
    api
      .getMe()
      .then((me) => {
        if (!cancelled) refreshProfile(me);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshProfile]);

  let content: React.ReactNode;
  if (userId) content = <ReportingBlock userId={userId} variant="self" />;
  else if (failed) content = <p className="text-sm text-amber-700" role="alert">Rattachement indisponible pour le moment.</p>;
  else content = <p className="text-sm text-slate-500" role="status">Chargement…</p>;

  return (
    <div className="p-8 animate-in fade-in duration-500 max-w-3xl">
      <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-6">Mon équipe</h1>
      <div className="glass rounded-3xl p-6">{content}</div>
    </div>
  );
};

export default MyTeamPage;
