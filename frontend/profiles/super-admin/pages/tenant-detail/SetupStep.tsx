import React from 'react';

interface SetupStepProps {
  index: number;
  done: boolean;
  active: boolean;
  locked?: boolean;
  title: string;
  desc: string;
  cta?: { label: string; onClick: () => void };
}

export const SetupStep: React.FC<SetupStepProps> = ({ index, done, active, locked, title, desc, cta }) => {
  const stateClass = done
    ? 'border-emerald-200 bg-emerald-50/40'
    : active
      ? 'border-rdpc-blue bg-rdpc-blue/5 ring-2 ring-rdpc-blue/20'
      : locked
        ? 'border-slate-100 bg-slate-50/40 opacity-60'
        : 'border-slate-100 bg-white/40';

  const badgeClass = done
    ? 'bg-emerald-500 text-white'
    : active
      ? 'bg-rdpc-blue text-white'
      : 'bg-slate-200 text-slate-500';

  return (
    <li className={`flex items-start gap-4 p-4 rounded-2xl border ${stateClass} transition-all`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black ${badgeClass}`}>
        {done ? <span className="material-symbols-outlined text-base">check</span> : index}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-black ${done ? 'text-emerald-800' : active ? 'text-slate-900' : 'text-slate-600'}`}>
          {title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="flex-shrink-0 px-4 py-2 rounded-xl bg-rdpc-blue text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all"
        >
          {cta.label}
        </button>
      )}
      {locked && !cta && (
        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <span className="material-symbols-outlined text-sm">lock</span>
          Verrouillé
        </span>
      )}
    </li>
  );
};
