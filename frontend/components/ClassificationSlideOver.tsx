import React, { useState, useEffect, useMemo } from 'react';
import { api, type SpaceTreeNode } from '../services/api';
import type { Document } from '../types';
import { getFileTypeLabel, formatFileSize, formatDate } from '../types';
import { DocumentPreview } from './preview';

interface ClassificationDomainOption {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
}

interface ClassificationActivityOption {
  id: string;
  domain_id: string;
  code: string;
  name: string;
  is_active?: boolean;
}

interface FlatUnitNode extends SpaceTreeNode {
  depth: number;
}

interface ClassificationSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  domains: ClassificationDomainOption[];
  activities: ClassificationActivityOption[];
  flatUnits: FlatUnitNode[];
  onSuccess: () => void;
}

export const ClassificationSlideOver: React.FC<ClassificationSlideOverProps> = ({
  isOpen,
  onClose,
  document,
  domains,
  activities,
  flatUnits,
  onSuccess,
}) => {
  const [domainId, setDomainId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [year, setYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when document changes
  useEffect(() => {
    if (document) {
      setDomainId(document.classification_domain_id || '');
      setActivityId(document.classification_activity_id || '');
      setOrgUnitId(document.classification_target_org_unit_id || document.org_unit_id || '');
      setYear(document.classification_year ? String(document.classification_year) : String(new Date().getFullYear()));
      setError(null);
    }
  }, [document]);

  // Reset activity if domain changes and current activity doesn't belong to it
  useEffect(() => {
    if (activityId) {
      const activity = activities.find(a => a.id === activityId);
      if (activity && domainId && activity.domain_id !== domainId) {
        setActivityId('');
      }
    }
  }, [domainId, activityId, activities]);

  const availableActivities = useMemo(() => {
    return domainId 
      ? activities.filter(a => a.domain_id === domainId).sort((a, b) => a.name.localeCompare(b.name))
      : activities.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [activities, domainId]);

  const previewPath = useMemo(() => {
    if (!document) return '';
    const parts = [];
    
    if (orgUnitId) {
      const unit = flatUnits.find(u => u.id === orgUnitId);
      if (unit) parts.push(unit.name);
    }
    
    if (domainId) {
      const domain = domains.find(d => d.id === domainId);
      if (domain) parts.push(domain.name);
    }
    
    if (activityId) {
      const activity = activities.find(a => a.id === activityId);
      if (activity) parts.push(activity.name);
    }
    
    if (year) {
      parts.push(year);
    }
    
    return parts.join(' / ') || 'Chemin non défini';
  }, [orgUnitId, domainId, activityId, year, flatUnits, domains, activities, document]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.updateDocument(document.id, {
        classification_domain_id: domainId || null,
        classification_activity_id: activityId || null,
        classification_target_org_unit_id: orgUnitId || null,
        classification_year: year ? parseInt(year, 10) : null,
        classification_status: 'classified',
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du classement du document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      {/* Click-away overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="relative flex w-full max-w-[95vw] flex-col bg-white shadow-2xl md:flex-row h-full animate-in slide-in-from-right duration-300">
        
        {/* Left side: Document preview */}
        <div className="hidden flex-1 flex-col bg-slate-100 md:flex border-r border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <h3 className="text-sm font-bold text-slate-800">Aperçu du document</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              {getFileTypeLabel(document.mime_type || document.file_type)}
            </span>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <DocumentPreview
              documentId={document.id}
              filename={document.title}
              mimeType={document.mime_type || document.file_type}
              enabled={isOpen}
            />
          </div>
        </div>

        {/* Right side: Classification Inspector */}
        <div className="flex w-full flex-col md:w-[420px] lg:w-[480px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Inspecteur de classement</h2>
              <p className="text-xs font-medium text-slate-500">Définissez la destination métier</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Document summary */}
            <div className="mb-8 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document sélectionné</p>
              <p className="text-sm font-bold text-slate-800 break-words">{document.title}</p>
              <p className="text-xs font-medium text-slate-500">
                {formatFileSize(document.file_size)} • {formatDate(document.created_at)}
              </p>
            </div>

            <form id="classification-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Service cible
                  </label>
                  <select
                    value={orgUnitId}
                    onChange={(e) => setOrgUnitId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                  >
                    <option value="">Sélectionner un service</option>
                    {flatUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {'— '.repeat(unit.depth)}{unit.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Domaine métier
                  </label>
                  <select
                    value={domainId}
                    onChange={(e) => setDomainId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                  >
                    <option value="">Aucun domaine</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Activité
                  </label>
                  <select
                    value={activityId}
                    onChange={(e) => setActivityId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white disabled:opacity-50"
                    disabled={!domainId && activities.length === 0}
                  >
                    <option value="">Aucune activité</option>
                    {availableActivities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Année
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="YYYY"
                    min="1900"
                    max="2100"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-rdpc-blue focus:bg-white"
                  />
                </div>
              </div>

              {/* Chemin preview (The Killer Feature) */}
              <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Aperçu du chemin métier</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-800">
                  <span className="material-symbols-outlined text-blue-400" style={{ fontSize: '18px' }}>folder_open</span>
                  {previewPath.split(' / ').map((segment, index, array) => (
                    <React.Fragment key={index}>
                      <span>{segment}</span>
                      {index < array.length - 1 && (
                        <span className="text-slate-300">/</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}
            </form>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 p-6">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                form="classification-form"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rdpc-blue px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Classement...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Valider le classement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
