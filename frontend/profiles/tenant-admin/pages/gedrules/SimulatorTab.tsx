// frontend/profiles/tenant-admin/pages/gedrules/SimulatorTab.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import { categoriesApi } from '../../../../services/categories.api';

const ACTION_LABELS: Record<string, string> = {
  visa: 'Visa',
  approval: 'Approbation',
  final_signature: 'Signature',
  read_ack: 'Prise de connaissance',
};

const SimulatorTab: React.FC = () => {
  const [documentCategoryId, setDocumentCategoryId] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [results, setResults] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
     const fetchInitialData = async () => {
        try {
           const [units, cats] = await Promise.all([
             api.getOrgUnits(),
             categoriesApi.list(false)
           ]);
           setOrgUnits(units);
           setCategories(cats);
        } catch(e) { console.error(e); }
     };
     fetchInitialData();
  }, []);

  const handleSimulate = async () => {
    setLoading(true);
    setResults(null);
    try {
       const res = await api.simulateRouting({
          document_category_id: documentCategoryId,
          org_unit_id: orgUnitId || null
       });
       setResults(res);
    } catch(e: any) {
       console.error(e);
       alert("Erreur de simulation");
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-18rem)]">
       {/* Colonne Setup */}
       <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="p-8 bg-white rounded-[2.5rem] border-2 border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

             <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter italic mb-1 flex items-center gap-2">
                 <span className="material-symbols-outlined text-purple-600">science</span>
                 Variables d'entrée
             </h3>
             <p className="text-xs text-slate-500 font-medium mb-6">Testez l'aiguillage avant le déploiement réel.</p>

             <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Type de Document</label>
                  <select
                     value={documentCategoryId}
                     onChange={e => setDocumentCategoryId(e.target.value)}
                     className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold uppercase text-slate-700 focus:outline-none focus:border-purple-300"
                  >
                     <option value="" disabled>Sélectionnez un type...</option>
                     {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Service émetteur</label>
                  <select
                     value={orgUnitId}
                     onChange={e => setOrgUnitId(e.target.value)}
                     className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-purple-300"
                  >
                     <option value="">-- Tous les services (règle générale) --</option>
                     {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.name}</option>)}
                  </select>
                </div>
             </div>

             <button
                onClick={handleSimulate}
                disabled={loading || !documentCategoryId}
                className="w-full mt-8 py-4 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
             >
                {loading ? (
                    <>Simulation en cours...</>
                ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Lancer le test
                    </>
                )}
             </button>
          </div>

          {/* Note explicative */}
          <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-slate-600 leading-relaxed">
            <p className="font-black uppercase tracking-widest text-rdpc-blue mb-2 text-[10px]">Comment lire le résultat ?</p>
            <p>✅ <strong>Acteur identifié</strong> = l'agent a été trouvé automatiquement grâce à son rôle et sa position dans la hiérarchie.</p>
            <p className="mt-1">⚠️ <strong>Aucun agent identifié</strong> = le rôle requis n'existe dans aucun service de la chaîne. L'étape devra être affectée manuellement par l'administrateur.</p>
          </div>
       </div>

       {/* Colonne Output */}
       <div className="flex-1 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col relative overflow-hidden">
          {!results && !loading && (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
               <span className="material-symbols-outlined text-6xl mb-4 opacity-50">hub</span>
               <p className="italic font-bold tracking-widest uppercase text-sm">Sélectionnez un type et lancez le test</p>
             </div>
          )}

          {loading && (
             <div className="flex-1 flex flex-col items-center justify-center gap-4 text-purple-400 animate-pulse">
                <span className="material-symbols-outlined text-4xl animate-spin">settings</span>
                <p className="italic font-bold tracking-widest uppercase text-sm">Analyse du moteur en cours...</p>
             </div>
          )}

          {results && !loading && (
             <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto custom-scrollbar pr-4 animate-in fade-in slide-in-from-bottom-4">
                {results.matched_rule_id ? (
                   <div className="space-y-8">
                       <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center border-2 border-green-200">
                               <span className="material-symbols-outlined">check_circle</span>
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Règle d'aiguillage trouvée</p>
                              <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">{results.matched_rule_name}</h2>
                           </div>
                       </div>

                       <div className="p-6 bg-white border-2 border-rdpc-blue rounded-[2rem] shadow-lg shadow-blue-100 relative">
                           <div className="absolute top-0 right-8 -mt-3.5 bg-blue-100 text-rdpc-blue px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                               Circuit : {results.template_name}
                           </div>

                           <h3 className="font-black uppercase tracking-tight text-slate-800 italic mb-6 text-center">Circuit de validation résolu</h3>

                           <div className="space-y-3 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
                              {results.resolved_steps.map((step: any, index: number) => (
                                 <div key={index} className="relative flex items-center group">
                                     <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-rdpc-blue text-white shrink-0 shadow-sm z-10">
                                         <span className="text-[10px] font-black">{step.step_order}</span>
                                     </div>
                                     <div className="ml-4 w-full p-4 rounded-2xl bg-white border border-slate-100 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                           <div className="flex items-center gap-2 mb-1 flex-wrap">
                                              <p className="font-bold text-slate-700 uppercase tracking-tighter">{step.label}</p>
                                              <span className="text-[8px] uppercase tracking-widest font-black text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full shrink-0">
                                                {ACTION_LABELS[step.expected_action_type] || step.expected_action_type}
                                              </span>
                                           </div>
                                           <p className="text-xs font-medium text-slate-500 italic flex items-center gap-1">
                                              Rôle requis : <span className="font-bold text-slate-600 not-italic">{step.resolved_role_label || "Inconnu"}</span>
                                           </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                           {step.resolved_user_id ? (
                                               <div className="flex flex-col items-end">
                                                  <span className="text-[9px] uppercase tracking-widest font-black text-green-600 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">done</span>
                                                    Acteur identifié
                                                  </span>
                                                  <span className="text-sm font-black italic mt-1">{step.resolved_user_name}</span>
                                               </div>
                                           ) : (
                                               <div className="flex flex-col items-end gap-1">
                                                  <span className="text-[9px] uppercase tracking-widest font-black text-amber-600 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">person_search</span>
                                                    Aucun agent identifié
                                                  </span>
                                                  <span className="text-[10px] font-medium italic text-slate-400 text-right leading-snug max-w-[160px]">
                                                    Rôle « {step.resolved_role_label} » non trouvé. Affectation manuelle requise.
                                                  </span>
                                               </div>
                                           )}
                                        </div>
                                     </div>
                                 </div>
                              ))}
                           </div>

                           {results.resolved_steps.some((s: any) => !s.resolved_user_id) && (
                             <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                               <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5">info</span>
                               <p className="text-xs text-amber-700 leading-relaxed">
                                 <strong>Actions recommandées :</strong> Vérifiez que les agents concernés ont bien le rôle requis assigné dans la page <strong>Agents & Rôles</strong>, ou modifiez le circuit pour utiliser un rôle existant.
                               </p>
                             </div>
                           )}
                       </div>
                   </div>
                ) : (
                   <div className="p-8 bg-amber-50 border-2 border-amber-200 rounded-[2.5rem] flex flex-col items-center text-center">
                       <span className="material-symbols-outlined text-6xl text-amber-400 mb-4">route</span>
                       <h3 className="text-xl font-black text-amber-700 uppercase italic tracking-tighter mb-2">Aucune règle correspondante</h3>
                       <p className="text-amber-600 font-medium text-sm">Aucune règle d'aiguillage active ne correspond à cette combinaison. Créez une règle dans l'onglet <strong>[3] Règles d'aiguillage</strong>.</p>
                   </div>
                )}
             </div>
          )}
       </div>
    </div>
  );
};
export default SimulatorTab;
