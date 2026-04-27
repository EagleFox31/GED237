
import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';

interface DisplaySettingsProps {
  layoutMode: 'sidebar' | 'topbar';
  setLayoutMode: (mode: 'sidebar' | 'topbar') => void;
}

const DisplaySettings: React.FC<DisplaySettingsProps> = ({ layoutMode, setLayoutMode }) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<'appearance' | 'config' | 'roles'>('appearance');
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const premiumPalette = [
    '#CE1126', '#007A5E', '#0055A4', '#FCD116',
    '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f97316', '#475569', '#10b981', '#ef4444'
  ];

  useEffect(() => {
    const fetchOrgUnits = async () => {
      try {
        const data = await api.getOrgUnits();
        setOrgUnits(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch org units:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrgUnits();
  }, []);

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-32">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Paramètres <span className="text-rdpc-blue">Organisation</span></h2>
          <p className="text-slate-500 mt-2 font-medium italic text-lg">Gérez l'identité et la structure de votre locataire.</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 text-rdpc-blue rounded-xl border border-blue-100">
           <span className="material-symbols-outlined text-sm animate-spin">sync</span>
           <span className="text-[10px] font-black uppercase tracking-widest">Connecté au Cloud National</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-4 p-1 bg-slate-100/50 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSettingsTab('appearance')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSettingsTab === 'appearance' ? 'bg-white text-rdpc-blue shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Apparence & UI
        </button>
        <button
          onClick={() => setActiveSettingsTab('config')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSettingsTab === 'config' ? 'bg-white text-rdpc-blue shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Configuration Système
        </button>
        <button
          onClick={() => setActiveSettingsTab('roles')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSettingsTab === 'roles' ? 'bg-white text-rdpc-blue shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Rôles & Permissions
        </button>
      </div>

      {activeSettingsTab === 'roles' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-500">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rdpc-blue text-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-xl">badge</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Guide des rôles</h3>
              <p className="text-xs text-slate-500 mt-1">Choisissez le rôle d'un utilisateur en fonction de ses droits GED, pas de son poste métier (assistante, secrétaire, chef de service…).</p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <tr>
                  <th className="px-6 py-4">Rôle</th>
                  <th className="px-6 py-4">Code technique</th>
                  <th className="px-6 py-4">Droits GED</th>
                  <th className="px-6 py-4">Cas d'usage type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {[
                  { label: 'Admin Institution', code: 'tenant_admin', rights: 'Gère tout le ministère : structure, règles, utilisateurs', ex: 'DSI, Secrétaire général' },
                  { label: 'Admin Service', code: 'unit_admin', rights: "Gère un service : créer utilisateurs, règles GED locales", ex: "Chef de cellule informatique d'une direction" },
                  { label: 'Responsable', code: 'manager', rights: 'Valide / signe les documents (visas, approbations)', ex: 'Directeur, sous-directeur, chef de service' },
                  { label: 'Collaborateur', code: 'collaborator', rights: 'Traite les documents : rédige, classe, transmet', ex: "Agent, assistante, chargé de mission, secrétaire" },
                  { label: 'Lecteur', code: 'reader', rights: 'Consultation seule, aucune modification', ex: 'Stagiaire, observateur externe autorisé' },
                  { label: 'Auditeur', code: 'auditor', rights: "Lecture du journal d'audit et des métriques", ex: "Inspection générale, contrôle interne" },
                ].map((r) => (
                  <tr key={r.code} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-800">{r.label}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{r.code}</td>
                    <td className="px-6 py-4 text-slate-700">{r.rights}</td>
                    <td className="px-6 py-4 text-slate-500 italic">{r.ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600">tips_and_updates</span>
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-bold mb-1">Bon réflexe</p>
              <p>Pour créer une assistante / un secrétariat, choisissez <strong>Collaborateur</strong> rattaché au même service que son chef, et désignez ce dernier comme <strong>Responsable hiérarchique (N+1)</strong>. Le rôle ne décrit pas le poste métier mais le niveau de droits dans la GED.</p>
            </div>
          </div>
        </div>
      ) : activeSettingsTab === 'appearance' ? (
        <div className="space-y-16 animate-in fade-in zoom-in duration-500">
          {/* Layout Mode */}
          <section className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-xl">layers</span>
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Structure de l'interface</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div onClick={() => setLayoutMode('sidebar')} className={`group cursor-pointer relative p-8 rounded-[3rem] border-4 transition-all duration-500 ${layoutMode === 'sidebar' ? 'border-rdpc-blue bg-white shadow-2xl scale-[1.02]' : 'border-transparent bg-slate-100/50 hover:bg-slate-100'}`}>
                <div className="aspect-video bg-slate-800 rounded-2xl mb-6 overflow-hidden flex">
                  <div className="w-1/4 h-full bg-white/10 p-2 space-y-1">
                    <div className="h-2 w-full bg-white/20 rounded"></div>
                    <div className="h-2 w-2/3 bg-white/10 rounded"></div>
                  </div>
                </div>
                <h4 className="text-lg font-black text-slate-800 italic uppercase">Menu Latéral</h4>
              </div>
              <div onClick={() => setLayoutMode('topbar')} className={`group cursor-pointer relative p-8 rounded-[3rem] border-4 transition-all duration-500 ${layoutMode === 'topbar' ? 'border-rdpc-blue bg-white shadow-2xl scale-[1.02]' : 'border-transparent bg-slate-100/50 hover:bg-slate-100'}`}>
                <div className="aspect-video bg-slate-800 rounded-2xl mb-6 overflow-hidden flex flex-col">
                  <div className="h-1/4 w-full bg-white/10 p-2 flex gap-2">
                    <div className="h-2 w-4 bg-white/20 rounded"></div>
                    <div className="h-2 w-4 bg-white/20 rounded"></div>
                  </div>
                </div>
                <h4 className="text-lg font-black text-slate-800 italic uppercase">Menu Supérieur</h4>
              </div>
            </div>
          </section>

          {/* Organization Units from API */}
          <section className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-cam-yellow text-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-xl">account_tree</span>
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Unités Organisationnelles</h3>
            </div>
            <div className="glass p-10 rounded-[3rem] border-white bg-white/40">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rdpc-blue"></div>
                </div>
              ) : orgUnits.length === 0 ? (
                <p className="text-sm text-slate-400 font-medium italic text-center py-8">Aucune unité organisationnelle configurée.</p>
              ) : (
                <div className="space-y-4">
                  {orgUnits.map((unit: any) => (
                    <div key={unit.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black" style={{ backgroundColor: premiumPalette[unit.level % premiumPalette.length] }}>
                        {unit.short_name || unit.code?.substring(0, 3)}
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-black uppercase text-slate-800">{unit.name}</p>
                        <p className="text-[9px] font-medium text-slate-400">Code: {unit.code} • Niveau {unit.level}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-10 animate-in fade-in slide-in-from-right duration-500">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-cam-green text-white rounded-xl flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-xl">verified</span>
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Checklist de déploiement</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ConfigStep icon="corporate_fare" title="Structure Organisationnelle" status="COMPLÉTÉ" desc="Organigramme et directions." done />
              <ConfigStep icon="group" title="Utilisateurs & Rôles" status="EN COURS" desc="Importation des agents." active />
              <ConfigStep icon="folder_managed" title="Espaces Documentaires" status="COMPLÉTÉ" desc="GED par service activée." done />
              <ConfigStep icon="account_tree" title="Circuits de Validation" status="CONFIGURER" desc="Définir les étapes de visa." />
              <ConfigStep icon="shield_lock" title="Politique de Sécurité" status="CONFIGURER" desc="MFA et accès IP." />
              <ConfigStep icon="history_edu" title="Archivage Légal" status="CONFIGURER" desc="Règles de rétention (10 ans)." />
            </div>

            <div className="p-8 bg-slate-900 rounded-[3rem] text-white flex items-center justify-between overflow-hidden relative">
               <div className="relative z-10">
                  <h4 className="text-xl font-black italic uppercase tracking-tighter mb-2">Finaliser l'installation</h4>
                  <p className="text-slate-400 text-xs font-medium max-w-md">Une fois ces étapes terminées, votre tenant sera officiellement prêt pour la production nationale.</p>
               </div>
               <button className="relative z-10 px-8 py-4 bg-cam-yellow text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Générer Rapport Setup</button>
               <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl text-white/5 rotate-12">rocket_launch</span>
            </div>
        </div>
      )}
    </div>
  );
};

const ConfigStep = ({ icon, title, status, desc, done, active }: any) => (
  <div className={`p-6 rounded-[2rem] border transition-all ${done ? 'bg-green-50 border-green-100' : active ? 'bg-white border-blue-100 shadow-xl' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
     <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${done ? 'bg-green-500 text-white' : active ? 'bg-rdpc-blue text-white' : 'bg-slate-200 text-slate-400'}`}>
           <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <div className="flex-1">
           <h4 className="text-[11px] font-black uppercase text-slate-800 leading-tight">{title}</h4>
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{status}</p>
        </div>
        {done && <span className="material-symbols-outlined text-green-500">check_circle</span>}
     </div>
     <p className="text-[10px] text-slate-500 italic">{desc}</p>
  </div>
);

export default DisplaySettings;
