import React, { useEffect, useMemo, useState } from 'react';

import { api } from '../../../services/api';
import { categoriesApi, type DocumentCategory } from '../../../services/categories.api';
import type {
  AuditLogEntry,
  ClassificationReview,
  ResolveClassificationReviewPayload,
} from '../../../types';

interface OrgUnitOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  full_name: string;
  org_unit_id?: string | null;
  role_label?: string | null;
}

interface ClassificationDomainOption {
  id: string;
  name: string;
  is_active?: boolean;
}

interface ClassificationActivityOption {
  id: string;
  domain_id: string;
  name: string;
  is_active?: boolean;
}

interface ReviewFormState {
  domainId: string;
  activityId: string;
  year: string;
  scope: 'person' | 'service' | 'subdirectorate' | 'directorate';
  targetOrgUnitId: string;
  targetUserId: string;
  categoryId: string;
  newFilename: string;
  comment: string;
  relaunchWorkflow: boolean;
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  review_resolved: { label: 'Classement manuel validé', icon: 'task_alt', color: 'bg-emerald-100 text-emerald-700' },
  rule_execution: { label: 'Analyse automatique', icon: 'psychology', color: 'bg-blue-100 text-blue-700' },
  upload: { label: 'Dépôt du document', icon: 'upload_file', color: 'bg-slate-100 text-slate-600' },
  classification: { label: 'Tentative de classement', icon: 'folder_open', color: 'bg-amber-100 text-amber-700' },
  needs_review: { label: 'Mise en attente', icon: 'pending', color: 'bg-orange-100 text-orange-700' },
};

const SCOPE_OPTIONS: Array<{ value: ReviewFormState['scope']; label: string }> = [
  { value: 'person', label: 'Personne' },
  { value: 'service', label: 'Service' },
  { value: 'subdirectorate', label: 'Sous-direction' },
  { value: 'directorate', label: 'Direction' },
];

const defaultFormState: ReviewFormState = {
  domainId: '',
  activityId: '',
  year: new Date().getFullYear().toString(),
  scope: 'service',
  targetOrgUnitId: '',
  targetUserId: '',
  categoryId: '',
  newFilename: '',
  comment: '',
  relaunchWorkflow: true,
};

