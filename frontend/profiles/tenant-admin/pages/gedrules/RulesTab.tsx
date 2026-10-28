// frontend/profiles/tenant-admin/pages/gedrules/RulesTab.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import { categoriesApi, DocumentCategory } from '../../../../services/categories.api';

type ConfirmState = { title: string; message: string; confirmLabel?: string; tone?: 'danger' | 'primary'; onConfirm: () => void } | null;
type Toast = { tone: 'success' | 'error' | 'info'; message: string } | null;

const slugifyCode = (s: string) => s.toUpperCase().trim().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const RulesTab: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [codeEdited, setCodeEdited] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const showToast = (t: NonNullable<Toast>) => { setToast(t); setTimeout(() => setToast(null), 4000); };

  const EMPTY_RULE = {
    code: '', name: '', description: '',
    document_category_ids: [], org_unit_ids: [],
    workflow_template_id: '', priority: 100, is_active: true
  };

  // Fermeture propre du modal avec garde
  const handleCloseModal = () => {
    if (isDirty) {
      setShowCloseWarning(true);
    } else {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setIsModalOpen(false);
    setShowCloseWarning(false);
    setIsDirty(false);
    setEditingRuleId(null);
    setNewRule(EMPTY_RULE);
    setCodeEdited(false);
    setShowAdvanced(false);
  };

  const handleOpenEdit = (r: any) => {
    const documentCategoryIds = Array.isArray(r.document_category_ids) && r.document_category_ids.length > 0
      ? r.document_category_ids
      : Array.isArray(r.document_categories)
        ? r.document_categories.map((category: any) => category?.id).filter(Boolean)
        : [];

    setEditingRuleId(r.id);
    setNewRule({
      code: r.code,
      name: r.name,
      description: r.description || '',
      document_category_ids: documentCategoryIds,
      org_unit_ids: r.org_unit_ids || [],
      workflow_template_id: r.workflow_template_id || '',
      priority: r.priority ?? 100,
      is_active: r.is_active,
    });
    setCodeEdited(true);
    setShowAdvanced(false);
    setIsDirty(false);
    setIsModalOpen(true);
  };

  // Wrapper : marque le formulaire comme modifié à chaque changement
  const updateRule = (patch: Partial<typeof newRule>) => {
    setNewRule(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const [newRule, setNewRule] = useState<{
    code: string;
    name: string;
    description: string;
    document_category_ids: string[];
    org_unit_ids: string[];
    workflow_template_id: string;
    priority: number;
    is_active: boolean;
  }>({
    code: '',
    name: '',
    description: '',
    document_category_ids: [],
    org_unit_ids: [],
    workflow_template_id: '',
    priority: 100,
    is_active: true
  });

  // Réordonne la liste et met à jour les priorités backend (position × 10)
  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newRules = [...rules];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newRules.length) return;
    [newRules[index], newRules[swapIndex]] = [newRules[swapIndex], newRules[index]];
    setRules(newRules);
    // Mise à jour silencieuse des priorités en cascade
    await Promise.all(
      newRules.map((r, i) =>
        api.updateRoutingRule(r.id, { priority: (i + 1) * 10 }).catch(console.error)
      )
    );
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, templatesData, orgUnitsData, categoriesData] = await Promise.all([
        api.getRoutingRules(),
        api.getTemplates(),
        api.getOrgUnits(),
        categoriesApi.list(false),
      ]);
      setRules(rulesData);
      setTemplates(templatesData);
      setOrgUnits(orgUnitsData);
      setCategories(categoriesData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = newRule.code || slugifyCode(newRule.name);
    if (!newRule.name || !finalCode) {
      showToast({ tone: 'error', message: 'Donnez un nom à la règle.' });
      return;
    }
    if (newRule.document_category_ids.length === 0) {
      showToast({ tone: 'error', message: 'Choisissez au moins un type de document ciblé.' });
      return;
    }
    if (!newRule.workflow_template_id) {
      showToast({ tone: 'error', message: 'Choisissez le circuit à déclencher.' });
      return;
    }
    const payload = {
        ...newRule,
        code: finalCode,
    };
    try {
      if (editingRuleId) {
        await api.updateRoutingRule(editingRuleId, payload);
        setSelectedRule((prev: any) => prev?.id === editingRuleId ? { ...prev, ...payload } : prev);
        showToast({ tone: 'success', message: 'Règle mise à jour avec succès.' });
      } else {
        await api.createRoutingRule(payload);
        showToast({ tone: 'success', message: 'Règle créée avec succès.' });
      }
      resetAndClose();
      loadData();
    } catch (error) {
       console.error(error);
       showToast({ tone: 'error', message: editingRuleId ? 'Erreur lors de la mise à jour.' : 'Erreur lors de la création de la règle.' });
    }
  };

  const toggleActive = async (r: any) => {
    try {
      await api.updateRoutingRule(r.id, { is_active: !r.is_active });
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const deleteRule = (r: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirm({
      title: 'Supprimer cette règle ?',
      message: `La règle « ${r.name} » sera définitivement supprimée. Les nouveaux documents correspondants ne seront plus aiguillés automatiquement.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteRoutingRule(r.id);
          if (selectedRule?.id === r.id) setSelectedRule(null);
          loadData();
          showToast({ tone: 'success', message: 'Règle supprimée.' });
        } catch (err) {
          console.error(err);
          showToast({ tone: 'error', message: 'Suppression impossible.' });
        }
      },
    });
  };

  const getTemplateName = (id: string) => {
     return templates.find(t => t.id === id)?.name || "Introuvable";
  };
  const getOrgUnitName = (id: string) => {
     return orgUnits.find(o => o.id === id)?.name || id;
  };
  const getCategoryName = (id: string) => {
      return categories.find(c => c.id === id)?.name || id;
  };

  const getRuleCategoryIds = (rule: any): string[] =>
    Array.isArray(rule?.document_category_ids) ? rule.document_category_ids : [];

  const getRuleOrgUnitIds = (rule: any): string[] =>
    Array.isArray(rule?.org_unit_ids) ? rule.org_unit_ids : [];

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-18rem)]">
      {/* Liste des Règles */}
      <div className="w-full lg:w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full mb-4 px-5 py-3 bg-rdpc-blue text-white rounded-[1.5rem] font-bold shadow-lg shadow-blue-200 hover:bg-black transition-all flex justify-center items-center gap-2 uppercase tracking-widest italic"
        >
          <span className="material-symbols-outlined">add</span>
          Nouvelle Règle
        </button>

        {loading ? (
           <div className="text-center italic text-slate-400">Chargement...</div>
        ) : rules.length === 0 ? (
           <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
             <p className="text-xs italic text-slate-500 leading-relaxed">
               Aucune règle pour l'instant.<br/>
               Cliquez sur <span className="font-bold text-rdpc-blue">« Nouvelle Règle »</span> ci-dessus. Le panneau de droite explique comment elles fonctionnent.
             </p>
           </div>
        ) : (
          rules.map((r, index) => (
             <div
               key={r.id}
               onClick={() => setSelectedRule(r)}
               className={`p-5 rounded-[2rem] border transition-all cursor-pointer relative ${selectedRule?.id === r.id ? 'bg-white border-rdpc-blue shadow-xl ring-2 ring-rdpc-blue/10' : 'bg-white/60 border-transparent hover:bg-white hover:shadow-md'}`}
             >
                <div className="flex justify-between items-start mb-2">
                   <div className="flex items-center gap-2">
                     {/* Flèches de réordonnancement */}
                     <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                       <button
                         onClick={() => handleReorder(index, 'up')}
                         disabled={index === 0}
                         className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-rdpc-blue hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                         title="Monter (plus prioritaire)"
                       >
                         <span className="material-symbols-outlined text-[12px]">expand_less</span>
                       </button>
                       <button
                         onClick={() => handleReorder(index, 'down')}
                         disabled={index === rules.length - 1}
                         className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-rdpc-blue hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                         title="Descendre (moins prioritaire)"
                       >
                         <span className="material-symbols-outlined text-[12px]">expand_more</span>
                       </button>
                     </div>
                     <h3 className={`text-sm tracking-tight uppercase italic font-black leading-tight ${selectedRule?.id === r.id ? 'text-rdpc-blue' : 'text-slate-700'}`}>{r.name}</h3>
                   </div>
                   <div className="flex gap-2 shrink-0">
                      <button onClick={(e) => deleteRule(r, e)} className="text-slate-300 hover:text-red-500 rounded-full w-6 h-6 flex items-center justify-center bg-slate-50"><span className="material-symbols-outlined text-xs">delete</span></button>
                      <div
                          onClick={(e) => { e.stopPropagation(); toggleActive(r); }}
                          className={`w-8 h-4 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${r.is_active ? 'bg-green-500 justify-end' : 'bg-slate-300 justify-start'}`}
                      >
                      <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                      </div>
                  </div>
                 </div>
                 <div className="flex items-center gap-2 mt-3 ml-7">
                    {index === 0 && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rdpc-blue/10 text-rdpc-blue uppercase tracking-widest">En tête</span>}
                    {getRuleCategoryIds(r).length > 0 ? (
                       <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-600 uppercase tracking-widest truncate">
                         {(() => {
                           const ruleCategoryIds = getRuleCategoryIds(r);
                           const firstCategoryId = ruleCategoryIds[0];
                           return ruleCategoryIds.length === 1 && firstCategoryId
                             ? getCategoryName(firstCategoryId)
                             : `${ruleCategoryIds.length} types`;
                         })()}
                       </span>
                    ) : (
                       <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-400 uppercase tracking-widest italic">Tout type</span>
                    )}
                 </div>
             </div>
          ))
        )}
      </div>

      {/* Détail de la ligne de Routage */}
      <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 relative overflow-hidden flex flex-col p-8 shadow-sm">
         {selectedRule ? (
            <div className="max-w-2xl mx-auto w-full">
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-1 text-slate-800">{selectedRule.name}</h2>
                   <p className="text-xs font-semibold text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded uppercase tracking-wider mb-2">Code: {selectedRule.code}</p>
                   <p className="text-slate-500 font-medium italic">{selectedRule.description || "Aucune description"}</p>
                 </div>
                 <button
                   onClick={() => handleOpenEdit(selectedRule)}
                   className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-rdpc-blue hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm shrink-0"
                 >
                   <span className="material-symbols-outlined text-[16px]">edit</span>
                   Modifier
                 </button>
               </div>

               {/* Route Builder Visualization */}
               <div className="flex flex-col gap-2">
                  <div className="p-6 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50">
                     <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-4">Critères de ciblage (ET)</h4>
                     <div className="space-y-4">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined">category</span>
                           </div>
                           <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Type de document</p>
                                <p className="font-black text-slate-800 italic uppercase">
                                  {getRuleCategoryIds(selectedRule).length > 0
                                    ? getRuleCategoryIds(selectedRule).map(getCategoryName).join(' • ')
                                    : 'Tous les types'}
                                </p>
                             </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                               <span className="material-symbols-outlined">corporate_fare</span>
                            </div>
                            <div>
                               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unité Organisationnelle</p>
                               <p className="font-black text-slate-800 italic uppercase">
                                 {getRuleOrgUnitIds(selectedRule).length > 0
                                   ? getRuleOrgUnitIds(selectedRule).map(getOrgUnitName).join(' • ')
                                   : 'Toutes les unités'}
                               </p>
                            </div>
                         </div>
                      </div>
                   </div>

                  <div className="flex justify-center -my-2 relative z-10">
                     <div className="w-10 h-10 bg-rdpc-blue text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200 border-4 border-white">
                        <span className="material-symbols-outlined">route</span>
                     </div>
                  </div>

                  <div className="p-6 rounded-[2rem] border-2 border-blue-100 bg-blue-50/50">
                     <h4 className="text-[10px] uppercase font-black tracking-widest text-rdpc-blue mb-4">Déclenchement du workflow</h4>
                     <div className="flex items-center justify-between">
                        <div>
                           <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Modèle de circuit appliqué</p>
                           <p className="text-lg font-black text-slate-800 italic tracking-tighter uppercase">{getTemplateName(selectedRule.workflow_template_id)}</p>
                        </div>
                        <span className="material-symbols-outlined text-4xl text-rdpc-blue opacity-50">account_tree</span>
                     </div>
                  </div>
               </div>
            </div>
         ) : (
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-12 h-12 rounded-2xl bg-blue-100 text-rdpc-blue flex items-center justify-center shrink-0">
                   <span className="material-symbols-outlined">directions</span>
                 </div>
                 <div>
                   <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 leading-tight">Qu'est-ce qu'une règle d'aiguillage ?</h2>
                   <p className="text-xs italic text-slate-500 font-medium">Le système qui envoie automatiquement chaque document au bon circuit.</p>
                 </div>
               </div>

               <p className="text-sm text-slate-600 leading-relaxed mb-6">
                 Une règle suit la logique <span className="font-bold text-slate-800">« SI ce type de document arrive dans ce service, ALORS applique ce circuit »</span>. Sans règles, chaque document doit être affecté à la main. Avec des règles, l'aiguillage est instantané.
               </p>

               <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/50 p-5 mb-6">
                 <p className="text-[10px] font-black uppercase tracking-widest text-rdpc-blue mb-3">Exemple concret</p>
                 <div className="space-y-3 text-sm">
                   <div className="flex items-start gap-3">
                     <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-[9px] font-black uppercase tracking-widest shrink-0 mt-0.5">SI</span>
                     <p className="text-slate-700"><span className="font-bold">Type de document</span> = « Facture fournisseur » <span className="italic text-slate-400">ET</span> <span className="font-bold">Service</span> = « Direction Financière »</p>
                   </div>
                   <div className="flex items-start gap-3">
                     <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest shrink-0 mt-0.5">ALORS</span>
                     <p className="text-slate-700">Déclencher le <span className="font-bold">circuit « Validation comptable »</span> (Vérification → Approbation N+1 → Signature)</p>
                   </div>
                 </div>
               </div>

               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Une règle se compose de 3 ingrédients</p>
               <div className="grid grid-cols-3 gap-3 mb-6">
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                   <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-2">
                     <span className="material-symbols-outlined text-base">category</span>
                   </div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Type de doc</div>
                   <p className="text-xs text-slate-600 leading-snug">Lequel ? (ex: facture, courrier, arrêté). Géré dans l'onglet <span className="font-bold">Types de documents</span>.</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                   <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-2">
                     <span className="material-symbols-outlined text-base">corporate_fare</span>
                   </div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Service</div>
                   <p className="text-xs text-slate-600 leading-snug">Où ? Optionnel — vide = la règle s'applique à tous les services.</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                   <div className="w-8 h-8 rounded-lg bg-blue-100 text-rdpc-blue flex items-center justify-center mb-2">
                     <span className="material-symbols-outlined text-base">account_tree</span>
                   </div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Circuit</div>
                   <p className="text-xs text-slate-600 leading-snug">Quoi faire ? Le chemin de validation à suivre. Géré dans l'onglet <span className="font-bold">Circuits de validation</span>.</p>
                 </div>
               </div>

               <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-amber-600 text-base">priority_high</span>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Priorité — ordre d'application des règles</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    Si un document correspond à <span className="font-bold">plusieurs règles à la fois</span>, le système applique d'abord <span className="font-bold">la règle la plus haute dans cette liste</span>. En arrière-plan, cela correspond aussi à la <span className="font-bold">plus petite priorité technique</span>.
                  </p>
                  <div className="text-xs bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-slate-500 italic mb-1">Exemple : un rapport arrive au Service des Applications</p>
                    <ul className="space-y-1 text-slate-700">
                      <li>• Règle A — « Circuit par défaut » placée plus bas dans la liste</li>
                      <li>• Règle B — « Documents techniques SSI » placée plus haut dans la liste ← appliquée</li>
                    </ul>
                  </div>
                  <p className="text-[11px] italic text-slate-400 mt-2">Conseil : placez les règles les plus spécifiques en haut, puis laissez les règles génériques plus bas. Les flèches de réordonnancement mettent la priorité à jour automatiquement.</p>
               </div>

               <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                 <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">lightbulb</span>
                 <p className="text-xs text-amber-900 leading-relaxed">
                   <span className="font-black uppercase tracking-wider mr-1">Avant de créer une règle —</span>
                   assurez-vous que le <span className="font-bold">type de document</span> et le <span className="font-bold">circuit</span> existent déjà. Sans eux, vous n'aurez rien à choisir dans les listes déroulantes.
                 </p>
               </div>
            </div>
         )}
      </div>

      {/* CONFIRM MODAL */}
      {confirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${confirm.tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                <span className="material-symbols-outlined">{confirm.tone === 'danger' ? 'warning' : 'help'}</span>
              </div>
              <div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight italic text-lg leading-tight">{confirm.title}</h3>
                <p className="text-sm text-slate-500 italic mt-2">{confirm.message}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirm(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-colors">Annuler</button>
              <button
                onClick={() => { const cb = confirm.onConfirm; setConfirm(null); cb(); }}
                className={`flex-1 py-3 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-colors ${confirm.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-rdpc-blue hover:bg-black'}`}
              >
                {confirm.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[120] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 ${toast.tone === 'success' ? 'bg-emerald-600' : toast.tone === 'error' ? 'bg-red-600' : 'bg-slate-800'} text-white`}>
          <span className="material-symbols-outlined">{toast.tone === 'success' ? 'check_circle' : toast.tone === 'error' ? 'error' : 'info'}</span>
          <p className="font-bold italic text-sm">{toast.message}</p>
        </div>
      )}

      {/* Dialog : saisie en cours non sauvegardée */}
      {showCloseWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
            <div className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">edit_note</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase italic tracking-tight text-base leading-tight">
                    Saisie en cours
                  </h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Vous êtes en train de configurer une nouvelle règle. Si vous quittez maintenant, votre saisie sera perdue.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={resetAndClose}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  Abandonner
                </button>
                <button
                  onClick={() => setShowCloseWarning(false)}
                  className="flex-1 py-3 bg-rdpc-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-800 transition-colors"
                >
                  Continuer la saisie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Creation */}
      {isModalOpen && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in py-10">
             <div className="bg-white rounded-[2.5rem] w-full max-w-xl max-h-full flex flex-col shadow-2xl relative">
                  <div className="p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rdpc-blue text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                           <span className="material-symbols-outlined">directions</span>
                        </div>
                        <div>
                           <h2 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-tight">{editingRuleId ? 'Modifier la Règle' : 'Nouvelle Règle'}</h2>
                           <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Routage automatique</p>
                        </div>
                     </div>
                     <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 shadow-sm hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-sm">close</span>
                     </button>
                  </div>

                  <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                     <div className="mb-6 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
                       <span className="material-symbols-outlined text-rdpc-blue text-base shrink-0 mt-0.5">info</span>
                       <p className="text-xs text-slate-600 leading-relaxed">
                         Une règle dit : <span className="font-bold text-slate-800">« SI</span> ce type de document arrive dans ce service <span className="font-bold text-slate-800">ALORS</span> applique ce circuit ». Remplissez le SI (Conditions) puis le ALORS (Action).
                       </p>
                     </div>
                     <form id="rule-form" onSubmit={handleCreate} className="space-y-6">
                        <div>
                           <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nom de la règle</label>
                           <input
                             type="text" required
                             placeholder="Ex: Factures Direction Financière"
                             value={newRule.name}
                             onChange={e => {
                               const name = e.target.value;
                               updateRule({
                                 name,
                                 code: codeEdited ? newRule.code : slugifyCode(name),
                               });
                             }}
                             className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                           />
                           <p className="text-[10px] text-slate-400 italic mt-1 ml-1">
                             Identifiant technique : <span className="font-mono font-bold text-slate-500">{newRule.code || slugifyCode(newRule.name) || '—'}</span>
                             {' · '}
                             <button type="button" onClick={() => setShowAdvanced(s => !s)} className="text-rdpc-blue font-bold hover:underline">
                               {showAdvanced ? 'masquer' : 'modifier'}
                             </button>
                           </p>
                           {showAdvanced && (
                             <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                               <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Code technique (avancé)</label>
                               <input
                                 type="text"
                                 placeholder="R_FACT_01"
                                 value={newRule.code}
                                 onChange={e => {
                                   setCodeEdited(true);
                                   setNewRule({...newRule, code: slugifyCode(e.target.value)});
                                 }}
                                 className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-2 px-3 text-sm font-mono font-bold text-slate-700 uppercase focus:outline-none focus:border-rdpc-blue"
                               />
                               <p className="text-[10px] text-slate-400 italic mt-1">Lettres, chiffres, _ uniquement.</p>
                             </div>
                           )}
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Description (Optionnel)</label>
                            <input type="text" placeholder="À quoi sert cette règle, en une phrase" value={newRule.description} onChange={e => setNewRule({...newRule, description: e.target.value})} className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium italic focus:outline-none focus:border-rdpc-blue" />
                        </div>

                        <div className="p-6 bg-purple-50/40 border-2 border-purple-100 rounded-[2rem] space-y-4">
                           <h4 className="text-[10px] uppercase font-black text-purple-700 tracking-widest mb-1 flex items-center gap-2"><span className="material-symbols-outlined text-xs">filter_alt</span> SI — Conditions</h4>
                           <p className="text-[11px] italic text-slate-500 -mt-2 ml-1">À quel document s'applique cette règle ?</p>
                           <div>
                               <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Types de documents ciblés <span className="text-red-500">*</span></label>
                               <div className="flex flex-wrap gap-2 mt-2">
                                  {categories.map(cat => {
                                    const isSelected = newRule.document_category_ids.includes(cat.id);
                                    return (
                                      <button
                                        type="button"
                                        key={cat.id}
                                        onClick={() => {
                                           const newIds = isSelected
                                             ? newRule.document_category_ids.filter(id => id !== cat.id)
                                             : [...newRule.document_category_ids, cat.id];
                                           setNewRule({...newRule, document_category_ids: newIds});
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] uppercase tracking-wider font-bold border transition-all ${isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'}`}
                                      >
                                        {cat.name}
                                      </button>
                                    );
                                  })}
                               </div>
                               {categories.length === 0 && (
                                 <p className="text-[11px] italic text-amber-600 mt-1 ml-1">Aucun type de document. Créez-en un d'abord dans l'onglet « Types de documents ».</p>
                               )}
                            </div>
                            <div>
                               <div className="flex justify-between items-end mb-2">
                                 <label className="text-[10px] font-bold uppercase text-slate-500 ml-1">Services ciblés <span className="text-slate-400 normal-case italic font-normal">(optionnel)</span></label>
                                 <button type="button" onClick={() => setNewRule({...newRule, org_unit_ids: []})} className="text-[10px] uppercase font-bold text-slate-400 hover:text-slate-600">Tout désélectionner</button>
                               </div>
                               <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                                  {orgUnits.map(ou => {
                                    const isSelected = newRule.org_unit_ids.includes(ou.id);
                                    return (
                                      <button
                                        type="button"
                                        key={ou.id}
                                        onClick={() => {
                                           const newIds = isSelected
                                             ? newRule.org_unit_ids.filter(id => id !== ou.id)
                                             : [...newRule.org_unit_ids, ou.id];
                                           setNewRule({...newRule, org_unit_ids: newIds});
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${isSelected ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                                      >
                                        {ou.name}
                                      </button>
                                    );
                                  })}
                               </div>
                               <p className="text-[11px] italic text-slate-400 mt-2 ml-1 flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">info</span> Laissez vide (aucun service sélectionné) pour appliquer la règle partout.</p>
                           </div>
                        </div>

                        <div className="p-6 bg-blue-50/50 border-2 border-blue-100 rounded-[2rem] space-y-4">
                            <h4 className="text-[10px] uppercase font-black text-rdpc-blue tracking-widest mb-1 flex items-center gap-2"><span className="material-symbols-outlined text-xs">bolt</span> ALORS — Action</h4>
                            <p className="text-[11px] italic text-slate-500 -mt-2 ml-1">Quel circuit déclencher quand les conditions sont réunies ?</p>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-blue-600 ml-1">Circuit de validation à déclencher <span className="text-red-500">*</span></label>
                              <select required value={newRule.workflow_template_id} onChange={e => setNewRule({...newRule, workflow_template_id: e.target.value})} className="w-full mt-1 bg-white border border-blue-200 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue">
                                  <option value="">-- Sélectionner un circuit --</option>
                                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                               </select>
                               {templates.length === 0 && (
                                 <p className="text-[11px] italic text-amber-600 mt-1 ml-1">Aucun circuit disponible. Créez-en un d'abord dans l'onglet « Circuits de validation ».</p>
                               )}
                            </div>
                         </div>
                      </form>
                   </div>

                   <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2.5rem] shrink-0">
                      <button type="submit" form="rule-form" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rdpc-blue transition-colors">
                         Enregistrer la Règle
                      </button>
                   </div>
              </div>
          </div>
       )}
     </div>
  );
};
export default RulesTab;
