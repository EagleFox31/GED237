import React from 'react';
import logoSrc from './icon-small.png';

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
      <img src={logoSrc} alt="Icône E-Dossier" className="w-full h-full object-contain" />
    </div>

    <div>
      <h1 className="text-xl font-black text-slate-800 tracking-tighter leading-none italic uppercase flex items-center gap-1">
        E-Dossier
      </h1>
      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mt-0.5 whitespace-nowrap">
        Cameroun <span className="text-cam-red">GED</span>
      </p>
    </div>
  </div>
);