const ClassificationReviewPage: React.FC = () => {
  const [reviews, setReviews] = useState<ClassificationReview[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [domains, setDomains] = useState<ClassificationDomainOption[]>([]);
  const [activities, setActivities] = useState<ClassificationActivityOption[]>([]);
  const [form, setForm] = useState<ReviewFormState>(defaultFormState);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const showToast = (nextToast: NonNullable<typeof toast>) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 4000);
  };

  const selectedReview = useMemo(
    () => reviews.find((review) => review.id === selectedReviewId) || null,
    [reviews, selectedReviewId]
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );
  const selectedDocument = selectedReview?.document || null;
  const selectedImportItem = selectedReview?.import_job_item || null;
  const selectedReviewTitle =
    selectedDocument?.title ||
    selectedImportItem?.original_filename ||
    'Élément en attente d’arbitrage';
  const selectedReviewCategoryName =
    selectedDocument?.category_name ||
    (selectedImportItem?.detected_document_category_id
      ? categoriesById.get(selectedImportItem.detected_document_category_id) || 'Non classé'
      : 'Non classé');
  const selectedReviewWorkflowStatus = selectedDocument
    ? selectedDocument.status
    : 'En attente de finalisation';
  const selectedReviewProcessingMode =
    selectedDocument?.processing_mode || selectedReview?.processing_mode || 'archive';
  const selectedReviewLogicalPath =
    selectedDocument?.logical_space_path || selectedImportItem?.logical_space_path || null;
  const selectedReviewClassificationStatus =
    selectedDocument?.classification_status || selectedImportItem?.status || 'pending';

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [orgUnitsResp, usersResp, categoriesResp, domainsResp, activitiesResp] = await Promise.allSettled([
          api.getOrgUnits(),
          api.getUsers(),
          categoriesApi.list(),
          api.getClassificationDomains(),
          api.getClassificationActivities(),
        ]);
        if (orgUnitsResp.status === 'fulfilled') setOrgUnits(orgUnitsResp.value);
        if (usersResp.status === 'fulfilled') setUsers(usersResp.value);
        if (categoriesResp.status === 'fulfilled') setCategories(categoriesResp.value);
        if (domainsResp.status === 'fulfilled') {
          setDomains(domainsResp.value.filter((domain: ClassificationDomainOption) => domain.is_active !== false));
        }
        if (activitiesResp.status === 'fulfilled') {
          setActivities(activitiesResp.value.filter((activity: ClassificationActivityOption) => activity.is_active !== false));
        }
        const failures = [orgUnitsResp, usersResp, categoriesResp, domainsResp, activitiesResp].filter(
          (result) => result.status === 'rejected'
        );
        if (failures.length > 0) {
          showToast({
            tone: 'error',
            message: 'Certains référentiels n’ont pas pu être chargés. La revue reste disponible en mode dégradé.',
          });
        }
      } catch (error) {
        console.error('Failed to load classification review reference data', error);
        showToast({ tone: 'error', message: 'Impossible de charger les référentiels de classement.' });
      }
    };

    loadReferenceData();
  }, []);

  const loadReviews = React.useCallback(async () => {
    setLoadingReviews(true);
    try {
      const data = await api.getClassificationReviews();
      setReviews(data);
      setSelectedReviewId((current) => {
        if (current && data.some((review) => review.id === current)) {
          return current;
        }
        return data[0]?.id || '';
      });
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Impossible de charger les documents à classer.' });
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    const review = selectedReview;
    if (!review) {
      setAuditLogs([]);
      setForm(defaultFormState);
      return;
    }

    setForm({
      domainId: review.suggested_domain_id || review.document?.classification_domain_id || review.import_job_item?.resolved_domain_id || '',
      activityId: review.suggested_activity_id || review.document?.classification_activity_id || review.import_job_item?.resolved_activity_id || '',
      year: String(review.suggested_year || review.document?.classification_year || review.import_job_item?.resolved_year || new Date().getFullYear()),
      scope: (review.suggested_scope || review.document?.classification_scope || review.import_job_item?.resolved_scope || 'service') as ReviewFormState['scope'],
      targetOrgUnitId:
        review.suggested_target_org_unit_id ||
        review.document?.classification_target_org_unit_id ||
        review.import_job_item?.resolved_target_org_unit_id ||
        review.document?.org_unit_id ||
        '',
      targetUserId: review.suggested_target_user_id || review.document?.classification_target_user_id || review.import_job_item?.resolved_target_user_id || '',
      categoryId: review.document?.document_category_id || review.import_job_item?.detected_document_category_id || '',
      newFilename: '',
      comment: '',
      relaunchWorkflow: (review.document?.processing_mode || review.processing_mode) === 'process',
    });

    const loadLogs = async () => {
      if (!review.document_id) {
        setAuditLogs([]);
        setLoadingLogs(false);
        return;
      }
      setLoadingLogs(true);
      try {
        const logs = await api.getDocumentAuditLogs(review.document_id);
        setAuditLogs(logs);
      } catch (error) {
        console.error(error);
        setAuditLogs([]);
      } finally {
        setLoadingLogs(false);
      }
    };

    loadLogs();
  }, [selectedReview]);

  const availableActivities = useMemo(() => {
    if (!form.domainId) {
      return activities;
    }
    return activities.filter((activity) => activity.domain_id === form.domainId);
  }, [activities, form.domainId]);

  const availableUsers = useMemo(() => {
    if (form.scope !== 'person') {
      return users;
    }
    if (!form.targetOrgUnitId) {
      return users;
    }
    return users.filter((user) => user.org_unit_id === form.targetOrgUnitId);
  }, [form.scope, form.targetOrgUnitId, users]);

  const validationError = useMemo(() => {
    if (!selectedReview) {
      return 'Sélectionnez une revue.';
    }
    if (!form.domainId) {
      return 'Le domaine est obligatoire.';
    }
    if (!form.activityId) {
      return 'L’activité est obligatoire.';
    }
    const numericYear = Number(form.year);
    if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 2100) {
      return 'L’année de classement doit être comprise entre 1900 et 2100.';
    }
    if (form.scope === 'person' && !form.targetUserId) {
      return 'Choisissez un utilisateur cible pour le scope personne.';
    }
    if (form.scope !== 'person' && !form.targetOrgUnitId) {
      return 'Choisissez un service cible.';
    }
    return null;
  }, [form.activityId, form.domainId, form.scope, form.targetOrgUnitId, form.targetUserId, form.year, selectedReview]);

  useEffect(() => {
    if (form.activityId && !availableActivities.some((activity) => activity.id === form.activityId)) {
      setForm((current) => ({ ...current, activityId: '' }));
    }
  }, [availableActivities, form.activityId]);

  useEffect(() => {
    if (form.scope === 'person' && form.targetUserId) {
      const targetUser = users.find((user) => user.id === form.targetUserId);
      if (targetUser?.org_unit_id && form.targetOrgUnitId !== targetUser.org_unit_id) {
        setForm((current) => ({ ...current, targetOrgUnitId: targetUser.org_unit_id || '' }));
      }
    }
  }, [form.scope, form.targetUserId, form.targetOrgUnitId, users]);

  const handleResolve = async () => {
    if (!selectedReview) {
      return;
    }
    if (validationError) {
      showToast({ tone: 'error', message: validationError });
      return;
    }

    const payload: ResolveClassificationReviewPayload = {
      classification_domain_id: form.domainId,
      classification_activity_id: form.activityId,
      classification_year: Number(form.year),
      classification_scope: form.scope,
      document_category_id: form.categoryId || undefined,
      new_filename: form.newFilename || undefined,
      comment: form.comment || undefined,
      relaunch_workflow: form.relaunchWorkflow,
    };

    if (form.scope === 'person') {
      payload.classification_target_user_id = form.targetUserId || undefined;
    } else {
      payload.classification_target_org_unit_id = form.targetOrgUnitId || undefined;
    }

    setSubmitting(true);
    try {
      const response = await api.resolveClassificationReview(selectedReview.id, payload);
      showToast({
        tone: 'success',
        message: response.workflow_relaunched
          ? 'Classement validé et workflow relancé.'
          : 'Classement validé avec succès.',
      });
      await loadReviews();
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'La résolution manuelle a échoué. Vérifiez les champs saisis.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-700 h-full flex flex-col relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.tone === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <span className="material-symbols-outlined text-base">{toast.tone === 'success' ? 'check_circle' : 'error'}</span>
          {toast.message}
        </div>
      )}

      <div className="shrink-0 flex items-start justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[1.25rem] bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl">rule_folder</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">
              Revue de classement
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Corrigez les destinations métier ambiguës puis relancez le traitement des documents concernés.
            </p>
          </div>
        </div>
        <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 font-black text-sm flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-base">schedule</span>
          {reviews.length} en attente
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 px-1">
            Documents à classer ({reviews.length})
          </p>
          {loadingReviews ? (
            <div className="text-sm text-slate-400 italic px-2">Chargement...</div>
          ) : reviews.length === 0 ? (
            <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">task_alt</span>
              <p className="text-xs italic text-slate-500 leading-relaxed">
                Aucune revue de classement ouverte.
              </p>
            </div>
          ) : (
            reviews.map((review) => (
              <button
                key={review.id}
                type="button"
                onClick={() => setSelectedReviewId(review.id)}
                className={`p-4 rounded-[1.5rem] border-2 text-left transition-all group ${
                  selectedReview?.id === review.id
                    ? 'bg-white border-rdpc-blue shadow-xl ring-2 ring-rdpc-blue/10'
                    : 'bg-white/60 border-transparent hover:bg-white hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">warning</span>
                  <p className="text-sm font-bold text-slate-800 leading-tight">
                    {review.document?.title || review.import_job_item?.original_filename || 'Élément à classer'}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-snug line-clamp-3 ml-6">
                  {review.arbitration_reason || 'Classement manuel requis.'}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="flex-1 bg-white rounded-[2rem] border-2 border-slate-200 p-6 flex flex-col overflow-y-auto custom-scrollbar shadow-sm min-h-0">
          {selectedReview ? (
            <>
              <h3 className="font-black text-lg text-slate-800 mb-1 tracking-tighter uppercase italic">
                {selectedReviewTitle}
              </h3>
              <div className="flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>
                <p className="text-xs text-amber-700 font-bold">{selectedReview.arbitration_reason}</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Document</p>
                  <p className="text-sm font-bold text-slate-800">{selectedReviewCategoryName}</p>
                  <p className="text-xs text-slate-500 mt-1">Statut GED: {selectedReviewWorkflowStatus}</p>
                  <p className="text-xs text-slate-500">Mode: {selectedReviewProcessingMode}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Classement actuel</p>
                  <p className="text-sm font-bold text-slate-800">
                    {selectedReviewLogicalPath || 'Chemin logique à définir'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedReviewClassificationStatus}
                  </p>
                </div>
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                {selectedReview.document_id ? 'Historique du document' : 'Statut du fichier importé'}
              </p>

              {!selectedReview.document_id ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-sm font-bold text-slate-800">Fichier encore en staging</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Le document définitif sera créé après arbitrage humain.
                  </p>
                  {selectedImportItem?.source_relative_path && (
                    <p className="text-xs text-slate-500 mt-2 break-all">
                      Source: {selectedImportItem.source_relative_path}
                    </p>
                  )}
                </div>
              ) : loadingLogs ? (
                <p className="text-sm text-slate-400 italic">Chargement...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Aucun historique disponible.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const meta = ACTION_LABELS[log.action] || { label: log.action, icon: 'history', color: 'bg-slate-100 text-slate-500' };
                    return (
                      <div key={log.id} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                          <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-slate-800 text-sm">{meta.label}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(log.created_at).toLocaleString('fr-FR')}
                            </span>
                          </div>
                          {log.new_data && Object.keys(log.new_data).length > 0 && (
                            <p className="text-xs text-slate-500 mt-1 break-words">
                              {JSON.stringify(log.new_data)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
              <span className="material-symbols-outlined text-5xl">manage_search</span>
              <p className="italic font-bold tracking-widest uppercase text-xs">Sélectionnez une revue</p>
            </div>
          )}
        </div>

        <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-4">
          {selectedReview ? (
            <div className="bg-white rounded-[2rem] border-2 border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-rdpc-blue to-blue-400 shrink-0" />
              <div className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase italic tracking-tighter">
                  <span className="material-symbols-outlined text-rdpc-blue">task_alt</span>
                  Classer et relancer
                </h3>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Domaine</label>
                  <select
                    aria-label="Domaine"
                    value={form.domainId}
                    onChange={(e) => setForm((current) => ({ ...current, domainId: e.target.value, activityId: '' }))}
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                  >
                    <option value="">-- Choisir un domaine --</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>{domain.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Activité</label>
                  <select
                    aria-label="Activité"
                    value={form.activityId}
                    onChange={(e) => setForm((current) => ({ ...current, activityId: e.target.value }))}
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                  >
                    <option value="">-- Choisir une activité --</option>
                    {availableActivities.map((activity) => (
                      <option key={activity.id} value={activity.id}>{activity.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Année</label>
                    <input
                      aria-label="Année"
                      type="number"
                      min={1900}
                      max={2100}
                      value={form.year}
                      onChange={(e) => setForm((current) => ({ ...current, year: e.target.value }))}
                      className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Scope</label>
                    <select
                      aria-label="Scope"
                      value={form.scope}
                      onChange={(e) => setForm((current) => ({ ...current, scope: e.target.value as ReviewFormState['scope'] }))}
                      className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                    >
                      {SCOPE_OPTIONS.map((scope) => (
                        <option key={scope.value} value={scope.value}>{scope.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {form.scope === 'person' ? (
                  <>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Service de rattachement</label>
                      <select
                        aria-label="Service de rattachement"
                        value={form.targetOrgUnitId}
                        onChange={(e) => setForm((current) => ({ ...current, targetOrgUnitId: e.target.value, targetUserId: '' }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                      >
                        <option value="">-- Choisir un service --</option>
                        {orgUnits.map((orgUnit) => (
                          <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Utilisateur cible</label>
                      <select
                        aria-label="Utilisateur cible"
                        value={form.targetUserId}
                        onChange={(e) => setForm((current) => ({ ...current, targetUserId: e.target.value }))}
                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                      >
                        <option value="">-- Choisir un utilisateur --</option>
                        {availableUsers.map((user) => (
                          <option key={user.id} value={user.id}>{user.full_name}{user.role_label ? ` - ${user.role_label}` : ''}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Service cible</label>
                    <select
                      aria-label="Service cible"
                      value={form.targetOrgUnitId}
                      onChange={(e) => setForm((current) => ({ ...current, targetOrgUnitId: e.target.value }))}
                      className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                    >
                      <option value="">-- Choisir un service --</option>
                      {orgUnits.map((orgUnit) => (
                        <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Catégorie documentaire</label>
                  <select
                    aria-label="Catégorie documentaire"
                    value={form.categoryId}
                    onChange={(e) => setForm((current) => ({ ...current, categoryId: e.target.value }))}
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                  >
                    <option value="">-- Conserver la catégorie actuelle --</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Renommer (optionnel)</label>
                  <input
                    aria-label="Renommer"
                    type="text"
                    value={form.newFilename}
                    onChange={(e) => setForm((current) => ({ ...current, newFilename: e.target.value }))}
                    placeholder={selectedReviewTitle}
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm font-bold text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Commentaire de résolution</label>
                  <textarea
                    aria-label="Commentaire de résolution"
                    value={form.comment}
                    onChange={(e) => setForm((current) => ({ ...current, comment: e.target.value }))}
                    placeholder="Pourquoi ce classement est retenu ?"
                    rows={3}
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none rounded-xl py-2.5 px-3 text-sm text-slate-700 resize-none"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.relaunchWorkflow}
                    onChange={(e) => setForm((current) => ({ ...current, relaunchWorkflow: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-rdpc-blue focus:ring-rdpc-blue"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-700">Relancer le workflow</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      En mode process, relancez le routage GED après correction du classement.
                    </p>
                  </div>
                </label>

                {validationError && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                    {validationError}
                  </div>
                )}

                <button
                  onClick={handleResolve}
                  disabled={submitting || Boolean(validationError)}
                  className="w-full py-3 bg-rdpc-blue text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-800 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Traitement...' : 'Classer et relancer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 flex-1 flex flex-col items-center justify-center text-slate-300 p-6 text-center gap-2">
              <span className="material-symbols-outlined text-4xl">task_alt</span>
              <p className="text-xs italic font-bold tracking-widest uppercase">Sélectionnez une revue pour décider</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassificationReviewPage;
