import React from 'react';
import type { ClassificationSimulationStage } from '../../types';

interface SimulationTracePanelProps {
  stages?: ClassificationSimulationStage[] | null;
  compact?: boolean;
  title?: string;
}

export const SimulationTracePanel: React.FC<SimulationTracePanelProps> = ({
  stages,
  compact = false,
  title = 'Déroulé de la simulation',
}) => {
  if (!stages || stages.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-5'}`}>
      <div className="mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">
          Le moteur applique les filtres un par un, puis conserve seulement les règles encore valides.
        </p>
      </div>

      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div key={stage.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Étape {index + 1}
                </p>
                <h4 className="mt-1 text-sm font-black text-slate-800">{stage.label}</h4>
                <p className="mt-1 text-xs text-slate-500">{stage.summary}</p>
              </div>
              <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  {stage.remaining_rules.length} restantes
                </span>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                  {stage.removed_rules.length} écartées
                </span>
              </div>
            </div>

            {stage.remaining_rules.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Encore en course</p>
                <div className="mt-2 space-y-2">
                  {stage.remaining_rules.map((rule) => (
                    <div key={`${stage.key}-keep-${rule.rule_id}`} className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-800">
                        {rule.rule_name}
                        <span className="ml-2 text-slate-400">{rule.rule_code}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{rule.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stage.removed_rules.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Écartées à cette étape</p>
                <div className="mt-2 space-y-2">
                  {stage.removed_rules.map((rule) => (
                    <div key={`${stage.key}-drop-${rule.rule_id}`} className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-800">
                        {rule.rule_name}
                        <span className="ml-2 text-slate-400">{rule.rule_code}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{rule.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
