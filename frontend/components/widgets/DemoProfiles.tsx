
import React from 'react';

interface Profile {
  id: string;
  label: string;
  role: string;
  icon: string;
  color: string;
}

interface DemoProfilesProps {
  onSelect: (profile: Profile) => void;
}

const profiles: Profile[] = [
  { id: 'super', label: 'Super Admin', role: 'Plateforme', icon: 'security_update_good', color: 'bg-cam-red' },
  { id: 'tenant', label: 'Admin Institution', role: 'Institution', icon: 'account_balance', color: 'bg-rdpc-blue' },
  { id: 'collab', label: 'Collaborateur', role: 'Contributeur', icon: 'edit_square', color: 'bg-cam-green' },
];

const DemoProfiles: React.FC<DemoProfilesProps> = ({ onSelect }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-100"></div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap italic">Espace Démo Interactif</span>
        <div className="h-px flex-1 bg-slate-100"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => onSelect(profile)}
            className="group relative flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-rdpc-blue/20 hover:shadow-xl hover:shadow-rdpc-blue/5 transition-all duration-300 group"
          >
            <div className={`w-10 h-10 rounded-xl ${profile.color} flex items-center justify-center text-white shadow-lg shadow-inner opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all`}>
              <span className="material-symbols-outlined text-xl">{profile.icon}</span>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-800 leading-tight group-hover:text-rdpc-blue transition-colors">{profile.label}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{profile.role}</p>
            </div>

            {/* Tooltip caché pour les détails du rôle au survol */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 text-white text-[8px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-20">
              Connexion instantanée
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-900"></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DemoProfiles;
