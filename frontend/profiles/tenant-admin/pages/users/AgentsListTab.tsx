// frontend/profiles/tenant-admin/pages/users/AgentsListTab.tsx
//
// Onglet 1 — Liste des agents.
//
// Pattern : layout 1/3 (liste filtrable) + 2/3 (détail OU pédagogie).
// Modal pour création/édition. Actions admin via les endpoints dédiés
// (reset-password, toggle-active, disable-mfa). Suppression hard via
// /users/{id} si l'agent n'a aucune ressource liée — sinon utiliser
// désactivation (soft-delete préservant l'historique ISO 15489).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmationModal } from '../../../../components/ui/ConfirmationModal';
import { api } from '../../../../services/api';
import { useAuthStore } from '../../../../stores/authStore';

interface AgentsListTabProps {
  initialAgentId?: string;
  initialAction?: 'create';
  from?: string;
}

type Toast = { tone: 'success' | 'error' | 'info'; message: string } | null;

type RoleOption = { id: number; code: string; name: string; hierarchy_level: number };
type OrgUnitOption = { id: string; name: string; parent_id: string | null };

interface Agent {
  id: string;
  matricule: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  role?: string | null;
  role_label?: string | null;
  role_id?: number | null;
  org_unit_id?: string | null;
  reports_to_user_id?: string | null;
  reports_to?: { id: string; full_name: string; matricule: string; role?: string } | null;
  is_active: boolean;
  must_change_password?: boolean;
  last_login?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

interface AgentFormState {
  id?: string;
  matricule: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  org_unit_id: string;
  reports_to_user_id: string;
  phone: string;
}

const EMPTY_FORM: AgentFormState = {
  matricule: '',
  email: '',
  first_name: '',
  last_name: '',
  role_id: '',
  org_unit_id: '',
  reports_to_user_id: '',
  phone: '',
};

// Libellés humains pour les codes de rôles seedés (tableau de référence
// stable, n'a pas vocation à varier — duplique l'info backend qui pourrait
// être exposée via /assignable-roles plus tard).
const ROLE_HUMAN_LABEL: Record<string, string> = {
  super_admin: 'Super-administrateur',
  tenant_admin: 'Admin Ministère',
  unit_admin: 'Admin du service',
  manager: 'Responsable',
  collab: 'Collaborateur',
  reader: 'Lecteur',
  auditor: 'Auditeur',
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const initialsOf = (agent: Agent) => {
  const first = (agent.first_name || '').trim();
  const last = (agent.last_name || '').trim();
  if (first || last) return ((first[0] || '') + (last[0] || '')).toUpperCase() || '?';
  if (agent.full_name) return agent.full_name.slice(0, 2).toUpperCase();
  return agent.matricule.slice(0, 2).toUpperCase();
};

const ToastView: React.FC<{ toast: NonNullable<Toast> }> = ({ toast }) => (
  <div
    className={`fixed bottom-6 right-6 z-[120] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 ${
      toast.tone === 'success' ? 'bg-emerald-600' : toast.tone === 'error' ? 'bg-red-600' : 'bg-slate-800'
    } text-white max-w-md`}
  >
    <span className="material-symbols-outlined">
      {toast.tone === 'success' ? 'check_circle' : toast.tone === 'error' ? 'error' : 'info'}
    </span>
    <p className="font-bold italic text-sm">{toast.message}</p>
  </div>
);

const AgentsListTab: React.FC<AgentsListTabProps> = ({ initialAgentId, initialAction, from }) => {
  const userProfile = useAuthStore((state) => state.userProfile);
  const tenantId = userProfile?.tenantId || '';
  const navigate = useNavigate();
  // Marqueur pour ne consommer initialAgentId / initialAction qu'une fois
  // (sinon on ré-ouvrirait la modal à chaque re-render).
  const initialAppliedRef = useRef(false);
  // Libellé court pour le breadcrumb / bouton retour.
  const fromLabel = useMemo(() => {
    if (!from) return null;
    if (from.startsWith('/org')) return 'Structure hiérarchique';
    if (from.startsWith('/spaces')) return 'Explorateur documentaire';
    if (from.startsWith('/dashboard')) return 'Tableau de bord';
    return 'la page précédente';
  }, [from]);
  const goBack = () => {
    if (from) navigate(from);
    else navigate(-1);
  };

  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mini-dialogue dédié à l'affichage one-shot du mot de passe temporaire
  // (création OU réinitialisation). Distinct du formulaire d'édition pour ne
  // pas embrouiller l'admin avec un form complet quand seul le mdp compte.
  const [tempPwDialog, setTempPwDialog] = useState<{ agentName: string; password: string } | null>(null);
  // Pattern centralisé pour les actions à confirmer : on ne pollue pas le code
  // métier avec l'UI de la modale. Chaque handle* met à jour ce state ;
  // un seul <ConfirmationModal> en bas du rendu lit ce state et exécute le
  // callback à la confirmation. Évite la duplication + window.confirm() laid.
  type PendingConfirm = {
    title: string;
    message: string;
    confirmLabel: string;
    icon?: string;
    bullets?: string[];
    run: () => Promise<void>;
  } | null;
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  // La recherche par texte est portée par l'URL (`?q=...`) — la barre de
  // recherche globale (Header) écrit dedans et nous lisons. Ainsi la même
  // saisie utilisateur sert au filtrage de cette page.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const setSearch = (next: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next) nextParams.set('q', next);
    else nextParams.delete('q');
    setSearchParams(nextParams, { replace: true });
  };
  const [filterRole, setFilterRole] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM);

