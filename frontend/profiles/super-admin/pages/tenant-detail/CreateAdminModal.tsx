import React, { useMemo, useRef, useState } from 'react';
import { api } from '../../../../services/api';
import { ROLES } from './constants';
import { useDialogA11y, errorMessage } from './hooks';
import type { OrgUnitNode, TenantUser } from './types';

interface CreateAdminModalProps {
  tenantId: string;
  orgTree?: OrgUnitNode[];
  existingUsers?: TenantUser[];
  defaultOrgUnitId?: string | null;
  defaultRole?: string;
  defaultReportsToUserId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onCreated?: (info: { roleCode: string; matricule: string; password?: string }) => void;
}

const collectAncestorOrgIds = (tree: OrgUnitNode[], targetId: string | null | undefined): Set<string> => {
  const result = new Set<string>();
  if (!targetId) return result;
  const path = (nodes: OrgUnitNode[], stack: string[]): string[] | null => {
    for (const n of nodes) {
      const next = [...stack, n.id];
      if (n.id === targetId) return next;
      const found = path(n.children, next);
      if (found) return found;
    }
    return null;
  };
  const found = path(tree, []);
  if (found) found.forEach((id) => result.add(id));
  return result;
};

interface FlatOrgOption {
  id: string;
  label: string;
  depth: number;
}

const flattenOrg = (nodes: OrgUnitNode[], depth = 0, acc: FlatOrgOption[] = []): FlatOrgOption[] => {
  for (const n of nodes) {
    acc.push({ id: n.id, label: `${'— '.repeat(depth)}${n.name} (${n.code})`, depth });
    if (n.children?.length) flattenOrg(n.children, depth + 1, acc);
  }
  return acc;
};

export const CreateAdminModal: React.FC<CreateAdminModalProps> = ({ tenantId, orgTree, existingUsers, defaultOrgUnitId, defaultRole, defaultReportsToUserId, onClose, onSuccess, onCreated }) => {
  const [form, setForm] = useState({
    matricule: '',
    first_name: '',
    last_name: '',
    email: '',
    role_code: defaultRole || 'tenant_admin',
    org_unit_id: defaultOrgUnitId || '',
    reports_to_user_id: defaultReportsToUserId || '',
  });
  const orgOptions = useMemo(() => flattenOrg(orgTree ?? []), [orgTree]);
  const orgRequired = form.role_code !== 'tenant_admin';

  const reportsToOptions = useMemo(() => {
    const users = existingUsers ?? [];
    const ancestorIds = collectAncestorOrgIds(orgTree ?? [], form.org_unit_id || null);
    const sorted = [...users].sort((a, b) => {
      const aPriority = a.org_unit_id && ancestorIds.has(a.org_unit_id) ? 0 : 1;
      const bPriority = b.org_unit_id && ancestorIds.has(b.org_unit_id) ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (a.full_name || a.matricule).localeCompare(b.full_name || b.matricule);
    });
    return sorted.map((u) => {
      const inAncestor = !!(u.org_unit_id && ancestorIds.has(u.org_unit_id));
      return {
        id: u.id,
        label: `${u.full_name || u.matricule} (${u.matricule})${inAncestor ? ' ⬆' : ''}`,
        suggested: inAncestor,
      };
    });
  }, [existingUsers, orgTree, form.org_unit_id]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useDialogA11y(onClose, dialogRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.matricule.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createUser({
        matricule: form.matricule.trim(),
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        role_code: form.role_code,
        tenant_id: tenantId,
        org_unit_id: form.org_unit_id || null,
        reports_to_user_id: form.reports_to_user_id || null,
        is_active: true,
      });
      onSuccess();
      onCreated?.({
        roleCode: form.role_code,
        matricule: form.matricule.trim(),
        password: res?.generated_password,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Création impossible'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-8"
      onClick={() => !submitting && onClose()}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-admin-title"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 id="create-admin-title" className="text-2xl font-black italic uppercase text-slate-900 tracking-tighter">Créer un utilisateur</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 flex items-start gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          <p>Un mot de passe temporaire sécurisé sera généré automatiquement. L'utilisateur devra le changer à sa première connexion.</p>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Matricule *</label>
            <input
              type="text"
              required
              value={form.matricule}
              onChange={(e) => setForm({ ...form, matricule: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
              placeholder="MAT001"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Rôle *</label>
            <select
              value={form.role_code}
              onChange={(e) => setForm({ ...form, role_code: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Prénom</label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Nom</label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Service de rattachement {orgRequired && <span className="text-cam-red">*</span>}
            </label>
            <select
              value={form.org_unit_id}
              onChange={(e) => setForm({ ...form, org_unit_id: e.target.value })}
              required={orgRequired}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
            >
              <option value="">{form.role_code === 'tenant_admin' ? '— Aucun (admin tenant) —' : '— Sélectionner un service —'}</option>
              {orgOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            {orgOptions.length === 0 && (
              <p className="mt-1 text-[10px] text-amber-600 font-bold">
                Aucun service disponible. Créez-en un dans l'onglet Services avant d'ajouter un utilisateur métier.
              </p>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Responsable hiérarchique (N+1)
            </label>
            <select
              value={form.reports_to_user_id}
              onChange={(e) => setForm({ ...form, reports_to_user_id: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 focus:border-rdpc-blue outline-none text-sm"
            >
              <option value="">— Aucun (sommet de la hiérarchie) —</option>
              {reportsToOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">
              ⬆ = utilisateur du même service ou d'un service parent (suggéré). Optionnel.
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !form.matricule.trim()}
            className="flex-1 py-3 rounded-xl bg-rdpc-blue text-white text-xs font-black uppercase tracking-widest hover:bg-blue-800 transition-all disabled:opacity-50"
          >
            {submitting ? 'Création...' : 'Créer & générer le mot de passe'}
          </button>
        </div>
      </form>
    </div>
  );
};
