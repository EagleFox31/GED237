// frontend/profiles/tenant-admin/pages/gedrules/TemplatesTab.tsx
import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';

type ConfirmState = { title: string; message: string; confirmLabel?: string; tone?: 'danger' | 'primary'; onConfirm: () => void } | null;
type Toast = { tone: 'success' | 'error' | 'info'; message: string } | null;

const slugifyCode = (s: string) => s.toUpperCase().trim().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Affichage : libellé dérivé du couple (role_id, scope) car tous les niveaux
// hiérarchiques partagent role_id=4 (Manager / Valideur) — voir GUIDE_ROUTAGE_HIERARCHIQUE.md
const ROLE_LABELS: Record<number, string> = {
  5: "Agent / Cadre / Exécutant",
  4: "Chef (Service / Bureau)",
  3: "Direction (Directeur, Sous-Directeur)",
  2: "Haute Direction (Secrétaire Général, Cabinet, etc.)"
};

const getRoleScopeLabel = (roleId: number, scope?: string): string => {
  if (roleId === 4) {
    if (scope === 'parent_org_unit') return "Direction (Directeur, Sous-Directeur)";
    if (scope === 'grandparent_org_unit') return "Haute Direction (Secrétaire Général, Cabinet, etc.)";
    return "Chef (Service / Bureau)";
  }
  return ROLE_LABELS[roleId] || `ID: ${roleId}`;
};

const TemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [codeEdited, setCodeEdited] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [unitTypes, setUnitTypes] = useState<{ id: number; code: string; label: string; level: number }[]>([]);
  const showToast = (t: NonNullable<Toast>) => { setToast(t); setTimeout(() => setToast(null), 4000); };

  const [newTemplate, setNewTemplate] = useState<{
    id?: string;
    code: string;
    name: string;
    description: string;
    is_active: boolean;
    steps: any[];
  }>({
    code: '',
    name: '',
    description: '',
    is_active: true,
    steps: []
  });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    api.getOrgUnitTypes().then(setUnitTypes).catch(e => console.error('Fetch unit types failed', e));
  }, []);

  const handleAddStep = () => {
    setNewTemplate({
      ...newTemplate,
      steps: [
        ...newTemplate.steps,
        {
          step_order: newTemplate.steps.length + 1,
          label: '',
          expected_action_type: 'visa',
          role_id: 4,
          assignment_scope: 'same_org_unit'
        }
      ]
    });
  };

  const handleRemoveStep = (index: number) => {
    const updatedSteps = [...newTemplate.steps];
    updatedSteps.splice(index, 1);
    // Reorder
    updatedSteps.forEach((s, i) => { s.step_order = i + 1; });
    setNewTemplate({ ...newTemplate, steps: updatedSteps });
  };

  const handleUpdateStep = (index: number, field: string, value: string | number) => {
    const updatedSteps = [...newTemplate.steps];
    updatedSteps[index][field] = value;
    setNewTemplate({ ...newTemplate, steps: updatedSteps });
  };

  // Sélection unifiée : "agent_same" (Agent dans le service du document) +
  // une option par type d'unité (Service, Sous-Direction, Direction, Ministère…)
  // Toutes les options "manager" sauvegardent role_id=4 et target_unit_type_id du type cible.
  // Sélection unifiée : "agent_same" (Agent dans le service du document) +
  // une option par type d'unité (Service, Sous-Direction, Direction, Ministère…)
  // Toutes les options "manager" sauvegardent role_id=4 et target_unit_type_id du type cible.
  const handleUpdateStepLevel = (index: number, levelKey: string) => {
    const updatedSteps = [...newTemplate.steps];
    if (levelKey === 'agent_same') {
      updatedSteps[index] = {
        ...updatedSteps[index],
        role_id: 5,
        assignment_scope: 'same_org_unit',
        target_unit_type_id: null,
      };
    } else if (levelKey.startsWith('manager_unit_')) {
      const typeId = parseInt(levelKey.replace('manager_unit_', ''), 10);
      updatedSteps[index] = {
        ...updatedSteps[index],
        role_id: 4,
        assignment_scope: 'same_org_unit', // ignoré quand target_unit_type_id est posé
        target_unit_type_id: typeId,
      };
    } else {
      return;
    }
    setNewTemplate({ ...newTemplate, steps: updatedSteps });
  };

  const getStepLevelKey = (step: any): string => {
    if (step.role_id === 5) return 'agent_same';
    if (step.role_id === 4 && step.target_unit_type_id) return `manager_unit_${step.target_unit_type_id}`;

    // Fallback pour les anciennes données (avant ton changement de modèle en base)
    // Pour ne pas afficher "Agent" par défaut sur les anciens circuits
    if (step.role_id === 2) return 'manager_unit_1'; // Haute Direction -> Ministère/Cabinet
    if (step.role_id === 3) return 'manager_unit_2'; // Direction -> Direction
    if (step.role_id === 4 && step.assignment_scope === 'parent_org_unit') return 'manager_unit_3'; // N+1 -> Sous-Direction
    if (step.role_id === 4 && step.assignment_scope === 'same_org_unit') return 'manager_unit_4'; // Chef -> Service

    return 'agent_same';
  };

  const handleOpenCreate = () => {
    setNewTemplate({ code: '', name: '', description: '', is_active: true, steps: [] });
    setCodeEdited(false);
    setShowAdvanced(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: any) => {
    setNewTemplate({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description || '',
      is_active: t.is_active,
      steps: t.steps.map((s: any) => ({ ...s }))
    });
    setCodeEdited(true); // On évite de recalculer le code
    setShowAdvanced(false);
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = newTemplate.code || slugifyCode(newTemplate.name);
    if (!newTemplate.name || !finalCode) {
      showToast({ tone: 'error', message: 'Le nom du circuit est requis.' });
      return;
    }
    if (newTemplate.steps.length === 0) {
      showToast({ tone: 'error', message: 'Ajoutez au moins une étape au circuit.' });
      return;
    }
    const invalidStep = newTemplate.steps.find((s) => !s.label || !s.role_id);
    if (invalidStep) {
      showToast({ tone: 'error', message: 'Chaque étape doit avoir un libellé et un rôle.' });
      return;
    }

    try {
      if (newTemplate.id) {
        await api.updateTemplate(newTemplate.id, { ...newTemplate, code: finalCode });
        showToast({ tone: 'success', message: 'Circuit mis à jour avec succès.' });
        if (selectedTemplate?.id === newTemplate.id) {
            setSelectedTemplate({ ...newTemplate, id: newTemplate.id, code: finalCode });
        }
      } else {
        await api.createTemplate({ ...newTemplate, code: finalCode });
        showToast({ tone: 'success', message: 'Circuit créé avec succès.' });
      }
      setIsModalOpen(false);
      setNewTemplate({ code: '', name: '', description: '', is_active: true, steps: [] });
      setCodeEdited(false);
      setShowAdvanced(false);
      loadTemplates();
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message && error.message !== 'Update template failed' && error.message !== 'Create template failed'
        ? error.message
        : (newTemplate.id ? 'Erreur lors de la mise à jour du circuit.' : 'Erreur lors de la création du circuit.');

      showToast({
        tone: 'error',
        message: errorMessage
      });
    }
  };

  const toggleActive = async (t: any) => {
    try {
      await api.updateTemplate(t.id, { is_active: !t.is_active });
      loadTemplates();
    } catch (error) {
       console.error(error);
    }
  };

  const deleteTemplate = (t: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirm({
      title: 'Supprimer ce circuit ?',
      message: `Le circuit « ${t.name} » sera définitivement supprimé. Les documents qui y sont rattachés ne seront plus aiguillés via ce circuit.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteTemplate(t.id);
          if (selectedTemplate?.id === t.id) setSelectedTemplate(null);
          loadTemplates();
          showToast({ tone: 'success', message: 'Circuit supprimé.' });
        } catch (err) {
          console.error(err);
          showToast({ tone: 'error', message: 'Suppression impossible.' });
        }
      },
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-18rem)]">
      {/* Liste des Circuits */}
      <div className="w-full lg:w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
        <button
          onClick={handleOpenCreate}
          className="w-full mb-4 px-5 py-3 bg-rdpc-blue text-white rounded-[1.5rem] font-bold shadow-lg shadow-blue-200 hover:bg-black transition-all flex justify-center items-center gap-2 uppercase tracking-widest italic"
        >
          <span className="material-symbols-outlined">add</span>
          Nouveau Circuit
        </button>

        {loading ? (
             <div className="text-center italic text-slate-400">Chargement...</div>
        ) : templates.length === 0 ? (
             <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
               <p className="text-xs italic text-slate-500 leading-relaxed">
                 Aucun circuit pour l'instant.<br/>
                 Cliquez sur <span className="font-bold text-rdpc-blue">« Nouveau Circuit »</span> ci-dessus pour en créer un. Le panneau de droite vous explique comment.
               </p>
             </div>
        ) : (
          templates.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTemplate(t)}
              className={`p-5 rounded-[2rem] border transition-all cursor-pointer relative ${selectedTemplate?.id === t.id ? 'bg-white border-rdpc-blue shadow-xl ring-2 ring-rdpc-blue/10' : 'bg-white/60 border-transparent hover:bg-white hover:shadow-md'}`}
            >
               <div className="flex justify-between items-start mb-2">
                 <h3 className={`text-base tracking-tighter uppercase italic font-black ${selectedTemplate?.id === t.id ? 'text-rdpc-blue' : 'text-slate-800'}`}>{t.name}</h3>
                 <div className="flex gap-2">
                    <button onClick={(e) => deleteTemplate(t, e)} className="text-slate-300 hover:text-red-500 rounded-full w-6 h-6 flex items-center justify-center bg-slate-50"><span className="material-symbols-outlined text-xs">delete</span></button>
                    <div
                        onClick={(e) => { e.stopPropagation(); toggleActive(t); }}
                        className={`w-8 h-4 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${t.is_active ? 'bg-green-500 justify-end' : 'bg-slate-300 justify-start'}`}
                    >
                    <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                    </div>
                </div>
               </div>
               <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-3">{t.description}</p>
               <div className="flex items-center gap-2 font-bold text-[10px] uppercase text-slate-400 bg-slate-100 rounded-full w-max px-3 py-1">
                 <span className="material-symbols-outlined text-[14px]">route</span>
                 {t.steps.length} Étapes
               </div>
            </div>
          ))
        )}
      </div>

      {/* Détail du Circuit */}
      <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 relative overflow-hidden flex flex-col p-8 shadow-sm">
         {selectedTemplate ? (
            <div>
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-slate-800">{selectedTemplate.name}</h2>
                   <p className="text-slate-500 font-medium italic">{selectedTemplate.description}</p>
                 </div>
                 <button
                   onClick={() => handleOpenEdit(selectedTemplate)}
                   className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-rdpc-blue hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm"
                 >
                   <span className="material-symbols-outlined text-[16px]">edit</span>
                   Modifier
                 </button>
               </div>

               <h3 className="font-bold text-slate-700 uppercase tracking-widest text-[10px] mb-4">Structure du circuit</h3>

               <div className="space-y-0 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {selectedTemplate.steps.map((step: any, index: number) => (
                    <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Icon Marker */}
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-slate-200 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                            <span className="text-[10px] font-black">{step.step_order}</span>
                        </div>

                        {/* Card */}
                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm mb-4 transition-all hover:shadow-md hover:bg-white">
                           <div className="flex justify-between items-start mb-1">
                               <p className="font-bold text-slate-700 uppercase leading-none tracking-tight">{step.label}</p>
                               {step.expected_action_type === 'approval' ? (
                                   <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full tracking-widest">Approbation</span>
                               ) : step.expected_action_type === 'final_signature' ? (
                                   <span className="text-[9px] font-black uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full tracking-widest">Signature</span>
                               ) : step.expected_action_type === 'read_ack' ? (
                                   <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full tracking-widest">Notification</span>
                               ) : (
                                   <span className="text-[9px] font-black uppercase text-rdpc-blue bg-blue-100 px-2 py-0.5 rounded-full tracking-widest">Visa</span>
                               )}
                           </div>
                           <p className="text-xs text-slate-500 italic mt-2"><span className="font-bold text-slate-400 not-italic mr-1">Rôle cible :</span>{
  step.role_id === 4 && step.target_unit_type_id
    ? `Responsable / Manager au niveau ${unitTypes.find(t => t.id === step.target_unit_type_id)?.label || `type#${step.target_unit_type_id}`}`
    : getRoleScopeLabel(step.role_id, step.assignment_scope)
}</p>
                        </div>
                    </div>
                  ))}
               </div>
            </div>
         ) : (
             <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-12 h-12 rounded-2xl bg-blue-100 text-rdpc-blue flex items-center justify-center shrink-0">
                   <span className="material-symbols-outlined">account_tree</span>
                 </div>
                 <div>
                   <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 leading-tight">Qu'est-ce qu'un circuit de validation ?</h2>
                   <p className="text-xs italic text-slate-500 font-medium">Le chemin que suit un document avant d'être approuvé.</p>
                 </div>
               </div>

               <p className="text-sm text-slate-600 leading-relaxed mb-6">
                 Un <span className="font-bold text-slate-800">circuit</span> définit <span className="font-bold text-slate-800">qui valide quoi, et dans quel ordre</span>. Quand un document est déposé, il passe d'étape en étape selon le circuit choisi. Chaque étape attend l'action d'un rôle précis (visa, approbation, signature).
               </p>

               <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/50 p-5 mb-6">
                 <p className="text-[10px] font-black uppercase tracking-widest text-rdpc-blue mb-3">Exemple — Circuit « Facture fournisseur »</p>
                 <div className="space-y-2">
                   <div className="flex items-center gap-3 text-sm">
                     <span className="w-6 h-6 rounded-full bg-rdpc-blue text-white flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                     <span className="font-bold text-slate-700">Vérification</span>
                     <span className="text-slate-400">→</span>
                     <span className="text-slate-500 italic">Collaborateur (visa)</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm">
                     <span className="w-6 h-6 rounded-full bg-rdpc-blue text-white flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                     <span className="font-bold text-slate-700">Validation hiérarchique</span>
                     <span className="text-slate-400">→</span>
                     <span className="text-slate-500 italic">Responsable (approbation)</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm">
                     <span className="w-6 h-6 rounded-full bg-rdpc-blue text-white flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                     <span className="font-bold text-slate-700">Signature finale</span>
                     <span className="text-slate-400">→</span>
                     <span className="text-slate-500 italic">Admin Institution (signature)</span>
                   </div>
                 </div>
               </div>

               <div className="grid grid-cols-3 gap-3 mb-6">
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">1. Créer</div>
                   <p className="text-xs text-slate-600 leading-snug">Cliquez <span className="font-bold">Nouveau Circuit</span>, donnez-lui un nom métier (ex : « Note de frais »).</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">2. Étapes</div>
                   <p className="text-xs text-slate-600 leading-snug">Ajoutez les étapes dans l'ordre : libellé + rôle qui doit agir + type d'action.</p>
                 </div>
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">3. Activer</div>
                   <p className="text-xs text-slate-600 leading-snug">Le circuit devient sélectionnable dans l'onglet <span className="font-bold">Règles d'aiguillage</span> pour être déclenché automatiquement.</p>
                 </div>
               </div>

               <div className="mb-6">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Les 3 types d'action — quand utiliser quoi ?</p>
                 <div className="space-y-2">
                   <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                     <span className="text-[9px] font-black uppercase text-rdpc-blue bg-blue-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">VISA</span>
                     <div className="text-xs text-slate-600 leading-relaxed">
                       <span className="font-bold text-slate-800">Vérification.</span> L'agent atteste avoir <span className="font-bold">lu et contrôlé</span> le document (forme, conformité, complétude). Il n'engage pas l'institution — il transmet au niveau supérieur.
                       <span className="block italic text-slate-400 mt-1">Ex : un Collaborateur vise une facture pour confirmer que les pièces jointes sont là.</span>
                     </div>
                   </div>
                   <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                     <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">APPROBATION</span>
                     <div className="text-xs text-slate-600 leading-relaxed">
                       <span className="font-bold text-slate-800">Décision hiérarchique.</span> Le responsable <span className="font-bold">accepte ou rejette</span> sur le fond. Sa décision engage son service. Peut renvoyer le document en arrière avec un motif.
                       <span className="block italic text-slate-400 mt-1">Ex : un Responsable approuve une demande d'achat avant signature.</span>
                     </div>
                   </div>
                   <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                     <span className="text-[9px] font-black uppercase text-purple-700 bg-purple-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">SIGNATURE</span>
                     <div className="text-xs text-slate-600 leading-relaxed">
                       <span className="font-bold text-slate-800">Acte final.</span> Engage juridiquement l'institution. <span className="font-bold">Clôt le circuit</span> — le document devient officiel et opposable. Réservée aux autorités habilitées (Admin Institution, Directeur).
                       <span className="block italic text-slate-400 mt-1">Ex : l'Admin Institution signe l'arrêté qui rend la décision exécutoire.</span>
                     </div>
                   </div>
                   <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                     <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">NOTIFICATION</span>
                     <div className="text-xs text-slate-600 leading-relaxed">
                       <span className="font-bold text-slate-800">Prise de connaissance.</span> L'utilisateur est notifié et doit confirmer qu'il a bien reçu et lu le document.
                     </div>
                   </div>
                 </div>
                 <p className="text-[10px] italic text-slate-400 mt-3 ml-1">
                   <span className="font-bold not-italic">Validation</span> est le terme générique qui couvre les quatre — utilisé quand on parle du circuit dans son ensemble.
                 </p>
               </div>

               <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                 <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">lightbulb</span>
                 <p className="text-xs text-amber-900 leading-relaxed">
                   <span className="font-black uppercase tracking-wider mr-1">Astuce —</span>
                   Un même circuit peut être réutilisé pour plusieurs types de documents. Inutile d'en créer un par type ; pensez « profil de validation » plutôt que « formulaire ».
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

      {/* MODAL CREATION */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in py-10">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-full flex flex-col shadow-2xl relative">
            <div className="p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-rdpc-blue text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <span className="material-symbols-outlined">add_road</span>
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-tight">
                        {newTemplate.id ? "Modifier le Circuit" : "Nouveau Circuit"}
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Structure de Workflow</p>
                 </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 shadow-sm hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
               <div className="mb-6 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
                 <span className="material-symbols-outlined text-rdpc-blue text-base shrink-0 mt-0.5">info</span>
                 <p className="text-xs text-slate-600 leading-relaxed">
                   Un circuit décrit <span className="font-bold text-slate-800">qui valide après qui</span>. Donnez-lui un nom métier, puis ajoutez les étapes dans l'ordre (chaque étape = un rôle qui doit agir).
                 </p>
               </div>
               <form id="template-form" onSubmit={handleCreate} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nom du circuit</label>
                    <input
                      type="text" required
                      placeholder="Ex: Circuit de Facturation"
                      value={newTemplate.name}
                      onChange={e => {
                        const name = e.target.value;
                        setNewTemplate(prev => ({
                          ...prev,
                          name,
                          code: codeEdited ? prev.code : slugifyCode(name),
                        }));
                      }}
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    />
                    <p className="text-[10px] text-slate-400 italic mt-1 ml-1">
                      Identifiant technique généré automatiquement : <span className="font-mono font-bold text-slate-500">{newTemplate.code || slugifyCode(newTemplate.name) || '—'}</span>
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
                          placeholder="FACTURE_V1"
                          value={newTemplate.code}
                          onChange={e => {
                            setCodeEdited(true);
                            setNewTemplate({...newTemplate, code: slugifyCode(e.target.value)});
                          }}
                          className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-2 px-3 text-sm font-mono font-bold text-slate-700 uppercase focus:outline-none focus:border-rdpc-blue"
                        />
                        <p className="text-[10px] text-slate-400 italic mt-1">Utilisé en interne par le moteur de règles. Lettres, chiffres, _ uniquement.</p>
                      </div>
                    )}
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Description</label>
                    <textarea
                      required
                      rows={2}
                      value={newTemplate.description}
                      onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium italic text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    />
                 </div>

                 <div className="pt-4 border-t-2 border-dashed border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                       <h3 className="font-black uppercase tracking-tight text-slate-800 italic">Étapes du circuit</h3>
                       <button type="button" onClick={handleAddStep} className="px-3 py-1 bg-blue-50 text-rdpc-blue text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-rdpc-blue hover:text-white transition-colors">
                          + Ajouter
                       </button>
                    </div>

                    <div className="space-y-3">
                       {newTemplate.steps.map((step, index) => (
                         <div key={index} className="p-4 rounded-2xl border-2 border-slate-100 bg-white flex flex-col gap-3 group relative">
                            <button type="button" onClick={() => handleRemoveStep(index)} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                            <div className="flex gap-3">
                               <div className="w-8 shrink-0 flex items-center justify-center">
                                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-black">{step.step_order}</span>
                               </div>
                               <div className="flex-1 grid grid-cols-2 gap-3">
                                  <input
                                     placeholder="Libellé (ex: Validation N+1)" required
                                     value={step.label} onChange={e => handleUpdateStep(index, 'label', e.target.value)}
                                     className="col-span-2 bg-slate-50 border-b-2 border-slate-200 py-2 px-3 text-sm font-bold focus:outline-none focus:border-rdpc-blue"
                                  />
                                  <select
                                     required
                                     value={step.expected_action_type} onChange={e => handleUpdateStep(index, 'expected_action_type', e.target.value)}
                                     className="bg-slate-50 border-b-2 border-slate-200 py-2 px-3 text-[11px] font-black uppercase text-slate-600 focus:outline-none focus:border-rdpc-blue"
                                  >
                                     <option value="visa">Visa — vérification</option>
                                     <option value="approval">Approbation — décision</option>
                                     <option value="final_signature">Signature — acte final</option>
                                     <option value="read_ack">Prise de connaissance (Notification)</option>
                                  </select>
                                  <select
                                     value={getStepLevelKey(step)}
                                     onChange={e => handleUpdateStepLevel(index, e.target.value)}
                                     className="col-span-3 bg-slate-50 border-b-2 border-slate-200 py-2 px-3 text-[11px] font-black tracking-wide text-slate-700 focus:outline-none focus:border-rdpc-blue"
                                     title="Le système remontera l'organigramme jusqu'au premier ancêtre du type choisi, quelle que soit la profondeur du document émetteur."
                                  >
                                     <option value="agent_same">Agent / Cadre / Exécutant — dans le service du document</option>
                                     {unitTypes.map(t => (
                                       <option key={t.id} value={`manager_unit_${t.id}`}>
                                         Responsable / Manager — au niveau {t.label}
                                       </option>
                                     ))}
                                  </select>
                               </div>
                            </div>
                         </div>
                       ))}
                       {newTemplate.steps.length === 0 && (
                          <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 italic font-bold text-slate-400">
                             Aucune étape configurée. Cliquez sur "+ Ajouter".
                          </div>
                       )}
                    </div>
                 </div>
               </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2.5rem] shrink-0">
               <button type="submit" form="template-form" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rdpc-blue transition-colors">
                  {newTemplate.id ? "Mettre à jour le Circuit" : "Enregistrer le Circuit"}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default TemplatesTab;
