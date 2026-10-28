import React from 'react';

import type { ReportsDocumentActivityResponse } from '../../../../services/resources/reports.api';

interface ReportsDocumentActivityPanelProps {
  activity: ReportsDocumentActivityResponse | null;
  loading?: boolean;
  error?: string | null;
}

const renderBars = (
  items: Array<{ key: string; label: string; value: number }>,
  empty: string,
) => {
  const maxValue = items.reduce((current, item) => Math.max(current, item.value), 0);
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        {empty}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-800">{item.label}</p>
            <span className="text-sm font-black tracking-tight text-slate-900">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-rdpc-blue transition-all"
              style={{ width: `${maxValue > 0 ? Math.max((item.value / maxValue) * 100, 8) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ReportsDocumentActivityPanel: React.FC<ReportsDocumentActivityPanelProps> = ({
  activity,
  loading = false,
  error = null,
}) => {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-8 py-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Activité documentaire
        </p>
        <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tighter text-slate-900">
          Répartitions et points de vigilance
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Lisez ce qui circule dans l’institution sans glisser vers l’analyse de performance par service.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center px-8 py-14">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rdpc-blue" />
        </div>
      ) : error ? (
        <div className="px-8 py-10">
          <div className="rounded-[1.5rem] border border-red-100 bg-red-50 px-6 py-5 text-sm font-bold text-red-600">
            {error}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 px-8 py-8 xl:grid-cols-2">
          <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Documents par statut
            </p>
            <div className="mt-4">
              {renderBars(
                activity?.by_status ?? [],
                'Aucune répartition par statut n’est encore disponible.',
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Types de fichiers les plus présents
            </p>
            <div className="mt-4">
              {activity?.availability.by_file_type ? (
                renderBars(
                  activity?.by_file_type ?? [],
                  'Aucun type de fichier n’est encore remonté pour cette période.',
                )
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Cette lecture sera ajoutée dès que les agrégats par type seront disponibles.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Répartition légère par service
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Vue de présence documentaire par unité, sans lecture de charge ni de performance.
            </p>
            <div className="mt-4">
              {activity?.availability.by_org_unit ? (
                renderBars(
                  activity?.by_org_unit ?? [],
                  'Aucune répartition par service n’est encore disponible.',
                )
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Cette lecture sera activée dès que les agrégats par unité seront stabilisés.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-emerald-100 bg-emerald-50/40 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Points de vigilance documentaire
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Non classés</p>
                <p className="mt-2 text-3xl font-black tracking-tighter text-slate-900">
                  {activity?.signals.unclassified_documents ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Documents encore en attente de classement ou revenus en reprise.
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Informations manquantes</p>
                <p className="mt-2 text-3xl font-black tracking-tighter text-slate-900">
                  {activity?.signals.documents_missing_information ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Documents sans catégorie ou sans éléments de classement encore complets.
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documents à revoir</p>
                <p className="mt-2 text-3xl font-black tracking-tighter text-slate-900">
                  {activity?.signals.documents_needing_review ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Documents demandant encore une décision manuelle.
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Imports à vérifier</p>
                <p className="mt-2 text-3xl font-black tracking-tighter text-slate-900">
                  {activity?.signals.imports_needing_review ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Lots importés qui attendent encore une reprise dans la bannette.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
