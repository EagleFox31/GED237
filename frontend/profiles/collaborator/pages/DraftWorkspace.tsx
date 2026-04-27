import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';

const DraftWorkspace: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // State for the submission modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [documentToSubmit, setDocumentToSubmit] = useState<string | null>(null);
  const [selectedValidator, setSelectedValidator] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [docsResp, usersResp] = await Promise.all([
        api.getDocuments(),
        api.getUsers().catch(() => []) // Fallback to empty array if getUsers fails
      ]);
      setDocuments(docsResp);
      setUsers(usersResp);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);

      await api.uploadDocument(formData);

      setShowModal(false);
      fetchData(); // Refresh list
      form.reset();
    } catch (error) {
      console.error("Upload failed", error);
      alert("Erreur lors de l'envoi du document");
    } finally {
      setUploading(false);
    }
  };

  const openSubmitModal = (id: string) => {
    setDocumentToSubmit(id);
    setShowSubmitModal(true);
  };

  const submitWorkflow = async () => {
    if (!documentToSubmit || !selectedValidator) {
      alert("Veuillez sélectionner un valideur.");
      return;
    }

    setSubmitting(true);
    try {
      // Create a 1-step workflow
      const steps = [
        {
          document_id: documentToSubmit,
          step_order: 1,
          label: "Validation Manager",
          assigned_to: selectedValidator
        }
      ];

      await api.createWorkflowSteps(documentToSubmit, steps);
      setShowSubmitModal(false);
      setDocumentToSubmit(null);
      setSelectedValidator('');
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la création du circuit de validation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cam-green/10 text-cam-green rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-3 border border-cam-green/20">
            Espace de Création
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Mon <span className="text-cam-green">Atelier</span></h2>
          <p className="text-slate-500 mt-1 font-medium italic">Rédigez vos notes et soumettez-les au circuit de visa.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-4 bg-cam-green text-white rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 hover:scale-105 transition-all flex items-center gap-3 font-bold uppercase text-xs tracking-widest"
        >
          <span className="material-symbols-outlined text-2xl">add_circle</span>
          Nouveau Document
        </button>
      </div>

      {/* Grid des documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-y-auto p-1">
        {loading ? (
          <p className="text-slate-400 font-bold italic">Chargement de vos brouillons...</p>
        ) : documents.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
            <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">draft</span>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucun document en cours</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="glass p-6 rounded-[2rem] bg-white border-white hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden">
              <span className="material-symbols-outlined text-slate-200 group-hover:text-cam-green mb-4 transition-colors text-4xl">description</span>
              <h4 className="font-black text-slate-800 leading-tight mb-2 group-hover:text-cam-green transition-colors line-clamp-2 min-h-[3rem]">{doc.title}</h4>

              <div className="flex flex-wrap gap-2 mb-4">
                {doc.tags?.map((tag: string, i: number) => (
                  <span key={i} className="text-[8px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold uppercase">{tag}</span>
                ))}
              </div>

              <div className="flex justify-between items-center mt-auto border-t border-slate-50 pt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>

                {doc.status === 'draft' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openSubmitModal(doc.id);
                    }}
                    disabled={submitting}
                    className="px-3 py-1 bg-rdpc-blue text-white rounded-lg text-[9px] font-bold uppercase tracking-wide hover:bg-blue-800 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Soumission...' : 'Soumettre'}
                  </button>
                ) : (
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${doc.status === 'rejected' ? 'bg-red-50 text-red-500' :
                    doc.status === 'validated' || doc.status === 'signed' ? 'bg-green-50 text-green-600' :
                      'bg-yellow-50 text-yellow-600'
                    }`}>
                    {doc.status === 'in_review' ? 'En Validation' : doc.status}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Upload */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="text-2xl font-black text-slate-800 mb-2">Nouveau Document</h3>
            <p className="text-sm text-slate-500 font-medium mb-8">Importez un fichier pour commencer le circuit de validation.</p>

            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Titre du document</label>
                <input name="title" type="text" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 focus:ring-4 focus:ring-green-500/10 transition-all" placeholder="Ex: Note de Service - Mars 2025" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Catégorie</label>
                  <select name="category" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50 appearance-none">
                    <option value="Note">Note de Service</option>
                    <option value="Courrier">Courrier Arrivée</option>
                    <option value="Facture">Facture / Bordereau</option>
                    <option value="Autre">Autre Document</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tags (séparés par virgule)</label>
                  <input name="tags" type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-green/50" placeholder="Urgent, Finance..." />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fichier (PDF, DOCX)</label>
                <div className="relative border-2 border-dashed border-slate-300 bg-slate-50 rounded-2xl p-8 text-center hover:bg-blue-50 hover:border-cam-green transition-all group cursor-pointer">
                  <input name="file" type="file" required className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:text-cam-green mb-2 transition-colors">upload_file</span>
                  <p className="text-xs font-bold text-slate-400 group-hover:text-cam-green uppercase tracking-wider">Cliquez ou glissez un fichier ici</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-4 bg-cam-green text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-green-200 hover:bg-green-700 hover:scale-[1.02] transition-all disabled:opacity-70 disabled:hover:scale-100"
              >
                {uploading ? 'Envoi en cours...' : 'Créer le Document'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Workflow Submit */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => {
                setShowSubmitModal(false);
                setDocumentToSubmit(null);
              }}
              className="absolute top-6 right-6 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="text-2xl font-black text-slate-800 mb-2">Circuit de Validation</h3>
            <p className="text-sm text-slate-500 font-medium mb-8">Choisissez la personne qui doit valider ce document.</p>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valideur (Manager/Directeur)</label>
                <select
                  value={selectedValidator}
                  onChange={(e) => setSelectedValidator(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-cam-yellow/50 appearance-none"
                >
                  <option value="" disabled>-- Sélectionner un manager --</option>
                  {users.filter(u => u.role_id !== 5).map(user => ( // Simple filter: exclude 'collaborator' role if possible, or show all for now
                    <option key={user.id} value={user.id}>
                      {user.matricule} {user.first_name ? `- ${user.first_name} ${user.last_name || ''}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={submitWorkflow}
                disabled={submitting || !selectedValidator}
                className="w-full py-4 bg-cam-yellow text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-yellow-200 hover:bg-yellow-600 hover:scale-[1.02] transition-all disabled:opacity-70 disabled:hover:scale-100"
              >
                {submitting ? 'Envoi en cours...' : 'Soumettre au visa'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DraftWorkspace;
