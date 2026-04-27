// frontend/profiles/tenant-admin/pages/gedrules/CategoriesTab.tsx
import React, { useState, useEffect } from 'react';
import { categoriesApi, DocumentCategory } from '../../../../services/categories.api';

type ConfirmState = { title: string; message: string; confirmLabel?: string; tone?: 'danger' | 'primary'; onConfirm: () => void } | null;
type Toast = { tone: 'success' | 'error' | 'info'; message: string } | null;

const CategoriesTab: React.FC = () => {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (t: NonNullable<Toast>) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  };

  const [newCat, setNewCat] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true
  });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [importing, setImporting] = useState(false);

  const STANDARD_SET: Array<{ code: string; name: string; description: string }> = [
    { code: 'courrier_entrant', name: 'Courrier entrant', description: 'Lettres et correspondances reçues de l\'extérieur (ministères, administrés, partenaires)' },
    { code: 'courrier_sortant', name: 'Courrier sortant', description: 'Lettres et correspondances émises par le ministère' },
    { code: 'note_service', name: 'Note de service', description: 'Communications internes diffusées au personnel' },
    { code: 'decision', name: 'Décision', description: 'Décisions administratives nominatives ou réglementaires' },
    { code: 'arrete', name: 'Arrêté', description: 'Arrêtés ministériels et conjoints' },
    { code: 'facture', name: 'Facture', description: 'Factures fournisseurs et pièces comptables' },
    { code: 'contrat', name: 'Contrat', description: 'Contrats, conventions et marchés' },
    { code: 'rapport', name: 'Rapport', description: 'Rapports d\'activité, de mission, techniques' },
    { code: 'demande_conge', name: 'Demande de congé', description: 'Demandes de congé du personnel' },
    { code: 'bon_commande', name: 'Bon de commande', description: 'Bons de commande émis aux fournisseurs' },
    { code: 'pv_reunion', name: 'PV de réunion', description: 'Procès-verbaux de réunions internes et externes' },
  ];

  const importStandardSet = () => {
    setConfirm({
      title: 'Importer le set standard',
      message: `Créer ${STANDARD_SET.length} types de documents standards ? Les types déjà existants seront ignorés.`,
      confirmLabel: 'Importer',
      tone: 'primary',
      onConfirm: async () => {
        setConfirm(null);
        setImporting(true);
        let created = 0;
        let skipped = 0;
        for (const cat of STANDARD_SET) {
          try {
            await categoriesApi.create({ ...cat, is_active: true });
            created++;
          } catch (err: any) {
            if (err?.status === 400) skipped++;
            else console.error('Import error for', cat.code, err);
          }
        }
        setImporting(false);
        showToast({ tone: 'success', message: `${created} type(s) créé(s), ${skipped} ignoré(s).` });
        loadCategories();
      },
    });
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.list(true); // Include inactive to let admin toggle them
      setCategories(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.code || !newCat.name) {
      showToast({ tone: 'error', message: 'Le code et le nom sont requis.' });
      return;
    }
    try {
      const payload = {
        ...newCat,
        code: newCat.code.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_')
      };
      await categoriesApi.create(payload);
      setIsModalOpen(false);
      setNewCat({ code: '', name: '', description: '', is_active: true });
      setCodeManuallyEdited(false);
      showToast({ tone: 'success', message: `Type "${newCat.name}" créé.` });
      loadCategories();
    } catch (err: any) {
      console.error(err);
      if (err?.status === 400) {
        showToast({ tone: 'error', message: 'Un type avec ce code existe déjà.' });
      } else {
        showToast({ tone: 'error', message: 'Erreur lors de la création.' });
      }
    }
  };

  const toggleActive = async (cat: DocumentCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await categoriesApi.update(cat.id, { is_active: !cat.is_active });
      loadCategories();
    } catch (error) {
      console.error(error);
    }
  };

  const deleteCategory = (cat: DocumentCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirm({
      title: 'Désactiver ce type ?',
      message: `Le type "${cat.name}" ne pourra plus être sélectionné, mais les documents existants le conserveront.`,
      confirmLabel: 'Désactiver',
      tone: 'danger',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await categoriesApi.delete(cat.id);
          showToast({ tone: 'success', message: `Type "${cat.name}" désactivé.` });
          loadCategories();
        } catch (error) {
          console.error(error);
          showToast({ tone: 'error', message: 'Erreur lors de la désactivation.' });
        }
      },
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-18rem)] overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-500 font-medium italic">
          Gestion des types de documents disponibles pour cette organisation. Ces éléments permettent de classer et de distribuer les documents selon les règles configurées.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={importStandardSet}
            disabled={importing}
            className="px-5 py-3 bg-white border-2 border-purple-200 text-purple-700 rounded-[1.5rem] font-bold hover:bg-purple-50 transition-all flex justify-center items-center gap-2 uppercase tracking-widest italic disabled:opacity-50"
            title={`Crée ${STANDARD_SET.length} types courants en un clic (Courrier, Note, Facture, Arrêté, etc.)`}
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            {importing ? 'Import...' : 'Importer le set standard'}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-3 bg-purple-600 text-white rounded-[1.5rem] font-bold shadow-lg shadow-purple-200 hover:bg-black transition-all flex justify-center items-center gap-2 uppercase tracking-widest italic"
          >
            <span className="material-symbols-outlined">add</span>
            Nouveau Type
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="text-center italic text-slate-400 col-span-full">Chargement...</div>
        ) : categories.length === 0 ? (
          <div className="col-span-full text-center italic text-slate-400 p-10 border-2 border-dashed border-slate-200 rounded-[2rem]">Aucun type de document configuré</div>
        ) : (
          categories.map(c => (
            <div key={c.id} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all relative">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm tracking-tight uppercase italic font-black text-slate-800">{c.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Code: {c.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                      onClick={(e) => toggleActive(c, e)}
                      className={`w-8 h-4 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${c.is_active ? 'bg-green-500 justify-end' : 'bg-slate-300 justify-start'}`}
                  >
                    <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                  </div>
                  <button onClick={(e) => deleteCategory(c, e)} className="text-slate-300 hover:text-red-500 rounded-full w-6 h-6 flex items-center justify-center bg-slate-50 hover:bg-red-50"><span className="material-symbols-outlined text-xs">delete</span></button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 line-clamp-2 italic">{c.description || "Aucune description"}</p>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in py-10">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl relative">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                     <span className="material-symbols-outlined">category</span>
                  </div>
                  <div>
                     <h2 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-tight">Nouveau Type de Document</h2>
                  </div>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 shadow-sm hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
               </button>
            </div>

            <form onSubmit={handleCreate} className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nom du type de document *</label>
                <input
                  type="text" required value={newCat.name}
                  autoFocus
                  onChange={e => {
                    const name = e.target.value;
                    const autoCode = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                    setNewCat({ ...newCat, name, code: codeManuallyEdited ? newCat.code : autoCode });
                  }}
                  placeholder="Ex: Facture Fournisseur"
                  className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-purple-600 transition-colors"
                />
                {newCat.code && (
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-2">
                    Identifiant technique généré : <span className="font-bold text-slate-500">{newCat.code}</span>
                    {!codeManuallyEdited && <button type="button" onClick={() => setCodeManuallyEdited(true)} className="ml-2 underline text-purple-500 hover:text-purple-700">modifier</button>}
                  </p>
                )}
              </div>

              {codeManuallyEdited && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Code système (Unique) *</label>
                  <input
                    type="text" required value={newCat.code}
                    onChange={e => setNewCat({ ...newCat, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    placeholder="Ex: facture_fournisseur"
                    className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-purple-600 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Description (Optionnel)</label>
                <textarea
                  value={newCat.description}
                  onChange={e => setNewCat({ ...newCat, description: e.target.value })}
                  className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium italic text-slate-700 focus:outline-none focus:border-purple-600 transition-colors resize-none"
                  rows={3}
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-purple-600 transition-colors">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${confirm.tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                <span className="material-symbols-outlined">{confirm.tone === 'danger' ? 'warning' : 'help'}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-slate-900 tracking-tight">{confirm.title}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{confirm.message}</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirm.onConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg transition-colors ${confirm.tone === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200'}`}
              >
                {confirm.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[120] animate-in slide-in-from-bottom-4 duration-200">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold ${toast.tone === 'success' ? 'bg-emerald-600 text-white' : toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>
            <span className="material-symbols-outlined">
              {toast.tone === 'success' ? 'check_circle' : toast.tone === 'error' ? 'error' : 'info'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesTab;
