import React, { useEffect, useMemo, useState } from 'react';
import { api, type ClassificationActivityPayload, type ClassificationDomainPayload, type ClassificationRulePayload } from '../../../../services/api';
import { categoriesApi, type DocumentCategory } from '../../../../services/categories.api';
import type {
  ClassificationActivity,
  ClassificationDomain,
  ClassificationRule,
  ClassificationSimulationResponse,
} from '../../../../types';

type Toast = { tone: 'success' | 'error' | 'info'; message: string } | null;
type AdminTab = 'domains' | 'activities' | 'rules' | 'simulator';
type OrgUnitOption = { id: string; name: string };
type UserOption = { id: string; full_name: string; org_unit_id?: string | null; role_label?: string };
type WorkflowTemplateOption = { id: string; name: string; is_active?: boolean };

type DomainFormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
};

type ActivityFormState = {
  id?: string;
  domain_id: string;
  code: string;
  name: string;
  description: string;
};

type RuleFormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  priority: string;
  source_scope: 'person' | 'service' | 'subdirectorate';
  source_org_unit_id: string;
  source_user_id: string;
  document_category_id: string;
  filename_pattern: string;
  mime_type_pattern: string;
  target_scope: 'person' | 'service' | 'subdirectorate' | 'directorate';
  target_org_unit_id: string;
  target_user_id: string;
  domain_id: string;
  activity_id: string;
  year_strategy: 'current' | 'from_filename' | 'from_metadata' | 'fixed';
  fixed_year: string;
  workflow_template_id: string;
  is_active: boolean;
};

type SimulatorFormState = {
  document_category_id: string;
  source_scope: 'person' | 'service' | 'subdirectorate';
  source_org_unit_id: string;
  source_user_id: string;
  filename: string;
  mime_type: string;
};

const EMPTY_DOMAIN: DomainFormState = { code: '', name: '', description: '' };
const EMPTY_ACTIVITY: ActivityFormState = {
  domain_id: '',
  code: '',
  name: '',
  description: '',
};
const EMPTY_RULE: RuleFormState = {
  code: '',
  name: '',
  description: '',
  priority: '100',
  source_scope: 'service',
  source_org_unit_id: '',
  source_user_id: '',
  document_category_id: '',
  filename_pattern: '',
  mime_type_pattern: '',
  target_scope: 'service',
  target_org_unit_id: '',
  target_user_id: '',
  domain_id: '',
  activity_id: '',
  year_strategy: 'current',
  fixed_year: '',
  workflow_template_id: '',
  is_active: true,
};
const EMPTY_SIMULATION: SimulatorFormState = {
  document_category_id: '',
  source_scope: 'service',
  source_org_unit_id: '',
  source_user_id: '',
  filename: 'note_marche_2026.pdf',
  mime_type: 'application/pdf',
};

const TAB_META: Record<AdminTab, { label: string; icon: string; accent: string; step: number }> = {
  domains: { label: 'Domaines métier', icon: 'hub', accent: 'text-sky-600', step: 1 },
  activities: { label: 'Activités', icon: 'account_tree', accent: 'text-emerald-600', step: 2 },
  rules: { label: 'Règles de classement', icon: 'rule', accent: 'text-violet-600', step: 3 },
  simulator: { label: 'Simulateur', icon: 'science', accent: 'text-amber-600', step: 4 },
};

const TAB_ORDER: AdminTab[] = ['domains', 'activities', 'rules', 'simulator'];

const STATUS_STYLES: Record<string, string> = {
  classified: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  needs_review: 'bg-amber-50 text-amber-700 border-amber-100',
  no_rule: 'bg-slate-100 text-slate-700 border-slate-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-100',
};

const slugifyCode = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const formatScope = (scope?: string | null) => {
  if (!scope) return 'Non défini';
  switch (scope) {
    case 'person':
      return 'Personne';
    case 'service':
      return 'Service';
    case 'subdirectorate':
      return 'Sous-direction';
    case 'directorate':
      return 'Direction';
    default:
      return scope;
  }
};

const formatYearStrategy = (strategy: RuleFormState['year_strategy']) => {
  switch (strategy) {
    case 'current':
      return 'Année courante';
    case 'from_filename':
      return 'Depuis le nom de fichier';
    case 'from_metadata':
      return 'Depuis les métadonnées';
    case 'fixed':
      return 'Année fixe';
    default:
      return strategy;
  }
};

const ToastView: React.FC<{ toast: NonNullable<Toast> }> = ({ toast }) => (
  <div
    className={`fixed bottom-6 right-6 z-[120] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 ${
      toast.tone === 'success' ? 'bg-emerald-600' : toast.tone === 'error' ? 'bg-red-600' : 'bg-slate-800'
    } text-white`}
  >
    <span className="material-symbols-outlined">
      {toast.tone === 'success' ? 'check_circle' : toast.tone === 'error' ? 'error' : 'info'}
    </span>
    <p className="font-bold italic text-sm">{toast.message}</p>
  </div>
);

const ClassificationSettingsTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('domains');
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<ClassificationDomain[]>([]);
  const [activities, setActivities] = useState<ClassificationActivity[]>([]);
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplateOption[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [domainForm, setDomainForm] = useState<DomainFormState>(EMPTY_DOMAIN);
  const [activityForm, setActivityForm] = useState<ActivityFormState>(EMPTY_ACTIVITY);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(EMPTY_RULE);
  const [simulationForm, setSimulationForm] = useState<SimulatorFormState>(EMPTY_SIMULATION);
  const [simulationResult, setSimulationResult] = useState<ClassificationSimulationResponse | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [showAdvancedRule, setShowAdvancedRule] = useState(false);

  const showToast = (next: NonNullable<Toast>) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        domainsResp,
        activitiesResp,
        rulesResp,
        orgUnitsResp,
        usersResp,
        categoriesResp,
        templatesResp,
      ] = await Promise.allSettled([
        api.getClassificationDomains(true),
        api.getClassificationActivities({ includeInactive: true }),
        api.getClassificationRules(),
        api.getOrgUnits(),
        api.getUsers(),
        categoriesApi.list(true),
        api.getTemplates(),
      ]);

      if (domainsResp.status === 'fulfilled') setDomains(domainsResp.value);
      if (activitiesResp.status === 'fulfilled') setActivities(activitiesResp.value);
      if (rulesResp.status === 'fulfilled') setRules(rulesResp.value);
      if (orgUnitsResp.status === 'fulfilled') setOrgUnits(orgUnitsResp.value);
      if (usersResp.status === 'fulfilled') setUsers((usersResp.value || []).filter((user: UserOption) => Boolean(user.id)));
      if (categoriesResp.status === 'fulfilled') setCategories(categoriesResp.value);
      if (templatesResp.status === 'fulfilled') setTemplates((templatesResp.value || []).filter((template: WorkflowTemplateOption) => template?.is_active !== false));

      const failed = [domainsResp, activitiesResp, rulesResp, orgUnitsResp, usersResp, categoriesResp, templatesResp].filter(
        (result) => result.status === 'rejected',
      );
      if (failed.length > 0) {
        showToast({
          tone: 'info',
          message: 'Certaines références de paramétrage n’ont pas pu être chargées. Le module reste utilisable en mode dégradé.',
        });
      }
    } catch (error) {
      console.error('Failed to load classification administration data', error);
      showToast({ tone: 'error', message: 'Chargement du module de classement impossible.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [domains, selectedDomainId],
  );
  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedActivityId) ?? null,
    [activities, selectedActivityId],
  );
  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId],
  );

  const activityOptions = useMemo(
    () => activities.filter((activity) => !ruleForm.domain_id || activity.domain_id === ruleForm.domain_id),
    [activities, ruleForm.domain_id],
  );
  const filteredActivities = useMemo(
    () => activities.filter((activity) => !activityForm.domain_id || activity.domain_id === activityForm.domain_id),
    [activities, activityForm.domain_id],
  );
  const simulatorUsers = useMemo(() => {
    if (!simulationForm.source_org_unit_id) return users;
    const scoped = users.filter((user) => user.org_unit_id === simulationForm.source_org_unit_id);
    return scoped.length > 0 ? scoped : users;
  }, [simulationForm.source_org_unit_id, users]);

  useEffect(() => {
    if (selectedDomain) {
      setDomainForm({
        id: selectedDomain.id,
        code: selectedDomain.code,
        name: selectedDomain.name,
        description: selectedDomain.description || '',
      });
    } else {
      setDomainForm(EMPTY_DOMAIN);
    }
  }, [selectedDomain]);

  useEffect(() => {
    if (selectedActivity) {
      setActivityForm({
        id: selectedActivity.id,
        domain_id: selectedActivity.domain_id,
        code: selectedActivity.code,
        name: selectedActivity.name,
        description: selectedActivity.description || '',
      });
    } else {
      setActivityForm(EMPTY_ACTIVITY);
    }
  }, [selectedActivity]);

  useEffect(() => {
    if (selectedRule) {
      setRuleForm({
        id: selectedRule.id,
        code: selectedRule.code,
        name: selectedRule.name,
        description: selectedRule.description || '',
        priority: String(selectedRule.priority ?? 100),
        source_scope: selectedRule.source_scope,
        source_org_unit_id: selectedRule.source_org_unit_id || '',
        source_user_id: selectedRule.source_user_id || '',
        document_category_id: selectedRule.document_category_id || '',
        filename_pattern: selectedRule.filename_pattern || '',
        mime_type_pattern: selectedRule.mime_type_pattern || '',
        target_scope: selectedRule.target_scope,
        target_org_unit_id: selectedRule.target_org_unit_id || '',
        target_user_id: selectedRule.target_user_id || '',
        domain_id: selectedRule.domain_id || '',
        activity_id: selectedRule.activity_id || '',
        year_strategy: selectedRule.year_strategy,
        fixed_year: selectedRule.fixed_year ? String(selectedRule.fixed_year) : '',
        workflow_template_id: selectedRule.workflow_template_id || '',
        is_active: selectedRule.is_active,
      });
    } else {
      setRuleForm(EMPTY_RULE);
    }
  }, [selectedRule]);

  useEffect(() => {
    if (ruleForm.activity_id && !activityOptions.some((activity) => activity.id === ruleForm.activity_id)) {
      setRuleForm((prev) => ({ ...prev, activity_id: '' }));
    }
  }, [activityOptions, ruleForm.activity_id]);

  useEffect(() => {
    if (simulationForm.source_user_id && !simulatorUsers.some((user) => user.id === simulationForm.source_user_id)) {
      setSimulationForm((prev) => ({ ...prev, source_user_id: '' }));
    }
  }, [simulationForm.source_user_id, simulatorUsers]);

  const resetDomainForm = () => {
    setSelectedDomainId(null);
    setDomainForm(EMPTY_DOMAIN);
  };

  const openDomainCreate = () => {
    setSelectedDomainId(null);
    setDomainForm(EMPTY_DOMAIN);
    setDomainModalOpen(true);
  };

  const openDomainEdit = (domain: ClassificationDomain) => {
    setSelectedDomainId(domain.id);
    setDomainForm({
      id: domain.id,
      code: domain.code,
      name: domain.name,
      description: domain.description || '',
    });
    setDomainModalOpen(true);
  };

  const closeDomainModal = () => {
    setDomainModalOpen(false);
  };

  const openActivityCreate = () => {
    setSelectedActivityId(null);
    setActivityForm(EMPTY_ACTIVITY);
    setActivityModalOpen(true);
  };
  const openActivityEdit = (activity: ClassificationActivity) => {
    setSelectedActivityId(activity.id);
    setActivityForm({
      id: activity.id,
      domain_id: activity.domain_id,
      code: activity.code,
      name: activity.name,
      description: activity.description || '',
    });
    setActivityModalOpen(true);
  };
  const closeActivityModal = () => setActivityModalOpen(false);

  const openRuleCreate = () => {
    setSelectedRuleId(null);
    setRuleForm(EMPTY_RULE);
    setShowAdvancedRule(false);
    setRuleModalOpen(true);
  };
  const openRuleEdit = (rule: ClassificationRule) => {
    setSelectedRuleId(rule.id);
    setRuleForm({
      id: rule.id,
      code: rule.code,
      name: rule.name,
      description: rule.description || '',
      priority: String(rule.priority ?? 100),
      source_scope: (rule.source_scope as RuleFormState['source_scope']) || 'service',
      source_org_unit_id: rule.source_org_unit_id || '',
      source_user_id: rule.source_user_id || '',
      document_category_id: rule.document_category_id || '',
      filename_pattern: rule.filename_pattern || '',
      mime_type_pattern: rule.mime_type_pattern || '',
      target_scope: (rule.target_scope as RuleFormState['target_scope']) || 'service',
      target_org_unit_id: rule.target_org_unit_id || '',
      target_user_id: rule.target_user_id || '',
      domain_id: rule.domain_id || '',
      activity_id: rule.activity_id || '',
      year_strategy: (rule.year_strategy as RuleFormState['year_strategy']) || 'current',
      fixed_year: rule.fixed_year ? String(rule.fixed_year) : '',
      workflow_template_id: rule.workflow_template_id || '',
      is_active: rule.is_active ?? true,
    });
    setShowAdvancedRule(false);
    setRuleModalOpen(true);
  };
  const closeRuleModal = () => setRuleModalOpen(false);

  const resetActivityForm = () => {
    setSelectedActivityId(null);
    setActivityForm(EMPTY_ACTIVITY);
  };

  const resetRuleForm = () => {
    setSelectedRuleId(null);
    setRuleForm(EMPTY_RULE);
  };

  const handleDomainSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!domainForm.name.trim()) {
      showToast({ tone: 'error', message: 'Le nom du domaine est requis.' });
      return;
    }
    const payload: ClassificationDomainPayload = {
      code: slugifyCode(domainForm.code || domainForm.name),
      name: domainForm.name.trim(),
      description: domainForm.description.trim() || null,
      is_active: true,
    };
    setWorking('domain');
    try {
      if (domainForm.id) {
        await api.updateClassificationDomain(domainForm.id, payload);
        showToast({ tone: 'success', message: 'Domaine mis à jour.' });
      } else {
        await api.createClassificationDomain(payload);
        showToast({ tone: 'success', message: 'Domaine créé.' });
      }
      await loadData();
      resetDomainForm();
      setDomainModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Enregistrement du domaine impossible.' });
    } finally {
      setWorking(null);
    }
  };

  const handleDomainArchive = async (domain: ClassificationDomain) => {
    setWorking(`domain:${domain.id}`);
    try {
      if (domain.is_active) {
        await api.deleteClassificationDomain(domain.id);
        showToast({ tone: 'success', message: `Domaine « ${domain.name} » archivé.` });
      } else {
        await api.updateClassificationDomain(domain.id, { is_active: true });
        showToast({ tone: 'success', message: `Domaine « ${domain.name} » réactivé.` });
      }
      await loadData();
      if (selectedDomainId === domain.id) resetDomainForm();
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Mise à jour du domaine impossible.' });
    } finally {
      setWorking(null);
    }
  };

  const handleActivitySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activityForm.domain_id) {
      showToast({ tone: 'error', message: 'Choisissez un domaine parent.' });
      return;
    }
    if (!activityForm.name.trim()) {
      showToast({ tone: 'error', message: 'Le nom de l’activité est requis.' });
      return;
    }
    const payload: ClassificationActivityPayload = {
      domain_id: activityForm.domain_id,
      code: slugifyCode(activityForm.code || activityForm.name),
      name: activityForm.name.trim(),
      description: activityForm.description.trim() || null,
      is_active: true,
    };
    setWorking('activity');
    try {
      if (activityForm.id) {
        await api.updateClassificationActivity(activityForm.id, payload);
        showToast({ tone: 'success', message: 'Activité mise à jour.' });
      } else {
        await api.createClassificationActivity(payload);
        showToast({ tone: 'success', message: 'Activité créée.' });
      }
      await loadData();
      resetActivityForm();
      setActivityModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Enregistrement de l’activité impossible.' });
    } finally {
      setWorking(null);
    }
  };

  const handleActivityArchive = async (activity: ClassificationActivity) => {
    setWorking(`activity:${activity.id}`);
    try {
      if (activity.is_active) {
        await api.deleteClassificationActivity(activity.id);
        showToast({ tone: 'success', message: `Activité « ${activity.name} » archivée.` });
      } else {
        await api.updateClassificationActivity(activity.id, { is_active: true });
        showToast({ tone: 'success', message: `Activité « ${activity.name} » réactivée.` });
      }
      await loadData();
      if (selectedActivityId === activity.id) resetActivityForm();
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Mise à jour de l’activité impossible.' });
    } finally {
      setWorking(null);
    }
  };

  const buildRulePayload = (): ClassificationRulePayload | null => {
    if (!ruleForm.name.trim()) {
      showToast({ tone: 'error', message: 'Le nom de la règle est requis.' });
      return null;
    }
    if (ruleForm.activity_id && !ruleForm.domain_id) {
      showToast({ tone: 'error', message: 'Sélectionnez un domaine avant l’activité.' });
      return null;
    }
    if (ruleForm.year_strategy === 'fixed' && !ruleForm.fixed_year.trim()) {
      showToast({ tone: 'error', message: 'Renseignez une année fixe valide.' });
      return null;
    }

    return {
      code: slugifyCode(ruleForm.code || ruleForm.name),
      name: ruleForm.name.trim(),
      description: ruleForm.description.trim() || null,
      priority: Number.parseInt(ruleForm.priority, 10) || 100,
      is_active: ruleForm.is_active,
      source_scope: ruleForm.source_scope,
      source_org_unit_id: ruleForm.source_org_unit_id || null,
      source_user_id: ruleForm.source_user_id || null,
      document_category_id: ruleForm.document_category_id || null,
      filename_pattern: ruleForm.filename_pattern.trim() || null,
      mime_type_pattern: ruleForm.mime_type_pattern.trim() || null,
      target_scope: ruleForm.target_scope,
      target_org_unit_id: ruleForm.target_scope === 'person' ? null : ruleForm.target_org_unit_id || null,
      target_user_id: ruleForm.target_scope === 'person' ? ruleForm.target_user_id || null : null,
      domain_id: ruleForm.domain_id || null,
      activity_id: ruleForm.activity_id || null,
      year_strategy: ruleForm.year_strategy,
      fixed_year: ruleForm.year_strategy === 'fixed' ? Number.parseInt(ruleForm.fixed_year, 10) || null : null,
      workflow_template_id: ruleForm.workflow_template_id || null,
    };
  };

  const handleRuleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = buildRulePayload();
    if (!payload) return;

    setWorking('rule');
    try {
      if (ruleForm.id) {
        await api.updateClassificationRule(ruleForm.id, payload);
        showToast({ tone: 'success', message: 'Règle de classement mise à jour.' });
      } else {
        await api.createClassificationRule(payload);
        showToast({ tone: 'success', message: 'Règle de classement créée.' });
      }
      await loadData();
      resetRuleForm();
      setRuleModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Enregistrement de la règle impossible.' });
    } finally {
      setWorking(null);
    }
  };

  const toggleRuleActive = async (rule: ClassificationRule) => {
    setWorking(`rule:${rule.id}`);
    try {
      await api.updateClassificationRule(rule.id, { is_active: !rule.is_active });
      showToast({ tone: 'success', message: `Règle « ${rule.name} » ${rule.is_active ? 'désactivée' : 'réactivée'}.` });
      await loadData();
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Mise à jour de la règle impossible.' });
    } finally {
      setWorking(null);
    }
  };

  const deleteRule = async (rule: ClassificationRule) => {
    if (!window.confirm(`Supprimer définitivement la règle « ${rule.name} » ?`)) {
      return;
    }
    setWorking(`delete-rule:${rule.id}`);
    try {
      await api.deleteClassificationRule(rule.id);
      showToast({ tone: 'success', message: `Règle « ${rule.name} » supprimée.` });
      await loadData();
      if (selectedRuleId === rule.id) resetRuleForm();
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Suppression de la règle impossible.' });
    } finally {
      setWorking(null);
    }
  };

  const runSimulation = async () => {
    if (!simulationForm.filename.trim()) {
      showToast({ tone: 'error', message: 'Le nom de fichier de test est requis.' });
      return;
    }
    setWorking('simulate');
    setSimulationResult(null);
    try {
      const result = await api.simulateClassification({
        document_category_id: simulationForm.document_category_id || null,
        source_scope: simulationForm.source_scope,
        source_org_unit_id: simulationForm.source_org_unit_id || null,
        source_user_id: simulationForm.source_user_id || null,
        filename: simulationForm.filename.trim(),
        mime_type: simulationForm.mime_type.trim() || null,
      });
      setSimulationResult(result);
    } catch (error) {
      console.error(error);
      showToast({ tone: 'error', message: 'Simulation de classement impossible.' });
    } finally {
      setWorking(null);
    }
  };

  const renderDomainsTab = () => {
    const domainActivitiesCount = (domainId: string) =>
      activities.filter((a) => a.domain_id === domainId).length;

    return (
      <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-22rem)]">
        {/* LEFT — Liste des domaines */}
        <div className="w-full lg:w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
          <button
            type="button"
            onClick={openDomainCreate}
            className="w-full mb-2 px-5 py-3 bg-rdpc-blue text-white rounded-[1.5rem] font-bold shadow-lg shadow-blue-200 hover:bg-black transition-all flex justify-center items-center gap-2 uppercase tracking-widest italic"
          >
            <span className="material-symbols-outlined">add</span>
            Nouveau Domaine
          </button>

          {domains.length === 0 ? (
            <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
              <p className="text-xs italic text-slate-500 leading-relaxed">
                Aucun domaine pour l&apos;instant.<br />
                Cliquez sur <span className="font-bold text-rdpc-blue">« Nouveau Domaine »</span> ci-dessus pour en créer un. Le panneau de droite vous explique comment.
              </p>
            </div>
          ) : (
            domains.map((domain) => (
              <button
                type="button"
                key={domain.id}
                onClick={() => setSelectedDomainId(domain.id)}
                className={`w-full text-left p-5 rounded-[2rem] border transition-all relative ${selectedDomainId === domain.id ? 'bg-white border-rdpc-blue shadow-xl ring-2 ring-rdpc-blue/10' : 'bg-white/60 border-transparent hover:bg-white hover:shadow-md'}`}
              >
                <div className="flex justify-between items-start mb-2 gap-3">
                  <h3 className={`text-base tracking-tighter uppercase italic font-black ${selectedDomainId === domain.id ? 'text-rdpc-blue' : 'text-slate-800'}`}>{domain.name}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${domain.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {domain.is_active ? 'Actif' : 'Archivé'}
                  </span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{domain.code}</p>
                <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-3">{domain.description || 'Sans description.'}</p>
                <div className="flex items-center gap-2 font-bold text-[10px] uppercase text-slate-400 bg-slate-100 rounded-full w-max px-3 py-1">
                  <span className="material-symbols-outlined text-[14px]">account_tree</span>
                  {domainActivitiesCount(domain.id)} {domainActivitiesCount(domain.id) > 1 ? 'activités' : 'activité'}
                </div>
              </button>
            ))
          )}
        </div>

        {/* RIGHT — Détail ou pédagogie */}
        <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 relative overflow-hidden flex flex-col p-8 shadow-sm">
          {selectedDomain ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-6 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{selectedDomain.code}</p>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-slate-800">{selectedDomain.name}</h2>
                  <p className="text-slate-500 font-medium italic">{selectedDomain.description || 'Aucune description.'}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openDomainEdit(selectedDomain)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-rdpc-blue hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleDomainArchive(selectedDomain); }}
                    disabled={working === `domain:${selectedDomain.id}`}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-rose-600 hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">{selectedDomain.is_active ? 'inventory_2' : 'unarchive'}</span>
                    {selectedDomain.is_active ? 'Archiver' : 'Réactiver'}
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-slate-700 uppercase tracking-widest text-[10px] mb-4">Activités rattachées</h3>
              {activities.filter((a) => a.domain_id === selectedDomain.id).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 italic font-medium text-slate-400 text-sm">
                  Aucune activité dans ce domaine.<br />
                  <span className="text-[11px]">Ouvrez l&apos;onglet <span className="font-bold text-rdpc-blue">Activités</span> pour en ajouter.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activities.filter((a) => a.domain_id === selectedDomain.id).map((activity) => (
                    <div key={activity.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{activity.code}</p>
                      <p className="font-bold text-slate-700 mt-1">{activity.name}</p>
                      {activity.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{activity.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-rdpc-blue flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">hub</span>
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 leading-tight">Qu&apos;est-ce qu&apos;un domaine métier ?</h2>
                  <p className="text-xs italic text-slate-500 font-medium">La grande étiquette sous laquelle on range un document.</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Imaginez l&apos;<span className="font-bold text-slate-800">armoire de bureau</span> où vous rangez vos dossiers papier. Avant de glisser un courrier dans un tiroir, vous regardez la grande étiquette de l&apos;armoire : « <span className="font-bold text-slate-800">PERSONNEL</span> », « <span className="font-bold text-slate-800">MARCHÉS PUBLICS</span> », « <span className="font-bold text-slate-800">FINANCES</span> »…
              </p>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                C&apos;est exactement ça, un domaine — la grande catégorie qui répond à : <span className="font-bold text-slate-800">« de quoi ce document parle-t-il ? »</span>. Une fois le domaine choisi, on précisera ensuite l&apos;<span className="font-bold text-slate-800">activité</span> (le tiroir) puis l&apos;<span className="font-bold text-slate-800">année</span>.
              </p>

              <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/50 p-5 mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-rdpc-blue mb-3">Exemple — Armoire « Marchés publics »</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="material-symbols-outlined text-rdpc-blue text-base">folder</span>
                    <span className="font-bold text-slate-700">Marchés publics</span>
                    <span className="text-slate-400">—</span>
                    <span className="text-slate-500 italic">le domaine (l&apos;armoire)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm pl-7">
                    <span className="text-slate-300">└</span>
                    <span className="font-bold text-slate-700">Appels d&apos;offres</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-bold text-slate-700">Devis</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-bold text-slate-700">Contrats</span>
                    <span className="text-slate-400">—</span>
                    <span className="text-slate-500 italic">les activités (les tiroirs)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic mt-3">Chemin final d&apos;un document : <span className="font-bold not-italic text-slate-700">Service / Marchés publics / Devis / 2026</span></p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">1. Créer</div>
                  <p className="text-xs text-slate-600 leading-snug">Cliquez <span className="font-bold">Nouveau Domaine</span> et nommez-le comme une <span className="font-bold">grande étiquette d&apos;armoire</span> (Personnel, Finances, Marchés…).</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">2. Activités</div>
                  <p className="text-xs text-slate-600 leading-snug">Allez dans l&apos;onglet <span className="font-bold">Activités</span> pour ajouter les <span className="font-bold">tiroirs</span> de cette armoire (Recrutement, Paie, Formation…).</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">3. Utiliser</div>
                  <p className="text-xs text-slate-600 leading-snug">Le domaine est maintenant <span className="font-bold">proposé automatiquement</span> quand on classe un document.</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Bonnes pratiques</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                    <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">COMBIEN ?</span>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      Visez <span className="font-bold text-slate-800">entre 5 et 12 grandes étiquettes</span>. Trop d&apos;étiquettes = on s&apos;y perd. Trop peu = tout finit dans « Divers ».
                      <span className="block italic text-slate-400 mt-1">Ex : Affaires juridiques · Finances · Marchés publics · Personnel · Communication · Logistique.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                    <span className="text-[9px] font-black uppercase text-rdpc-blue bg-blue-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">LE CODE</span>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      Juste un identifiant interne pour le système (ex : <span className="font-mono">marches_publics</span>). À fixer une bonne fois — il ne se change plus après.
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                    <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">PAS DE SUPPRESSION</span>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      On n&apos;efface jamais un domaine — les vieux dossiers y sont rattachés. On l&apos;<span className="font-bold">archive</span> : il sort des nouvelles propositions, mais reste consultable.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
                <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">lightbulb</span>
                <p className="text-xs text-amber-900 leading-relaxed">
                  <span className="font-black uppercase tracking-wider mr-1">Astuce —</span>
                  Inspirez-vous des <span className="font-bold">missions officielles</span> de votre administration plutôt que de l&apos;arborescence de fichiers actuelle. Une bonne étiquette d&apos;armoire survit aux réorganisations.
                </p>
              </div>

              <p className="text-[10px] italic text-slate-400 leading-relaxed">
                Conforme à la norme <span className="font-bold not-italic">ISO 15489</span> (gestion documentaire) — plan de classement à 4 niveaux : service, domaine, activité, année.
              </p>
            </div>
          )}
        </div>

        {/* MODAL — Création / édition */}
        {domainModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in py-10">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-full flex flex-col shadow-2xl relative">
              <div className="p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rdpc-blue text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <span className="material-symbols-outlined">hub</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-tight">
                      {domainForm.id ? 'Modifier le domaine' : 'Nouveau domaine'}
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Plan de classement — niveau 1</p>
                  </div>
                </div>
                <button type="button" onClick={closeDomainModal} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 shadow-sm hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="mb-6 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
                  <span className="material-symbols-outlined text-rdpc-blue text-base shrink-0 mt-0.5">info</span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Un domaine est l&apos;<span className="font-bold text-slate-800">axe métier le plus large</span> du plan de classement. Donnez-lui un nom clair (ex : « Marchés publics »), un code stable et une description courte.
                  </p>
                </div>
                <form id="domain-form" onSubmit={handleDomainSubmit} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nom métier</label>
                    <input
                      aria-label="Nom domaine"
                      value={domainForm.name}
                      onChange={(event) => setDomainForm((prev) => ({ ...prev, name: event.target.value, code: prev.id ? prev.code : slugifyCode(event.target.value) }))}
                      placeholder="Ex : Marchés publics"
                      required
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    />
                    <p className="text-[10px] text-slate-400 italic mt-1 ml-1">
                      Identifiant technique généré automatiquement : <span className="font-mono font-bold text-slate-500">{domainForm.code || '—'}</span>
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Code technique</label>
                    <input
                      aria-label="Code domaine"
                      value={domainForm.code}
                      onChange={(event) => setDomainForm((prev) => ({ ...prev, code: slugifyCode(event.target.value) }))}
                      placeholder="marches_publics"
                      className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-mono font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue"
                    />
                    <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Lettres, chiffres, underscores. Utilisé par le moteur de règles. À fixer dès la mise en production.</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Description</label>
                    <textarea
                      aria-label="Description domaine"
                      value={domainForm.description}
                      onChange={(event) => setDomainForm((prev) => ({ ...prev, description: event.target.value }))}
                      rows={4}
                      placeholder="Périmètre métier couvert par ce domaine."
                      className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm text-slate-700 focus:outline-none focus:border-rdpc-blue resize-none"
                    />
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2.5rem] shrink-0 flex gap-3">
                <button type="button" onClick={closeDomainModal} className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" form="domain-form" disabled={working === 'domain'} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rdpc-blue transition-colors disabled:opacity-50">
                  {domainForm.id ? 'Mettre à jour le domaine' : 'Créer le domaine'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderActivitiesTab = () => (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-22rem)]">
      {/* LEFT — Liste des activités */}
      <div className="w-full lg:w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
        <button
          type="button"
          onClick={openActivityCreate}
          className="w-full mb-2 px-5 py-3 bg-emerald-600 text-white rounded-[1.5rem] font-bold shadow-lg shadow-emerald-200 hover:bg-black transition-all flex justify-center items-center gap-2 uppercase tracking-widest italic"
        >
          <span className="material-symbols-outlined">add</span>
          Nouvelle Activité
        </button>

        {filteredActivities.length === 0 ? (
          <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
            <p className="text-xs italic text-slate-500 leading-relaxed">
              Aucune activité pour l&apos;instant.<br />
              Cliquez sur <span className="font-bold text-emerald-600">« Nouvelle Activité »</span> ci-dessus pour en créer une. Le panneau de droite vous explique comment.
            </p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <button
              type="button"
              key={activity.id}
              onClick={() => setSelectedActivityId(activity.id)}
              className={`w-full text-left p-5 rounded-[2rem] border transition-all relative ${selectedActivityId === activity.id ? 'bg-white border-emerald-500 shadow-xl ring-2 ring-emerald-500/10' : 'bg-white/60 border-transparent hover:bg-white hover:shadow-md'}`}
            >
              <div className="flex justify-between items-start mb-2 gap-3">
                <h3 className={`text-base tracking-tighter uppercase italic font-black ${selectedActivityId === activity.id ? 'text-emerald-700' : 'text-slate-800'}`}>{activity.name}</h3>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${activity.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {activity.is_active ? 'Actif' : 'Archivé'}
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">{activity.domain_name || 'Domaine'}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{activity.code}</p>
              <p className="text-xs text-slate-500 font-medium line-clamp-2">{activity.description || 'Sans description.'}</p>
            </button>
          ))
        )}
      </div>

      {/* RIGHT — Détail ou pédagogie */}
      <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 relative overflow-hidden flex flex-col p-8 shadow-sm">
        {selectedActivity ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">{selectedActivity.domain_name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{selectedActivity.code}</p>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-slate-800">{selectedActivity.name}</h2>
                <p className="text-slate-500 font-medium italic">{selectedActivity.description || 'Aucune description.'}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => openActivityEdit(selectedActivity)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-emerald-600 hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Modifier
                </button>
                <button type="button" onClick={() => { void handleActivityArchive(selectedActivity); }} disabled={working === `activity:${selectedActivity.id}`} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-rose-600 hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm disabled:opacity-50">
                  <span className="material-symbols-outlined text-[16px]">{selectedActivity.is_active ? 'inventory_2' : 'unarchive'}</span>
                  {selectedActivity.is_active ? 'Archiver' : 'Réactiver'}
                </button>
              </div>
            </div>
            <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">Chemin de classement type</p>
              <p className="text-sm font-bold text-slate-700">Service / <span className="text-emerald-700">{selectedActivity.domain_name}</span> / <span className="text-emerald-700">{selectedActivity.name}</span> / 2026</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">account_tree</span>
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 leading-tight">Qu&apos;est-ce qu&apos;une activité ?</h2>
                <p className="text-xs italic text-slate-500 font-medium">Le tiroir précis, à l&apos;intérieur de l&apos;armoire.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Reprenons l&apos;<span className="font-bold text-slate-800">armoire de bureau</span>. Une fois que vous avez choisi la grande armoire (le <span className="font-bold text-slate-800">domaine</span> : « Marchés publics »), il faut savoir <span className="font-bold text-slate-800">dans quel tiroir</span> ranger le document.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              C&apos;est ça, une activité — la <span className="font-bold text-slate-800">sous-catégorie précise</span> qui dit <span className="font-bold text-slate-800">« quel type d&apos;affaire ce document concerne-t-il ? »</span>. Les Devis, les Appels d&apos;offres, les Contrats sont des activités <span className="italic">dans</span> l&apos;armoire « Marchés publics ».
            </p>

            <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 p-5 mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-3">Exemple — Armoire « Personnel »</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="material-symbols-outlined text-emerald-600 text-base">folder</span>
                  <span className="font-bold text-slate-700">Personnel</span>
                  <span className="text-slate-400">—</span>
                  <span className="text-slate-500 italic">l&apos;armoire (domaine)</span>
                </div>
                <div className="flex items-center gap-3 text-sm pl-7">
                  <span className="text-slate-300">└</span>
                  <span className="font-bold text-slate-700">Recrutement</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-bold text-slate-700">Paie</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-bold text-slate-700">Formation</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-bold text-slate-700">Congés</span>
                  <span className="text-slate-400">—</span>
                  <span className="text-slate-500 italic">les tiroirs (activités)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">1. Choisir l&apos;armoire</div>
                <p className="text-xs text-slate-600 leading-snug">Sélectionnez d&apos;abord le <span className="font-bold">domaine parent</span> (ex : « Marchés publics »).</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">2. Nommer le tiroir</div>
                <p className="text-xs text-slate-600 leading-snug">Cliquez <span className="font-bold">Nouvelle Activité</span> et donnez-lui un nom <span className="font-bold">précis</span> (ex : « Devis »).</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">3. Ranger</div>
                <p className="text-xs text-slate-600 leading-snug">L&apos;activité est <span className="font-bold">automatiquement proposée</span> quand on classe un document dans le bon domaine.</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Bonnes pratiques</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">COMBIEN ?</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Visez <span className="font-bold text-slate-800">3 à 8 tiroirs</span> par armoire. Trop de tiroirs = on hésite. Trop peu = un seul tiroir déborde.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-rdpc-blue bg-blue-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">NOMMAGE</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Préférez un <span className="font-bold">nom court et concret</span> (« Devis », « Factures ») plutôt qu&apos;une phrase (« Documents relatifs aux propositions commerciales »).
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">PAS DE DOUBLON</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Si « Devis » existe dans <span className="font-bold">Marchés publics</span> ET dans <span className="font-bold">Achats</span>, ce sont <span className="font-bold">deux activités distinctes</span> — chaque tiroir vit dans son armoire.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
              <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">lightbulb</span>
              <p className="text-xs text-amber-900 leading-relaxed">
                <span className="font-black uppercase tracking-wider mr-1">Astuce —</span>
                Si vous hésitez à ranger un document entre deux activités, c&apos;est probablement que l&apos;une des deux est <span className="font-bold">trop large</span>. Découpez-la.
              </p>
            </div>

            <p className="text-[10px] italic text-slate-400 leading-relaxed">
              Conforme à la norme <span className="font-bold not-italic">ISO 15489</span> — niveau 2 du plan de classement (le tiroir).
            </p>
          </div>
        )}
      </div>

      {/* MODAL — Création / édition activité */}
      {activityModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in py-10">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-full flex flex-col shadow-2xl relative">
            <div className="p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                  <span className="material-symbols-outlined">account_tree</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-tight">
                    {activityForm.id ? 'Modifier l’activité' : 'Nouvelle activité'}
                  </h2>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Plan de classement — niveau 2</p>
                </div>
              </div>
              <button type="button" onClick={closeActivityModal} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 shadow-sm hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">info</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Une activité est un <span className="font-bold text-slate-800">tiroir précis</span> dans une armoire (domaine). Choisissez d&apos;abord le domaine parent, puis donnez un nom court et concret au tiroir.
                </p>
              </div>
              <form id="activity-form" onSubmit={handleActivitySubmit} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Armoire (domaine parent)</label>
                  <select required aria-label="Domaine parent activité" value={activityForm.domain_id} onChange={(event) => setActivityForm((prev) => ({ ...prev, domain_id: event.target.value }))} className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                    <option value="">Sélectionnez un domaine</option>
                    {domains.filter((d) => d.is_active).map((domain) => (
                      <option key={domain.id} value={domain.id}>{domain.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nom du tiroir</label>
                  <input required aria-label="Nom activité" value={activityForm.name} onChange={(event) => setActivityForm((prev) => ({ ...prev, name: event.target.value, code: prev.id ? prev.code : slugifyCode(event.target.value) }))} placeholder="Ex : Devis" className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500" />
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">
                    Identifiant technique : <span className="font-mono font-bold text-slate-500">{activityForm.code || '—'}</span>
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Code technique</label>
                  <input aria-label="Code activité" value={activityForm.code} onChange={(event) => setActivityForm((prev) => ({ ...prev, code: slugifyCode(event.target.value) }))} placeholder="devis" className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-mono font-bold text-slate-700 focus:outline-none focus:border-emerald-500" />
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Lettres, chiffres, underscores. À fixer en mise en production.</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Description</label>
                  <textarea aria-label="Description activité" value={activityForm.description} onChange={(event) => setActivityForm((prev) => ({ ...prev, description: event.target.value }))} rows={4} placeholder="À quoi sert ce tiroir ? Quels documents y rangera-t-on ?" className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 resize-none" />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2.5rem] shrink-0 flex gap-3">
              <button type="button" onClick={closeActivityModal} className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">Annuler</button>
              <button type="submit" form="activity-form" disabled={working === 'activity'} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors disabled:opacity-50">
                {activityForm.id ? 'Mettre à jour l’activité' : 'Créer l’activité'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderRuleFormFields = () => {
    const targetIsPerson = ruleForm.target_scope === 'person';
    return (
      <>
        {/* IDENTITÉ */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom de la règle</label>
          <input
            required
            aria-label="Nom règle classement"
            value={ruleForm.name}
            onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value, code: prev.id ? prev.code : slugifyCode(event.target.value) }))}
            placeholder="Ex : Devis du service Infrastructure"
            className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-violet-500"
          />
          <p className="text-[10px] text-slate-400 italic mt-1 ml-1">
            Identifiant technique généré automatiquement : <span className="font-mono font-bold text-slate-500">{ruleForm.code || '—'}</span>
          </p>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
          <textarea aria-label="Description règle classement" value={ruleForm.description} onChange={(event) => setRuleForm((prev) => ({ ...prev, description: event.target.value }))} rows={2} placeholder="À quoi sert cette règle ? Quel cas couvre-t-elle ?" className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm text-slate-700 focus:outline-none focus:border-violet-500 resize-none" />
        </div>

        {/* SECTION SI */}
        <div className="rounded-[1.5rem] border-2 border-rdpc-blue/20 bg-blue-50/30 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-white bg-rdpc-blue px-3 py-1 rounded-full">SI le document…</span>
            <span className="text-xs italic text-slate-500">décrivez à quoi le document doit ressembler</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">description</span>Type de document</label>
              <select aria-label="Type de document" value={ruleForm.document_category_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, document_category_id: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue">
                <option value="">N&apos;importe quel type</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Devis, Facture, Note de service…</p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">apartment</span>Vient du service</label>
              <select aria-label="Service d&apos;origine" value={ruleForm.source_org_unit_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, source_org_unit_id: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue">
                <option value="">N&apos;importe quel service</option>
                {orgUnits.map((orgUnit) => <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">person</span>Envoyé par</label>
              <select aria-label="Agent émetteur" value={ruleForm.source_user_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, source_user_id: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-rdpc-blue">
                <option value="">N&apos;importe quel agent</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">search</span>Mots-clés dans le nom du fichier</label>
              <input aria-label="Mots-clés nom fichier" value={ruleForm.filename_pattern} onChange={(event) => setRuleForm((prev) => ({ ...prev, filename_pattern: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium text-slate-700 focus:outline-none focus:border-rdpc-blue" placeholder="marche;devis" />
              <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Plusieurs mots séparés par <span className="font-mono">;</span> — la règle s&apos;applique si <span className="font-bold not-italic">au moins un</span> mot est trouvé. Accents et majuscules ignorés (« marche » attrape aussi « Marché », « MARCHÉS »). Laisser vide pour ignorer ce critère.</p>
            </div>
          </div>
        </div>

        {/* SECTION ALORS */}
        <div className="rounded-[1.5rem] border-2 border-emerald-200 bg-emerald-50/30 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 px-3 py-1 rounded-full">ALORS range-le…</span>
            <span className="text-xs italic text-slate-500">choisissez la destination du document</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-emerald-600">inventory_2</span>Armoire (domaine)</label>
              <select aria-label="Armoire de destination" value={ruleForm.domain_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, domain_id: event.target.value, activity_id: '' }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                <option value="">Aucune armoire</option>
                {domains.filter((d) => d.is_active).map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-emerald-600">folder_open</span>Tiroir (activité)</label>
              <select aria-label="Tiroir de destination" value={ruleForm.activity_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, activity_id: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                <option value="">Aucun tiroir</option>
                {activityOptions.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-emerald-600">calendar_month</span>Année</label>
              <select aria-label="Stratégie année" value={ruleForm.year_strategy} onChange={(event) => setRuleForm((prev) => ({ ...prev, year_strategy: event.target.value as RuleFormState['year_strategy'], fixed_year: event.target.value === 'fixed' ? prev.fixed_year : '' }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                <option value="current">Année courante (au moment du dépôt)</option>
                <option value="from_filename">Lue dans le nom du fichier</option>
                <option value="from_metadata">Lue dans les métadonnées du document</option>
                <option value="fixed">Toujours la même (à préciser)</option>
              </select>
              {ruleForm.year_strategy === 'fixed' && (
                <input aria-label="Année fixe" type="number" min="1900" max="2100" value={ruleForm.fixed_year} onChange={(event) => setRuleForm((prev) => ({ ...prev, fixed_year: event.target.value }))} className="w-full mt-2 bg-white border-2 border-emerald-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500" placeholder="2026" />
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-emerald-600">autorenew</span>Lancer un circuit de validation</label>
              <select aria-label="Circuit à déclencher" value={ruleForm.workflow_template_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, workflow_template_id: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                <option value="">Aucun (juste classer)</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Optionnel — déclenche un circuit de visa après le classement.</p>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-emerald-600">forward_to_inbox</span>Qui doit recevoir ce document ?</label>
              <select aria-label="Niveau du destinataire" value={ruleForm.target_scope} onChange={(event) => setRuleForm((prev) => ({ ...prev, target_scope: event.target.value as RuleFormState['target_scope'], target_user_id: event.target.value === 'person' ? prev.target_user_id : '', target_org_unit_id: event.target.value === 'person' ? '' : prev.target_org_unit_id }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                <option value="service">Le service (origine ou précis)</option>
                <option value="subdirectorate">La sous-direction</option>
                <option value="directorate">La direction</option>
                <option value="person">Une personne précise</option>
              </select>
              {targetIsPerson ? (
                <select aria-label="Utilisateur destinataire" value={ruleForm.target_user_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, target_user_id: event.target.value }))} className="w-full mt-2 bg-white border-2 border-emerald-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                  <option value="">Choisir un agent</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              ) : (
                <select aria-label="Service destinataire" value={ruleForm.target_org_unit_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, target_org_unit_id: event.target.value }))} className="w-full mt-2 bg-white border-2 border-emerald-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                  <option value="">Reprendre le service d&apos;origine</option>
                  {orgUnits.map((orgUnit) => <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ÉTAT */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <input id="classification-rule-active" type="checkbox" checked={ruleForm.is_active} onChange={(event) => setRuleForm((prev) => ({ ...prev, is_active: event.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
          <label htmlFor="classification-rule-active" className="text-sm font-bold text-slate-700">Règle active dès l’enregistrement</label>
        </div>

        {/* OPTIONS AVANCÉES */}
        <div className="border-t border-slate-200 pt-4">
          <button type="button" onClick={() => setShowAdvancedRule((s) => !s)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-violet-600 transition-colors">
            <span className="material-symbols-outlined text-base">{showAdvancedRule ? 'expand_less' : 'expand_more'}</span>
            Options avancées
            <span className="text-[10px] font-medium italic text-slate-400 normal-case tracking-normal">(priorité, format de fichier, code technique, niveau d&apos;origine)</span>
          </button>
          {showAdvancedRule && (
            <div className="mt-4 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Code technique</label>
                <input aria-label="Code règle classement" value={ruleForm.code} onChange={(event) => setRuleForm((prev) => ({ ...prev, code: slugifyCode(event.target.value) }))} placeholder="route_marche_service" className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-mono font-bold text-slate-700 focus:outline-none focus:border-slate-400" />
                <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Lettres, chiffres, underscores. À fixer en mise en production.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Priorité</label>
                  <input aria-label="Priorité" type="number" min="0" value={ruleForm.priority} onChange={(event) => setRuleForm((prev) => ({ ...prev, priority: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-400" />
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Plus haut = passe en premier si plusieurs règles correspondent.</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Niveau de l&apos;origine</label>
                  <select aria-label="Scope source" value={ruleForm.source_scope} onChange={(event) => setRuleForm((prev) => ({ ...prev, source_scope: event.target.value as RuleFormState['source_scope'] }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-400">
                    <option value="service">Service</option>
                    <option value="subdirectorate">Sous-direction</option>
                    <option value="person">Personne</option>
                  </select>
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">À quel niveau remonter pour identifier l&apos;origine.</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Format du fichier</label>
                  <input aria-label="Format MIME" value={ruleForm.mime_type_pattern} onChange={(event) => setRuleForm((prev) => ({ ...prev, mime_type_pattern: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-mono font-medium text-slate-700 focus:outline-none focus:border-slate-400" placeholder="application/pdf" />
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Type MIME (ex : <span className="font-mono">application/pdf</span>). Vide = tous formats.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderRulesTab = () => (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-22rem)]">
      {/* LEFT — Liste des règles */}
      <div className="w-full lg:w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
        <button
          type="button"
          onClick={openRuleCreate}
          className="w-full mb-2 px-5 py-3 bg-violet-600 text-white rounded-[1.5rem] font-bold shadow-lg shadow-violet-200 hover:bg-black transition-all flex justify-center items-center gap-2 uppercase tracking-widest italic"
        >
          <span className="material-symbols-outlined">add</span>
          Nouvelle Règle
        </button>

        {rules.length === 0 ? (
          <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
            <p className="text-xs italic text-slate-500 leading-relaxed">
              Aucune règle pour l&apos;instant.<br />
              Cliquez sur <span className="font-bold text-violet-600">« Nouvelle Règle »</span> ci-dessus pour en créer une. Le panneau de droite vous explique comment.
            </p>
          </div>
        ) : (
          rules.map((rule) => (
            <button
              type="button"
              key={rule.id}
              onClick={() => setSelectedRuleId(rule.id)}
              className={`w-full text-left p-5 rounded-[2rem] border transition-all relative ${selectedRuleId === rule.id ? 'bg-white border-violet-500 shadow-xl ring-2 ring-violet-500/10' : 'bg-white/60 border-transparent hover:bg-white hover:shadow-md'}`}
            >
              <div className="flex justify-between items-start mb-2 gap-3">
                <h3 className={`text-base tracking-tighter uppercase italic font-black ${selectedRuleId === rule.id ? 'text-violet-700' : 'text-slate-800'}`}>{rule.name}</h3>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${rule.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {rule.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{rule.code} · Priorité {rule.priority}</p>
              <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-3">{rule.description || 'Sans description.'}</p>
              <div className="flex flex-wrap gap-1.5 text-[9px] font-black uppercase tracking-widest">
                {rule.domain_name && <span className="px-2 py-0.5 rounded-full bg-rdpc-blue/10 text-rdpc-blue">{rule.domain_name}</span>}
                {rule.activity_name && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{rule.activity_name}</span>}
              </div>
            </button>
          ))
        )}
      </div>

      {/* RIGHT — Détail ou pédagogie */}
      <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 relative overflow-hidden flex flex-col p-8 shadow-sm">
        {selectedRule ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-6 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{selectedRule.code} · Priorité {selectedRule.priority}</p>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-slate-800">{selectedRule.name}</h2>
                <p className="text-slate-500 font-medium italic">{selectedRule.description || 'Aucune description.'}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => openRuleEdit(selectedRule)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-violet-600 hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm">
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Modifier
                </button>
                <button type="button" onClick={() => { void toggleRuleActive(selectedRule); }} disabled={Boolean(working)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-amber-500 hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm disabled:opacity-50">
                  <span className="material-symbols-outlined text-[16px]">{selectedRule.is_active ? 'pause' : 'play_arrow'}</span>
                  {selectedRule.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button type="button" onClick={() => { void deleteRule(selectedRule); }} disabled={Boolean(working)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-rose-600 hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm disabled:opacity-50">
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Supprimer
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Si le document vient de…</p>
                <p className="mt-1 font-bold text-slate-800">{formatScope(selectedRule.source_scope)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">…on le range vers</p>
                <p className="mt-1 font-bold text-slate-800">{formatScope(selectedRule.target_scope)}</p>
              </div>
              {selectedRule.document_category_name && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Type de document</p>
                  <p className="mt-1 font-bold text-slate-800">{selectedRule.document_category_name}</p>
                </div>
              )}
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Année appliquée</p>
                <p className="mt-1 font-bold text-slate-800">{formatYearStrategy(selectedRule.year_strategy as RuleFormState['year_strategy'])}{selectedRule.fixed_year ? ` (${selectedRule.fixed_year})` : ''}</p>
              </div>
            </div>

            {(selectedRule.domain_name || selectedRule.activity_name) && (
              <div className="rounded-2xl border-2 border-violet-100 bg-violet-50/50 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-700 mb-2">Destination de classement</p>
                <p className="text-sm font-bold text-slate-700">
                  {selectedRule.domain_name && <span className="text-violet-700">{selectedRule.domain_name}</span>}
                  {selectedRule.domain_name && selectedRule.activity_name && ' / '}
                  {selectedRule.activity_name && <span className="text-emerald-700">{selectedRule.activity_name}</span>}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">rule</span>
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 leading-tight">Qu&apos;est-ce qu&apos;une règle de classement ?</h2>
                <p className="text-xs italic text-slate-500 font-medium">La consigne automatique de rangement.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Imaginez que vous donniez à votre <span className="font-bold text-slate-800">secrétaire</span> une consigne du type :
              <span className="block italic text-slate-700 mt-2 ml-4">« Quand un <span className="font-bold not-italic">devis</span> arrive du <span className="font-bold not-italic">service Infrastructure</span>, range-le dans l&apos;armoire <span className="font-bold not-italic">Marchés publics</span>, tiroir <span className="font-bold not-italic">Devis</span>, année en cours. »</span>
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              C&apos;est exactement ça, une règle de classement. Le système l&apos;applique <span className="font-bold text-slate-800">automatiquement</span> à chaque nouveau document qui correspond à la consigne, pour éviter aux agents de classer manuellement.
            </p>

            <div className="rounded-2xl border-2 border-violet-100 bg-violet-50/50 p-5 mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700 mb-3">Exemple — Règle « Devis Infrastructure »</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-black uppercase text-rdpc-blue bg-blue-100 px-2 py-0.5 rounded-full tracking-widest shrink-0 mt-0.5">SI</span>
                  <p className="text-slate-700"><span className="font-bold">document de type Devis</span> qui vient du <span className="font-bold">service Infrastructure</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full tracking-widest shrink-0 mt-0.5">ALORS</span>
                  <p className="text-slate-700">range-le dans <span className="font-bold">Marchés publics / Devis / 2026</span></p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">1. Conditions (le SI)</div>
                <p className="text-xs text-slate-600 leading-snug">Décrivez à quoi le document doit ressembler : <span className="font-bold">type, service, mots-clés du nom de fichier</span>.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">2. Destination (le ALORS)</div>
                <p className="text-xs text-slate-600 leading-snug">Choisissez l&apos;<span className="font-bold">armoire (domaine)</span>, le <span className="font-bold">tiroir (activité)</span> et l&apos;année.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">3. Tester</div>
                <p className="text-xs text-slate-600 leading-snug">Vérifiez la règle dans l&apos;onglet <span className="font-bold">Simulateur</span> avant de l&apos;activer pour tout le monde.</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Bonnes pratiques</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-violet-700 bg-violet-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">PRIORITÉ</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Si plusieurs règles correspondent au même document, c&apos;est <span className="font-bold">la priorité la plus haute</span> qui gagne. Mettez les règles spécifiques en haut, les règles génériques en bas.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">SPÉCIFICITÉ</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Plus la consigne est <span className="font-bold">précise</span> (type + service + mots-clés), plus le classement est fiable. Une règle trop générale finit par mal classer.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">DÉSACTIVATION</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Une règle qui pose problème ? <span className="font-bold">Désactivez-la</span> avant de la supprimer — vous pourrez la rétablir si besoin.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
              <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">lightbulb</span>
              <p className="text-xs text-amber-900 leading-relaxed">
                <span className="font-black uppercase tracking-wider mr-1">Astuce —</span>
                Avant d&apos;activer une nouvelle règle, passez par le <span className="font-bold">Simulateur</span>. Mieux vaut découvrir un mauvais classement à blanc qu&apos;en production.
              </p>
            </div>

            <p className="text-[10px] italic text-slate-400 leading-relaxed">
              Moteur conforme au pattern <span className="font-bold not-italic">IFTTT</span> (If This Then That) — chaque règle = une condition + une action.
            </p>
          </div>
        )}
      </div>

      {/* MODAL — Création / édition règle */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in py-10">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-full flex flex-col shadow-2xl relative">
            <div className="p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
                  <span className="material-symbols-outlined">rule</span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tighter italic uppercase leading-tight">
                    {ruleForm.id ? 'Modifier la règle' : 'Nouvelle règle de classement'}
                  </h2>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Plan de classement — règle automatique</p>
                </div>
              </div>
              <button type="button" onClick={closeRuleModal} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 shadow-sm hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="mb-6 p-4 rounded-2xl bg-violet-50/60 border border-violet-100 flex items-start gap-3">
                <span className="material-symbols-outlined text-violet-600 text-base shrink-0 mt-0.5">info</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Une règle, c&apos;est une consigne <span className="font-bold text-slate-800">SI…ALORS</span>. Décrivez d&apos;abord les conditions du document entrant, puis sa destination dans le plan de classement.
                </p>
              </div>
              <form id="rule-form" onSubmit={handleRuleSubmit} className="space-y-5">
                {renderRuleFormFields()}
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2.5rem] shrink-0 flex gap-3">
              <button type="button" onClick={closeRuleModal} className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">Annuler</button>
              <button type="submit" form="rule-form" disabled={working === 'rule'} className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-violet-600 transition-colors disabled:opacity-50">
                {ruleForm.id ? 'Mettre à jour la règle' : 'Créer la règle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSimulatorTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-8">
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-5">
        <div>
          <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-800">Simulateur de classement</h3>
          <p className="text-xs text-slate-500 font-medium mt-1">Testez les correspondances avant d’exposer les règles aux imports en masse.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom de fichier</label>
            <input aria-label="Nom fichier simulation classement" value={simulationForm.filename} onChange={(event) => setSimulationForm((prev) => ({ ...prev, filename: event.target.value }))} className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-300" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">MIME</label>
            <input aria-label="Mime simulation classement" value={simulationForm.mime_type} onChange={(event) => setSimulationForm((prev) => ({ ...prev, mime_type: event.target.value }))} className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium text-slate-700 focus:outline-none focus:border-amber-300" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Catégorie</label>
            <select aria-label="Catégorie simulation classement" value={simulationForm.document_category_id} onChange={(event) => setSimulationForm((prev) => ({ ...prev, document_category_id: event.target.value }))} className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-300">
              <option value="">Toute catégorie</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Scope source</label>
            <select aria-label="Scope simulation classement" value={simulationForm.source_scope} onChange={(event) => setSimulationForm((prev) => ({ ...prev, source_scope: event.target.value as SimulatorFormState['source_scope'] }))} className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-300">
              <option value="service">Service</option>
              <option value="subdirectorate">Sous-direction</option>
              <option value="person">Personne</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Unité source</label>
            <select aria-label="Unité simulation classement" value={simulationForm.source_org_unit_id} onChange={(event) => setSimulationForm((prev) => ({ ...prev, source_org_unit_id: event.target.value }))} className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-300">
              <option value="">Toutes les unités</option>
              {orgUnits.map((orgUnit) => <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Utilisateur source</label>
            <select aria-label="Utilisateur simulation classement" value={simulationForm.source_user_id} onChange={(event) => setSimulationForm((prev) => ({ ...prev, source_user_id: event.target.value }))} className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-300">
              <option value="">Tout utilisateur</option>
              {simulatorUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
            </select>
          </div>
        </div>

        <div className="pt-3 flex justify-end">
          <button type="button" onClick={() => void runSimulation()} disabled={working === 'simulate'} className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-amber-500 disabled:opacity-50">
            {working === 'simulate' ? 'Simulation...' : 'Lancer la simulation'}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 relative overflow-hidden flex flex-col p-8 shadow-sm">
        {simulationResult ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800">Résultat du test</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">{simulationResult.message}</p>
              </div>
              <span className={`px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES[simulationResult.status] || STATUS_STYLES.no_rule}`}>{simulationResult.status}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Règle retenue</p>
                <p className="mt-1 font-bold text-slate-800">{simulationResult.rule_name || 'Aucune règle retenue'}</p>
                {simulationResult.rule_code && <p className="text-xs text-slate-500 mt-1">{simulationResult.rule_code}</p>}
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chemin de classement</p>
                <p className="mt-1 font-bold text-slate-800">{simulationResult.logical_space_path || 'Non calculé'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Armoire / Tiroir</p>
                <p className="mt-1 font-bold text-slate-800">{simulationResult.classification_domain_name || '—'} / {simulationResult.classification_activity_name || '—'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Destinataire</p>
                <p className="mt-1 font-bold text-slate-800">{simulationResult.classification_target_user_name || simulationResult.classification_target_org_unit_name || 'Aucune cible résolue'}</p>
                <p className="text-xs text-slate-500 mt-1">Niveau {formatScope(simulationResult.classification_scope)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">science</span>
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800 leading-tight">Qu&apos;est-ce que le simulateur ?</h2>
                <p className="text-xs italic text-slate-500 font-medium">Le test à blanc avant de classer pour de vrai.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Avant de mettre en service une nouvelle <span className="font-bold text-slate-800">consigne de rangement</span>, il vaut mieux la <span className="font-bold text-slate-800">tester</span> sur un cas concret. C&apos;est le rôle du simulateur : vous décrivez un document fictif (nom, type, service d&apos;origine) et le système vous montre <span className="font-bold text-slate-800">où il aurait été classé</span> en appliquant les règles existantes.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Aucun document n&apos;est créé, aucune règle n&apos;est exécutée pour de vrai — c&apos;est <span className="font-bold text-slate-800">100 % à blanc</span>.
            </p>

            <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-5 mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-3">Exemple d&apos;usage</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-black uppercase text-rdpc-blue bg-blue-100 px-2 py-0.5 rounded-full tracking-widest shrink-0 mt-0.5">VOUS DÉCRIVEZ</span>
                  <p className="text-slate-700">un fichier <span className="font-bold">devis_marche_2026.pdf</span> envoyé par le <span className="font-bold">Service de l&apos;Infrastructure</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full tracking-widest shrink-0 mt-0.5">LE SYSTÈME RÉPOND</span>
                  <p className="text-slate-700">classé dans <span className="font-bold">Marchés publics / Devis / 2026</span> via la règle <span className="font-mono">route_devis_infra</span></p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">1. Décrire</div>
                <p className="text-xs text-slate-600 leading-snug">Remplissez le <span className="font-bold">nom de fichier</span>, le <span className="font-bold">type</span> et l&apos;<span className="font-bold">origine</span> du document fictif.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">2. Lancer</div>
                <p className="text-xs text-slate-600 leading-snug">Cliquez <span className="font-bold">Lancer la simulation</span> — le résultat apparaît à droite en moins d&apos;une seconde.</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">3. Ajuster</div>
                <p className="text-xs text-slate-600 leading-snug">Mauvais classement ? Modifiez la règle ou la priorité dans l&apos;onglet <span className="font-bold">Règles</span>, puis re-testez.</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Trois cas à tester systématiquement</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">CAS NORMAL</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Un document qui doit <span className="font-bold">clairement</span> tomber sur votre nouvelle règle. Vérifiez qu&apos;il atterrit au bon endroit.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">CAS LIMITE</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Un document <span className="font-bold">à la frontière</span> de plusieurs règles. Vérifiez que la règle retenue est bien celle attendue (priorité).
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200">
                  <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-100 px-2 py-1 rounded-full tracking-widest shrink-0 mt-0.5">CAS HORS RÈGLE</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Un document qui ne devrait <span className="font-bold">aucune</span> règle déclencher. Vérifiez que le statut affiché est bien <span className="italic">no_rule</span> et non un faux positif.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">lightbulb</span>
              <p className="text-xs text-amber-900 leading-relaxed">
                <span className="font-black uppercase tracking-wider mr-1">Astuce —</span>
                Faites tester vos nouvelles règles par un <span className="font-bold">collègue d&apos;un autre service</span> avant de les activer. Si lui s&apos;y retrouve, c&apos;est bon signe.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2.5 mb-2 border-b-2 border-slate-200 shrink-0 overflow-x-auto custom-scrollbar">
        {TAB_ORDER.map((tab) => {
          const meta = TAB_META[tab];
          const isActive = activeTab === tab;
          return (
            <button
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2.5 whitespace-nowrap ${isActive ? 'text-rdpc-blue border-b-4 border-rdpc-blue mb-[-2px]' : 'text-slate-400 hover:text-slate-700 hover:border-slate-300'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-rdpc-blue text-white' : 'bg-slate-100 text-slate-500'}`}>{meta.step}</span>
              <span className={`material-symbols-outlined text-base ${meta.accent}`}>{meta.icon}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue" />
        </div>
      ) : (
        <>
          {activeTab === 'domains' && renderDomainsTab()}
          {activeTab === 'activities' && renderActivitiesTab()}
          {activeTab === 'rules' && renderRulesTab()}
          {activeTab === 'simulator' && renderSimulatorTab()}
        </>
      )}

      {toast && <ToastView toast={toast} />}
    </div>
  );
};

export default ClassificationSettingsTab;
