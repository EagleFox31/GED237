import React from 'react';

export const Empty: React.FC<{ icon: string; msg: string }> = ({ icon, msg }) => (
  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
    <span className="material-symbols-outlined text-5xl mb-3 opacity-30">{icon}</span>
    <p className="text-sm font-medium italic">{msg}</p>
  </div>
);
