import React from 'react';

import { exportReportsRowsExcel } from './reportsExport';
import type { ReportsViewMode, ReportsViewModel } from './reportsViewModel';

const EXPORT_CARDS: Array<{
  mode: ReportsViewMode;
  title: string;
  helper: string;
}> = [
  {
    mode: 'synthese',
    title: 'Export de la vue d’ensemble',
    helper: 'Récapitulatif global pour une lecture rapide ou une présentation.',
  },
  {
    mode: 'documents',
    title: 'Export de l’activité documentaire',
    helper: 'Volumes, tendances et points de vigilance documentaires.',
  },
  {
    mode: 'workflows',
    title: 'Export du traitement et des délais',
    helper: 'Documents en traitement, lenteurs visibles, refus et retours.',
  },
  {
    mode: 'services',
    title: 'Export du pilotage par service',
    helper: 'Comparatifs, charge documentaire et délais par service.',
  },
];

interface ReportsExportsPanelProps {
  viewModel: ReportsViewModel;
}

export const ReportsExportsPanel: React.FC<ReportsExportsPanelProps> = ({ viewModel }) => {
  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Exports
          </p>
          <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tighter text-slate-900">
            Exports disponibles
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Exportez un rapport selon votre besoin de suivi, de contrôle ou de présentation.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {EXPORT_CARDS.map((card) => {
          const rows = viewModel.rowsByMode[card.mode] ?? [];
          return (
            <div key={card.mode} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
              <p className="text-sm font-black uppercase italic tracking-tight text-slate-900">
                {card.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{card.helper}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                {rows.length} ligne(s) disponibles
              </p>
              <button
                type="button"
                onClick={() => {
                  void exportReportsRowsExcel(rows, card.mode);
                }}
                className="mt-5 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
              >
                Exporter cette vue
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