  const showToast = (next: NonNullable<Toast>) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 4500);
  };

  const loadData = async () => {
    setLoading(true);
    // allSettled : on tolère qu'un endpoint optionnel échoue (ex : nouvelle
    // route pas encore reload backend) sans masquer la liste principale.
    const [agentsRes, rolesRes, orgUnitsRes] = await Promise.allSettled([
      api.getUsers(),
      api.getAssignableRoles(),
      api.getOrgUnits(),
    ]);
    if (agentsRes.status === 'fulfilled') {
      setAgents((agentsRes.value || []) as Agent[]);
    }
    if (rolesRes.status === 'fulfilled') {
      setRoles(rolesRes.value || []);
    }
    if (orgUnitsRes.status === 'fulfilled') {
      setOrgUnits(
        (orgUnitsRes.value || []).map((u: { id: string; name: string; parent_id?: string | null }) => ({
          id: u.id,
          name: u.name,
          parent_id: u.parent_id ?? null,
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Consomme l'état de navigation à l'arrivée : auto-sélection d'un agent
  // ou ouverture immédiate de la modal de création. Ne s'exécute qu'une fois
  // (initialAppliedRef) pour ne pas relancer à chaque re-render.
  useEffect(() => {
    if (initialAppliedRef.current) return;
    if (initialAction === 'create') {
      setForm(EMPTY_FORM);
      setModalOpen(true);
      initialAppliedRef.current = true;
      return;
    }
    if (initialAgentId && agents.length > 0) {
      const target = agents.find((a) => a.id === initialAgentId);
      if (target) {
        // Reset des filtres pour garantir que l'agent est visible dans la liste.
        setSearch('');
        setFilterRole('');
        setFilterUnit('');
        setFilterStatus('all');
        setSelectedId(initialAgentId);
        initialAppliedRef.current = true;
      }
    }
  }, [agents, initialAgentId, initialAction]);

  // Esc → retour si on a un contexte d'origine.
  useEffect(() => {
    if (!from) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !modalOpen) goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, modalOpen]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents
      .filter((a) => {
        if (filterStatus === 'active' && !a.is_active) return false;
        if (filterStatus === 'inactive' && a.is_active) return false;
        if (filterRole && a.role !== filterRole) return false;
        if (filterUnit && a.org_unit_id !== filterUnit) return false;
        if (!q) return true;
        const haystack = [
          a.full_name,
          a.first_name,
          a.last_name,
          a.matricule,
          a.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [agents, search, filterRole, filterUnit, filterStatus]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedId) || null,
    [agents, selectedId],
  );

  // Détection "agent sélectionné = utilisateur courant" : on compare par
  // matricule (l'UUID DB n'est pas exposé sur userProfile, mais le matricule
  // est unique par tenant). Sert à masquer les actions destructives sur
  // soi-même côté UI (le backend les bloque déjà côté serveur).
  const isSelf = Boolean(
    selectedAgent
      && userProfile?.matricule
      && selectedAgent.matricule === userProfile.matricule,
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setForm({
      id: agent.id,
      matricule: agent.matricule,
      email: agent.email || '',
      first_name: agent.first_name || '',
      last_name: agent.last_name || '',
      role_id: agent.role_id ? String(agent.role_id) : '',
      org_unit_id: agent.org_unit_id || '',
      reports_to_user_id: agent.reports_to_user_id || '',
      phone: agent.phone || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.matricule.trim()) {
      showToast({ tone: 'error', message: 'Le matricule est requis.' });
      return;
    }
    if (!form.role_id) {
      showToast({ tone: 'error', message: 'Le rôle est requis.' });
      return;
    }

    setWorking('agent');
    try {
      if (form.id) {
        await api.updateUser(form.id, {
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role_id: Number(form.role_id),
          org_unit_id: form.org_unit_id || null,
          reports_to_user_id: form.reports_to_user_id || null,
        });
        showToast({ tone: 'success', message: 'Agent mis à jour.' });
        await loadData();
        closeModal();
      } else {
        const response = await api.createUser({
          matricule: form.matricule.trim(),
          email: form.email.trim() || null,
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
          phone: form.phone.trim() || null,
          role_id: Number(form.role_id),
          tenant_id: tenantId,
          org_unit_id: form.org_unit_id || null,
          reports_to_user_id: form.reports_to_user_id || null,
        });
        const generated = response?.generated_password as string | undefined;
        // Création : on ferme le formulaire et on bascule sur le mini-dialog
        // dédié au mdp temporaire (cohérent avec la réinitialisation).
        closeModal();
        if (generated) {
          const createdName = [form.first_name.trim(), form.last_name.trim()]
            .filter(Boolean)
            .join(' ') || form.matricule.trim();
          setTempPwDialog({ agentName: createdName, password: generated });
        } else {
          showToast({ tone: 'success', message: 'Agent créé.' });
        }
        await loadData();
      }
    } catch {
      // Bus centralisé.
    } finally {
      setWorking(null);
    }
  };

  const handleResetPassword = (agent: Agent) => {
    setPendingConfirm({
      title: 'Réinitialiser le mot de passe',
      message: `L’agent « ${agent.full_name} » recevra un mot de passe temporaire qu’il devra changer à sa prochaine connexion.`,
      confirmLabel: 'Réinitialiser',
      icon: 'lock_reset',
      bullets: [
        'Le mot de passe actuel sera invalidé immédiatement.',
        'Le mot de passe temporaire s’affichera une seule fois — transmettez-le à l’agent par un canal sécurisé.',
      ],
      run: async () => {
        setWorking(`reset:${agent.id}`);
        try {
          const result = await api.resetUserPassword(agent.id);
          // Mini-dialogue ciblé : on n'ouvre PAS le form complet, juste un
          // panneau focalisé sur le nouveau mdp à transmettre.
          setTempPwDialog({ agentName: agent.full_name, password: result.temporary_password });
        } catch {
          /* bus */
        } finally {
          setWorking(null);
        }
      },
    });
  };

  const handleToggleActive = (agent: Agent) => {
    const isActive = agent.is_active;
    setPendingConfirm({
      title: isActive ? 'Désactiver l’agent' : 'Réactiver l’agent',
      message: isActive
        ? `« ${agent.full_name} » ne pourra plus se connecter ni recevoir de tâches. Son historique documentaire est conservé et il peut être réactivé à tout moment.`
        : `« ${agent.full_name} » pourra de nouveau se connecter et recevoir des tâches.`,
      confirmLabel: isActive ? 'Désactiver' : 'Réactiver',
      icon: isActive ? 'block' : 'check_circle',
      run: async () => {
        setWorking(`toggle:${agent.id}`);
        try {
          await api.toggleUserActive(agent.id);
          showToast({
            tone: 'success',
            message: isActive
              ? `Agent « ${agent.full_name} » désactivé.`
              : `Agent « ${agent.full_name} » réactivé.`,
          });
          await loadData();
        } catch {
          /* bus */
        } finally {
          setWorking(null);
        }
      },
    });
  };

  const handleDisableMfa = (agent: Agent) => {
    setPendingConfirm({
      title: 'Réinitialiser la double authentification',
      message: `Le secret 2FA actuel de « ${agent.full_name} » sera effacé. À sa prochaine connexion, l’agent devra reconfigurer son application d’authentification (Google Authenticator, etc.).`,
      confirmLabel: 'Réinitialiser le 2FA',
      icon: 'smartphone',
      bullets: [
        'À utiliser uniquement si l’agent a perdu son téléphone ou son accès 2FA.',
        'L’agent ne pourra pas se connecter tant qu’il n’aura pas reconfiguré son application.',
      ],
      run: async () => {
        setWorking(`mfa:${agent.id}`);
        try {
          await api.disableUserMfa(agent.id);
          showToast({ tone: 'success', message: '2FA réinitialisé. L’agent devra le reconfigurer.' });
          await loadData();
        } catch {
          /* bus */
        } finally {
          setWorking(null);
        }
      },
    });
  };

  // Le hard-delete est intentionnellement absent de l'UI (cf. décision
  // produit : soft-delete uniquement via toggle-active). L'endpoint backend
  // /users/{id} DELETE reste disponible pour des nettoyages scriptés.

const orgUnitsById = useMemo(() => new Map(orgUnits.map((u) => [u.id, u.name])), [orgUnits]);

  // Calcule les supérieurs candidats pour le formulaire : tout agent du même
  // service que celui choisi pour l'agent en cours, OU d'un service ancêtre
  // dans l'organigramme (remontée hiérarchique). Pas de contrainte de rôle :
  // un collaborateur peut tout à fait être N+1 d'un autre collaborateur
  // (mentor, "faisant fonction", chef d'équipe non-grade…). L'anti-cycle
  // est géré par le backend (`_validate_reports_to`).
  const supervisorCandidates = useMemo(() => {
    const targetUnitId = form.org_unit_id;
    if (!targetUnitId) {
      // Pas de service choisi → on liste tous les agents actifs (cas où
      // l'admin remplit le supérieur avant le service).
      return agents.filter((a) => a.is_active && a.id !== form.id);
    }
    // Construire l'ensemble des ancêtres (et soi-même) du service cible.
    const orgById = new Map(orgUnits.map((u) => [u.id, u]));
    const allowed = new Set<string>();
    let cursorId: string | null | undefined = targetUnitId;
    const seen = new Set<string>();
    while (cursorId && !seen.has(cursorId)) {
      seen.add(cursorId);
      allowed.add(cursorId);
      cursorId = orgById.get(cursorId)?.parent_id ?? null;
    }
    return agents.filter(
      (a) =>
        a.is_active
        && a.id !== form.id
        && a.org_unit_id != null
        && allowed.has(a.org_unit_id),
    );
  }, [agents, form.id, form.org_unit_id, orgUnits]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3 min-h-0">
      {fromLabel && (
        <button
          type="button"
          onClick={goBack}
          className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-rdpc-blue hover:text-white text-slate-600 text-xs font-bold uppercase tracking-widest transition-colors shrink-0 group"
          aria-label={`Retour vers ${fromLabel}`}
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Retour vers {fromLabel}
          <span className="ml-2 px-1.5 py-0.5 rounded bg-white/30 group-hover:bg-white/20 text-[9px] font-mono">Esc</span>
        </button>
      )}
      {selectedAgent && fromLabel && (
        <nav className="text-[11px] font-medium text-slate-400 shrink-0" aria-label="Breadcrumb">
          <span className="hover:text-slate-600 cursor-pointer" onClick={goBack}>{fromLabel}</span>
          <span className="mx-2">›</span>
          <span className="text-slate-700 font-bold">{selectedAgent.full_name}</span>
        </nav>
      )}
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-0">
      {/* LEFT — Liste des agents */}
      <div className="w-full lg:w-1/3 flex flex-col min-h-0 gap-3">
        <button
          type="button"
          onClick={openCreate}
          className="w-full px-5 py-3 bg-rdpc-blue text-white rounded-[1.5rem] font-bold shadow-lg shadow-blue-200 hover:bg-black transition-all flex justify-center items-center gap-2 uppercase tracking-widest italic shrink-0"
        >
          <span className="material-symbols-outlined">person_add</span>
          Nouvel agent
        </button>

        {/* Filtres — la recherche par texte vit dans la barre globale du Header
            (synchronisée via ?q=). On garde ici les filtres avancés. */}
        <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 space-y-3 shrink-0">
          {search && (
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-[11px] text-slate-500 italic truncate">
                Recherche : <span className="font-bold text-slate-700">« {search} »</span>
              </p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rdpc-blue shrink-0"
                aria-label="Effacer la recherche"
              >
                Effacer
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
              aria-label="Filtrer par rôle"
            >
              <option value="">Tous les rôles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.code}>{ROLE_HUMAN_LABEL[r.code] || r.name}</option>
              ))}
            </select>
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
              aria-label="Filtrer par service"
            >
              <option value="">Tous les services</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${filterStatus === s ? 'bg-rdpc-blue text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : 'Désactivés'}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-2">
          {filteredAgents.length === 0 ? (
            <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
              <p className="text-xs italic text-slate-500 leading-relaxed">
                {agents.length === 0
                  ? 'Aucun agent dans ce ministère pour l\'instant.'
                  : 'Aucun agent ne correspond aux filtres.'}
              </p>
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedId(agent.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedId === agent.id ? 'bg-white border-rdpc-blue shadow-xl ring-2 ring-rdpc-blue/10' : 'bg-white/70 border-transparent hover:bg-white hover:shadow-md'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${agent.is_active ? 'bg-rdpc-blue text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {initialsOf(agent)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold truncate ${selectedId === agent.id ? 'text-rdpc-blue' : 'text-slate-800'}`}>
                        {agent.full_name}
                      </p>
                      {!agent.is_active && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                      {agent.matricule} · {ROLE_HUMAN_LABEL[agent.role || ''] || agent.role_label || agent.role || 'Sans rôle'}
                    </p>
                    {agent.org_unit_id && (
                      <p className="text-[10px] text-slate-500 mt-1 truncate">
                        {orgUnitsById.get(agent.org_unit_id) || '—'}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT — Détail ou pédagogie */}
      <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 relative overflow-hidden flex flex-col p-8 shadow-sm">
        {selectedAgent ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* En-tête fiche */}
            <div className="flex items-start gap-5 mb-8">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 shadow-lg ${selectedAgent.is_active ? 'bg-rdpc-blue text-white shadow-blue-200' : 'bg-slate-200 text-slate-500'}`}>
                {initialsOf(selectedAgent)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800">
                    {selectedAgent.full_name}
                  </h2>
                  {!selectedAgent.is_active && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                      Désactivé
                    </span>
                  )}
                  {selectedAgent.must_change_password && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100">
                      Mot de passe à changer
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-1">
                  {selectedAgent.matricule}
                </p>
                <p className="text-sm text-slate-500 italic mt-2">
                  {ROLE_HUMAN_LABEL[selectedAgent.role || ''] || selectedAgent.role_label || selectedAgent.role || 'Sans rôle'}
                  {selectedAgent.org_unit_id && (
                    <> · {orgUnitsById.get(selectedAgent.org_unit_id) || '—'}</>
                  )}
                </p>
              </div>
            </div>

            {/* Méta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</p>
                <p className="mt-1 text-sm font-bold text-slate-800 break-all">{selectedAgent.email || '—'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{selectedAgent.phone || '—'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supérieur hiérarchique</p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {selectedAgent.reports_to ? selectedAgent.reports_to.full_name : '—'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dernière connexion</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{formatDate(selectedAgent.last_login)}</p>
              </div>
            </div>

            {/* Actions admin */}
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Actions administrateur</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => openEdit(selectedAgent)}
                className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-rdpc-blue hover:text-white transition-all text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Modifier
              </button>
              <button
                type="button"
                onClick={() => { void handleResetPassword(selectedAgent); }}
                disabled={Boolean(working)}
                className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-amber-500 hover:text-white transition-all text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                Réinitialiser le mot de passe
              </button>
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => { void handleDisableMfa(selectedAgent); }}
                  disabled={Boolean(working)}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-amber-500 hover:text-white transition-all text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">smartphone</span>
                  Réinitialiser la double authentification
                </button>
              )}
              {!isSelf && (
                <button
                  type="button"
                  onClick={() => { void handleToggleActive(selectedAgent); }}
                  disabled={Boolean(working)}
                  className={`px-4 py-3 rounded-xl font-bold transition-all text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${selectedAgent.is_active ? 'bg-slate-100 text-slate-700 hover:bg-rose-600 hover:text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{selectedAgent.is_active ? 'block' : 'check_circle'}</span>
                  {selectedAgent.is_active ? 'Désactiver' : 'Réactiver'}
                </button>
              )}
            </div>

            {isSelf ? (
              <div className="mt-5 flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200">
                <span className="material-symbols-outlined text-rdpc-blue text-base shrink-0 mt-0.5">info</span>
                <p className="text-xs text-blue-900 leading-relaxed">
                  <span className="font-black uppercase tracking-wider mr-1">Votre compte —</span>
                  Pour des raisons de sécurité, vous ne pouvez pas vous désactiver vous-même ni réinitialiser votre propre double authentification depuis cet écran. Pour reconfigurer votre 2FA, utilisez le flux <span className="font-bold">Mon profil</span>.
                </p>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">info</span>
                <p className="text-xs text-amber-900 leading-relaxed">
                  <span className="font-black uppercase tracking-wider mr-1">Conseil —</span>
                  La <span className="font-bold">désactivation</span> conserve l&apos;historique documentaire de l&apos;agent (documents, visas, signatures). Préférez-la à toute autre action — un agent désactivé peut être réactivé plus tard.
                </p>
              </div>
            )}
          </div>
        ) : (
          // Pédagogie
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-rdpc-blue flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">badge</span>
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 leading-tight">Qu&apos;est-ce qu&apos;un agent ?</h2>
                <p className="text-xs italic text-slate-500 font-medium">La fiche RH d&apos;un membre de l&apos;administration.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Un <span className="font-bold text-slate-800">agent</span>, c&apos;est un membre du personnel qui possède un compte dans le système. Comme une <span className="font-bold text-slate-800">fiche RH</span> classique : il a un <span className="font-bold text-slate-800">matricule</span>, un <span className="font-bold text-slate-800">rôle</span> qui définit ce qu&apos;il peut faire, et un <span className="font-bold text-slate-800">service de rattachement</span>.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Cette page vous permet de gérer tous les agents de votre ministère : créer leur compte, leur attribuer un rôle, gérer leurs accès et leur mot de passe.
            </p>

            <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/50 p-5 mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-rdpc-blue mb-3">Exemple — Fiche d&apos;un collaborateur</p>
              <div className="space-y-1 text-sm">
                <p><span className="font-bold text-slate-700">Matricule :</span> <span className="font-mono">MINFI001</span></p>
                <p><span className="font-bold text-slate-700">Nom :</span> Mballa Jean</p>
                <p><span className="font-bold text-slate-700">Rôle :</span> Collaborateur</p>
                <p><span className="font-bold text-slate-700">Service :</span> Direction de la Comptabilité</p>
                <p><span className="font-bold text-slate-700">Supérieur :</span> Mme Nkomo (Responsable)</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">1. Inviter</div>
                <p className="text-xs text-slate-600 leading-snug">Cliquez <span className="font-bold">Nouvel agent</span>, renseignez son matricule, son nom, son rôle et son service.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">2. Transmettre</div>
                <p className="text-xs text-slate-600 leading-snug">Le système génère un <span className="font-bold">mot de passe temporaire</span> à transmettre à l&apos;agent par un canal sécurisé.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">3. Suivre</div>
                <p className="text-xs text-slate-600 leading-snug">L&apos;agent est listé. Vous pouvez ensuite <span className="font-bold">modifier</span>, <span className="font-bold">désactiver</span> ou <span className="font-bold">reset son accès</span> à tout moment.</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Bonnes pratiques</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">RÔLE</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Le rôle détermine ce qu&apos;un agent peut <span className="font-bold">voir, créer, valider, signer</span>. Préférez attribuer un rôle de niveau <span className="font-bold">minimal</span> (principe du moindre privilège). Élargissez plus tard si nécessaire.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-rdpc-blue bg-blue-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">PAS DE SUPPRESSION</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Quand un agent quitte ses fonctions, <span className="font-bold">désactivez-le</span> au lieu de le supprimer. Ses documents et son historique restent traçables (norme ISO 15489 — gestion documentaire).
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">SÉCURITÉ</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Si un agent perd son téléphone (2FA) ou oublie son mot de passe, utilisez les boutons <span className="font-bold">Reset</span>. Ne lui communiquez jamais son mot de passe par email non chiffré.
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] italic text-slate-400 leading-relaxed">
              Conforme aux normes <span className="font-bold not-italic">OWASP API 2023</span> (authentification & autorisation), <span className="font-bold not-italic">NIST SP 800-63B</span> (mots de passe) et <span className="font-bold not-italic">ISO 15489</span> (gestion documentaire — pas de suppression destructive).
            </p>
          </div>
        )}
      </div>

      {/* MODAL — Création / édition agent + affichage mdp temporaire */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in py-10">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-full flex flex-col shadow-2xl relative">
            <div className="p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rdpc-blue text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                  <span className="material-symbols-outlined">person_add</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-tight">
                    {form.id ? 'Modifier l\'agent' : 'Nouvel agent'}
                  </h2>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Personnel du ministère</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 shadow-sm hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="mb-6 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
                <span className="material-symbols-outlined text-rdpc-blue text-base shrink-0 mt-0.5">info</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {form.id
                    ? 'Mettez à jour les informations de l\'agent. Le matricule ne peut pas être modifié.'
                    : 'Créez le compte d\'un nouvel agent. Un mot de passe temporaire sera généré automatiquement.'}
                </p>
              </div>

              <form id="agent-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Matricule</label>
                    <input
                      required
                      disabled={Boolean(form.id)}
                      aria-label="Matricule de l'agent"
                      value={form.matricule}
                      onChange={(e) => setForm((p) => ({ ...p, matricule: e.target.value.toUpperCase() }))}
                      placeholder="MINFI001"
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-mono font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email</label>
                    <input
                      type="email"
                      aria-label="Email de l'agent"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="agent@minfi.gov.cm"
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Prénom</label>
                    <input
                      aria-label="Prénom de l'agent"
                      value={form.first_name}
                      onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nom</label>
                    <input
                      aria-label="Nom de l'agent"
                      value={form.last_name}
                      onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Rôle</label>
                    <select
                      required
                      aria-label="Rôle de l'agent"
                      value={form.role_id}
                      onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))}
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    >
                      <option value="">Sélectionner un rôle</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {ROLE_HUMAN_LABEL[r.code] || r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Service de rattachement</label>
                    <select
                      aria-label="Service de l'agent"
                      value={form.org_unit_id}
                      onChange={(e) => setForm((p) => ({ ...p, org_unit_id: e.target.value }))}
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    >
                      <option value="">Aucun</option>
                      {orgUnits.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Supérieur hiérarchique</label>
                    <select
                      aria-label="Supérieur hiérarchique"
                      value={form.reports_to_user_id}
                      onChange={(e) => setForm((p) => ({ ...p, reports_to_user_id: e.target.value }))}
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    >
                      <option value="">Aucun supérieur (en attente)</option>
                      {supervisorCandidates.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name} · {a.matricule}
                          {a.org_unit_id && a.org_unit_id !== form.org_unit_id
                            ? ` · ${orgUnitsById.get(a.org_unit_id) || ''}`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 italic mt-1 ml-1">
                      Filtré sur le service choisi et ses services parents (organigramme).
                      {form.org_unit_id ? '' : ' Choisissez d’abord un service pour affiner.'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Téléphone</label>
                    <input
                      type="tel"
                      aria-label="Téléphone de l'agent"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+237 6XX XX XX XX"
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2.5rem] shrink-0 flex gap-3">
              <button type="button" onClick={closeModal} className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">
                Annuler
              </button>
              <button type="submit" form="agent-form" disabled={working === 'agent'} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rdpc-blue transition-colors disabled:opacity-50">
                {form.id ? 'Mettre à jour' : 'Créer l\'agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPwDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg">
                <span className="material-symbols-outlined text-xl">key</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Mot de passe temporaire
                </p>
                <h3 className="mt-1 text-2xl font-black uppercase italic tracking-tight text-slate-900">
                  Pour {tempPwDialog.agentName}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Voici le mot de passe temporaire à transmettre. Il sera changé par l&apos;agent à sa prochaine connexion.
                </p>
                <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
                  <code className="flex-1 font-mono font-bold text-slate-900 text-base break-all">{tempPwDialog.password}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPwDialog.password);
                      showToast({ tone: 'success', message: 'Mot de passe copié dans le presse-papier.' });
                    }}
                    className="px-3 py-2 bg-amber-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-600 flex items-center gap-1.5 shrink-0"
                    aria-label="Copier le mot de passe"
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span>
                    Copier
                  </button>
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <span className="material-symbols-outlined text-rose-500 text-base shrink-0 mt-0.5">warning</span>
                  <p className="text-xs text-rose-900 leading-relaxed">
                    <span className="font-black uppercase tracking-wider mr-1">Une seule fois —</span>
                    Ce mot de passe ne sera plus jamais affiché. Transmettez-le immédiatement par un canal sécurisé (en main propre, message chiffré).
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setTempPwDialog(null)}
                className="rounded-2xl bg-slate-900 text-white px-6 py-3 text-xs font-black uppercase tracking-widest hover:bg-rdpc-blue transition-colors"
              >
                J&apos;ai noté le mot de passe
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <ToastView toast={toast} />}

      <ConfirmationModal
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        message={pendingConfirm?.message || ''}
        confirmLabel={pendingConfirm?.confirmLabel}
        icon={pendingConfirm?.icon}
        bullets={pendingConfirm?.bullets}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          // Snapshot puis fermeture immédiate : si l'API plante, l'utilisateur
          // n'est pas bloqué dans la modale. Le bus d'erreurs prend le relais.
          const action = pendingConfirm;
          setPendingConfirm(null);
          if (action) void action.run();
        }}
      />
    </div>
    </div>
  );
};

export default AgentsListTab;
