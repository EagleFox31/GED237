import React from 'react';

export const StatCard: React.FC<{
  icon: string;
  label: string;
  value: number | string;
  color?: string;
  sub?: string;
  onClick?: () => void;
}> = ({ icon, label, value, color = 'text-rdpc-blue', sub, onClick }) => {
  const Inner = (
    <>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-100 ${color}`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className={`text-3xl font-black tracking-tighter ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {onClick && (
        <span className="material-symbols-outlined text-slate-300 group-hover:text-rdpc-blue transition-colors">arrow_forward</span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group glass rounded-3xl bg-white/60 border-white p-6 flex items-center gap-4 hover:shadow-lg hover:bg-white transition-all text-left w-full cursor-pointer"
      >
        {Inner}
      </button>
    );
  }
  return (
    <div className="glass rounded-3xl bg-white/60 border-white p-6 flex items-center gap-4">
      {Inner}
    </div>
  );
};
