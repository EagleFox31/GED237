import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, type ClassificationActivityPayload, type ClassificationDomainPayload, type ClassificationRulePayload } from '../../../../services/api';
import { MultiCheckSelect } from '../../../../components/ui/MultiCheckSelect';
import { SimulationTracePanel } from '../../../../components/classification/SimulationTracePanel';
import { categoriesApi, type DocumentCategory } from '../../../../services/categories.api';
import type {
  ClassificationActivity,
  ClassificationDomain,
  ClassificationRule,
  ClassificationSimulationResponse,
} from '../../../../types';

type Toast = { tone: 'success' | 'error' | 'info'; message: string } | null;
type AdminTab = 'domains' | 'activities' | 'rules' | 'simulator';
type OrgUnitOption = { id: string; name: string; parent_id?: string | null; level?: number };
type UserOption = { id: string; full_name: string; org_unit_id?: string | null; role_label?: string };
type WorkflowTemplateOption = { id: string; name: string; is_active?: boolean };
type TargetRoutingMode = 'origin' | 'parent_subdirectorate' | 'parent_directorate' | 'specific_org_unit' | 'person';

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
  document_category_ids: string[];
  source_org_unit_ids: string[];
  source_org_unit_excluded_ids: string[];
  source_user_ids: string[];
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
  document_category_ids: [],
  source_org_unit_ids: [],
  source_org_unit_excluded_ids: [],
  source_user_ids: [],
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

const STATUS_LABELS: Record<string, string> = {
  classified: 'Classifié',
  needs_review: 'À revoir',
  no_rule: 'Sans règle',
  rejected: 'Rejeté',
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

const scopeFromOrgUnitLevel = (level?: number | null): RuleFormState['target_scope'] => {
  if (level === 2) return 'directorate';
  if (level === 3) return 'subdirectorate';
  return 'service';
};

const deriveTargetRoutingMode = (
  targetScope?: RuleFormState['target_scope'] | ClassificationRule['target_scope'] | null,
  targetOrgUnitId?: string | null,
) : TargetRoutingMode => {
  if (targetScope === 'person') return 'person';
  if (targetOrgUnitId) return 'specific_org_unit';
  if (targetScope === 'subdirectorate') return 'parent_subdirectorate';
  if (targetScope === 'directorate') return 'parent_directorate';
  return 'origin';
};

const formatTargetRoutingMode = (mode: TargetRoutingMode) => {
  switch (mode) {
    case 'origin':
      return "Conserver l'unité d'origine";
    case 'parent_subdirectorate':
      return 'Sous-direction parente';
    case 'parent_directorate':
      return 'Direction parente';
    case 'specific_org_unit':
      return 'Unité précise';
    case 'person':
      return 'Personne précise';
    default:
      return mode;
  }
};

const splitRuleKeywords = (pattern?: string | null) =>
  (pattern || '')
    .split(/[;,|]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const FILE_FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'DOC' },
  { value: 'docx', label: 'DOCX' },
  { value: 'xls', label: 'XLS' },
  { value: 'xlsx', label: 'XLSX' },
  { value: 'ppt', label: 'PPT' },
  { value: 'pptx', label: 'PPTX' },
  { value: 'odt', label: 'ODT' },
  { value: 'ods', label: 'ODS' },
  { value: 'odp', label: 'ODP' },
  { value: 'txt', label: 'TXT' },
  { value: 'csv', label: 'CSV' },
  { value: 'rtf', label: 'RTF' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'tif', label: 'TIF' },
  { value: 'bmp', label: 'BMP' },
  { value: 'gif', label: 'GIF' },
  { value: 'webp', label: 'WEBP' },
] as const;

const MIME_ALIAS_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/vnd.oasis.opendocument.text': 'ODT',
  'application/vnd.oasis.opendocument.spreadsheet': 'ODS',
  'application/vnd.oasis.opendocument.presentation': 'ODP',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'application/rtf': 'RTF',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/tiff': 'TIFF',
  'image/bmp': 'BMP',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
};

const FILE_FORMAT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  rtf: 'application/rtf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  bmp: 'image/bmp',
  gif: 'image/gif',
  webp: 'image/webp',
};

const splitMimeTokens = (pattern?: string | null) =>
  (pattern || '')
    .split(/[;,|]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

const normalizeMimeTokens = (pattern?: string | null) =>
  splitMimeTokens(pattern).map((token) => {
    if (token.includes('/')) {
      const mapped = Object.entries(MIME_ALIAS_LABELS).find(([mime]) => mime === token);
      return mapped?.[1].toLowerCase() ?? token;
    }
    return token;
  });

const formatMimeTokenLabel = (token: string) => {
  const normalized = token.toLowerCase();
  if (MIME_ALIAS_LABELS[normalized]) return MIME_ALIAS_LABELS[normalized];
  const option = FILE_FORMAT_OPTIONS.find((item) => item.value === normalized);
  if (option) return option.label;
  return token.toUpperCase();
};

const inferMimeTypeFromFilename = (filename: string) => {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return '';
  const extension = match[1] || '';
  return FILE_FORMAT_TO_MIME[extension] || '';
};

const inferSimulationSourceScope = (orgUnit?: OrgUnitOption | null): SimulatorFormState['source_scope'] => {
  if (!orgUnit?.level) return 'service';
  return orgUnit.level >= 4 ? 'service' : 'subdirectorate';
};

const formatOriginSummaryLabel = (orgUnit: OrgUnitOption, hasChildren: boolean) =>
  hasChildren ? `Toutes les unités de ${orgUnit.name}` : orgUnit.name;

type OriginDecisionState = {
  decision: 'include' | 'exclude' | 'none';
  sourceId: string | null;
  explicitInclude: boolean;
  explicitExclude: boolean;
  inherited: boolean;
};

const OriginScopeSelect: React.FC<{
  units: OrgUnitOption[];
  included: string[];
  excluded: string[];
  onChange: (nextIncluded: string[], nextExcluded: string[]) => void;
  disabled?: boolean;
}> = ({ units, included, excluded, onChange, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.document.addEventListener('mousedown', handler);
    return () => window.document.removeEventListener('mousedown', handler);
  }, [open]);

  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, OrgUnitOption[]>();
    units.forEach((unit) => {
      const parentId = unit.parent_id || null;
      const bucket = map.get(parentId) || [];
      bucket.push(unit);
      map.set(parentId, bucket);
    });
    map.forEach((bucket) => bucket.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [units]);

  const ancestorsById = useMemo(() => {
    const map = new Map<string, string[]>();
    const build = (unit: OrgUnitOption): string[] => {
      if (map.has(unit.id)) return map.get(unit.id)!;
      const parent = unit.parent_id ? unitById.get(unit.parent_id) : null;
      const ancestors = parent ? [...build(parent), parent.id] : [];
      map.set(unit.id, ancestors);
      return ancestors;
    };
    units.forEach(build);
    return map;
  }, [unitById, units]);

  const includeSet = useMemo(() => new Set(included), [included]);
  const excludeSet = useMemo(() => new Set(excluded), [excluded]);

  const resolveDecision = (unitId: string): OriginDecisionState => {
    const chain = [...(ancestorsById.get(unitId) || []), unitId];
    let decision: 'include' | 'exclude' | 'none' = 'none';
    let sourceId: string | null = null;
    chain.forEach((id) => {
      if (includeSet.has(id)) {
        decision = 'include';
        sourceId = id;
      }
      if (excludeSet.has(id)) {
        decision = 'exclude';
        sourceId = id;
      }
    });
    return {
      decision,
      sourceId,
      explicitInclude: includeSet.has(unitId),
      explicitExclude: excludeSet.has(unitId),
      inherited: sourceId !== null && sourceId !== unitId,
    };
  };

  const matchesQuery = (unitId: string, value: string): boolean => {
    if (!value.trim()) return true;
    const q = value.toLowerCase();
    const unit = unitById.get(unitId);
    if (!unit) return false;
    if (unit.name.toLowerCase().includes(q)) return true;
    return (childrenByParent.get(unitId) || []).some((child) => matchesQuery(child.id, value));
  };

  const toggleUnit = (unitId: string) => {
    const current = resolveDecision(unitId);
    let nextIncluded = [...included];
    let nextExcluded = [...excluded];

    if (current.decision === 'include') {
      if (current.explicitInclude && !current.inherited) {
        nextIncluded = nextIncluded.filter((id) => id !== unitId);
      } else {
        nextIncluded = nextIncluded.filter((id) => id !== unitId);
        if (!nextExcluded.includes(unitId)) nextExcluded.push(unitId);
      }
    } else {
      nextExcluded = nextExcluded.filter((id) => id !== unitId);
      if (!nextIncluded.includes(unitId)) nextIncluded.push(unitId);
    }

    onChange(nextIncluded, nextExcluded);
  };

  const clearExceptions = () => onChange(included, []);
  const clearAll = () => onChange([], []);

  const summary = useMemo(() => {
    if (included.length === 0) return 'Toutes les unités';
    const first = included[0] ? unitById.get(included[0]) : undefined;
    if (!first) return `${included.length} origine(s) sélectionnée(s)`;
    return included.length === 1 ? first.name : `${first.name} +${included.length - 1}`;
  }, [included, unitById]);

  const renderUnit = (unit: OrgUnitOption, depth = 0): React.ReactNode => {
    if (!matchesQuery(unit.id, query)) return null;
    const children = childrenByParent.get(unit.id) || [];
    const current = resolveDecision(unit.id);
    const hasChildren = children.length > 0;
    const chipTone =
      current.decision === 'exclude'
        ? 'text-rose-600 bg-rose-50 border-rose-200'
        : current.decision === 'include'
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : 'text-slate-400 bg-white border-slate-200';

    return (
      <div key={unit.id}>
        <button
          type="button"
          onClick={() => toggleUnit(unit.id)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${current.decision === 'none' ? 'hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'}`}
          style={{ paddingLeft: `${12 + depth * 18}px` }}
        >
          <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${chipTone}`}>
            <span className="material-symbols-outlined text-[14px]">
              {current.decision === 'exclude' ? 'remove' : current.decision === 'include' ? 'check' : 'add'}
            </span>
          </span>
          <span className="text-sm font-medium text-slate-700 flex-1">
            {unit.name}
          </span>
          {hasChildren && (
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Branche
            </span>
          )}
          {current.decision === 'exclude' && (
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">
              Sauf
            </span>
          )}
        </button>
        {children.map((child) => renderUnit(child, depth + 1))}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((state) => !state)}
        className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 disabled:opacity-50 flex items-center justify-between gap-2 text-left"
      >
        <span className={included.length === 0 ? 'text-slate-400 font-medium' : ''}>{summary}</span>
        <span className="material-symbols-outlined text-base text-slate-400 shrink-0">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-30 mt-2 w-full max-h-[26rem] overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-xl flex flex-col">
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une unité…"
              className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar py-1">
            {(childrenByParent.get(null) || []).map((unit) => renderUnit(unit))}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest shrink-0">
            <span className="text-slate-400">{included.length} origine(s) • {excluded.length} exception(s)</span>
            <div className="flex items-center gap-3">
              {excluded.length > 0 && (
                <button type="button" onClick={clearExceptions} className="text-slate-500 hover:text-rose-600 transition-colors">
                  Effacer les exceptions
                </button>
              )}
              {(included.length > 0 || excluded.length > 0) && (
                <button type="button" onClick={clearAll} className="text-slate-500 hover:text-rose-600 transition-colors">
                  Tout effacer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  const [showAdvancedSim, setShowAdvancedSim] = useState(false);
  const [simulatorDocs, setSimulatorDocs] = useState<{
    id: string;
    title: string;
    mime_type?: string;
    file_type: string | null;
    document_category_id: string | null;
    org_unit_id: string | null;
    owner_id: string;
  }[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

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
    } catch {
      // L'erreur est publiée au bus global (useErrorBus) par buildApiError.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Charge la liste des documents au passage sur l'onglet Simulateur, pour
  // permettre le pré-remplissage du formulaire depuis un document existant.
  useEffect(() => {
    if (activeTab !== 'simulator' || simulatorDocs.length > 0) return;
    api.getDocuments({ limit: 200 })
      .then((docs) => setSimulatorDocs(docs.map((d) => ({
        id: d.id,
        title: d.title,
        mime_type: d.mime_type,
        file_type: d.file_type,
        document_category_id: d.document_category_id,
        org_unit_id: d.org_unit_id,
        owner_id: d.owner_id,
      }))))
      .catch(() => { /* silencieux : le simulateur reste utilisable en saisie libre */ });
  }, [activeTab, simulatorDocs.length]);

  const applyDocumentToSimulation = (docId: string) => {
    const doc = simulatorDocs.find((d) => d.id === docId);
    if (!doc) return;
    const docOrgUnit = doc.org_unit_id ? orgUnits.find((orgUnit) => orgUnit.id === doc.org_unit_id) : null;
    setSimulationForm((prev) => ({
      ...prev,
      filename: doc.title,
      mime_type: doc.mime_type || inferMimeTypeFromFilename(doc.title) || prev.mime_type,
      document_category_id: doc.document_category_id || '',
      source_org_unit_id: doc.org_unit_id || '',
      source_user_id: doc.owner_id || '',
      source_scope: doc.org_unit_id ? inferSimulationSourceScope(docOrgUnit) : prev.source_scope,
    }));
    setPickerOpen(false);
    setPickerQuery('');
  };

  const filteredSimulatorDocs = useMemo(() => {
    if (!pickerQuery.trim()) return simulatorDocs.slice(0, 50);
    const q = pickerQuery.toLowerCase();
    return simulatorDocs
      .filter((d) => d.title.toLowerCase().includes(q))
      .slice(0, 50);
  }, [simulatorDocs, pickerQuery]);

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
  const selectedRuleKeywords = useMemo(
    () => splitRuleKeywords(selectedRule?.filename_pattern),
    [selectedRule?.filename_pattern],
  );
  const selectedRuleMimeTokens = useMemo(
    () => normalizeMimeTokens(selectedRule?.mime_type_pattern),
    [selectedRule?.mime_type_pattern],
  );
  const orgUnitById = useMemo(() => new Map(orgUnits.map((orgUnit) => [orgUnit.id, orgUnit])), [orgUnits]);
  const childrenByParentId = useMemo(() => {
    const map = new Map<string | null, OrgUnitOption[]>();
    orgUnits.forEach((orgUnit) => {
      const parentId = orgUnit.parent_id || null;
      const bucket = map.get(parentId) || [];
      bucket.push(orgUnit);
      map.set(parentId, bucket);
    });
    return map;
  }, [orgUnits]);
  const selectedRuleOriginLabels = useMemo(() => {
    if (!selectedRule) return [];
    const includeIds = selectedRule.source_org_unit_ids || [];
    if (includeIds.length > 0) {
      return includeIds.map((id) => {
        const unit = orgUnitById.get(id);
        if (!unit) return id;
        return formatOriginSummaryLabel(unit, (childrenByParentId.get(id) || []).length > 0);
      });
    }
    if (selectedRule.source_org_unit_name) return [selectedRule.source_org_unit_name];
    return [`Toute origine de niveau ${formatScope(selectedRule.source_scope)}`];
  }, [childrenByParentId, orgUnitById, selectedRule]);
  const selectedRuleExcludedOriginLabels = useMemo(() => {
    if (!selectedRule) return [];
    return (selectedRule.source_org_unit_excluded_ids || []).map((id) => {
      const unit = orgUnitById.get(id);
      if (!unit) return id;
      return formatOriginSummaryLabel(unit, (childrenByParentId.get(id) || []).length > 0);
    });
  }, [childrenByParentId, orgUnitById, selectedRule]);
  const targetRoutingMode = useMemo<TargetRoutingMode>(
    () => deriveTargetRoutingMode(ruleForm.target_scope, ruleForm.target_org_unit_id || null),
    [ruleForm.target_org_unit_id, ruleForm.target_scope],
  );
  const selectedMimeTokens = useMemo(
    () => normalizeMimeTokens(ruleForm.mime_type_pattern),
    [ruleForm.mime_type_pattern],
  );
  const selectedSimulatorFormatToken = useMemo(() => {
    const mime = simulationForm.mime_type.trim().toLowerCase();
    if (!mime) return '';
    const alias = Object.entries(FILE_FORMAT_TO_MIME).find(([, knownMime]) => knownMime === mime);
    return alias?.[0] || '';
  }, [simulationForm.mime_type]);
  const selectedRuleTargetRoutingMode = useMemo<TargetRoutingMode>(
    () => deriveTargetRoutingMode(selectedRule?.target_scope, selectedRule?.target_org_unit_id ?? null),
    [selectedRule],
  );
  const selectedRuleTargetStrategyLabel = useMemo(
    () => formatTargetRoutingMode(selectedRuleTargetRoutingMode),
    [selectedRuleTargetRoutingMode],
  );
  const selectedRuleExplicitTargetLabel = useMemo(() => {
    if (!selectedRule) return null;
    if (selectedRuleTargetRoutingMode === 'person') return selectedRule.target_user_name || null;
    if (selectedRuleTargetRoutingMode === 'specific_org_unit') return selectedRule.target_org_unit_name || null;
    return null;
  }, [selectedRule, selectedRuleTargetRoutingMode]);

  const activityOptions = useMemo(
    () => activities.filter((activity) => !ruleForm.domain_id || activity.domain_id === ruleForm.domain_id),
    [activities, ruleForm.domain_id],
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
        document_category_ids: selectedRule.document_category_ids || [],
        source_org_unit_ids: selectedRule.source_org_unit_ids || [],
        source_org_unit_excluded_ids: selectedRule.source_org_unit_excluded_ids || [],
        source_user_ids: selectedRule.source_user_ids || [],
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
      document_category_ids: rule.document_category_ids || [],
      source_org_unit_ids: rule.source_org_unit_ids || [],
      source_org_unit_excluded_ids: rule.source_org_unit_excluded_ids || [],
      source_user_ids: rule.source_user_ids || [],
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

  const handleTargetRoutingModeChange = (mode: TargetRoutingMode) => {
    setRuleForm((prev) => {
      switch (mode) {
        case 'origin':
          return {
            ...prev,
            target_scope: 'service',
            target_org_unit_id: '',
            target_user_id: '',
          };
        case 'parent_subdirectorate':
          return {
            ...prev,
            target_scope: 'subdirectorate',
            target_org_unit_id: '',
            target_user_id: '',
          };
        case 'parent_directorate':
          return {
            ...prev,
            target_scope: 'directorate',
            target_org_unit_id: '',
            target_user_id: '',
          };
        case 'specific_org_unit':
          return {
            ...prev,
            target_scope: prev.target_org_unit_id
              ? scopeFromOrgUnitLevel(orgUnitById.get(prev.target_org_unit_id)?.level)
              : 'service',
            target_org_unit_id: prev.target_org_unit_id,
            target_user_id: '',
          };
        case 'person':
          return {
            ...prev,
            target_scope: 'person',
            target_org_unit_id: '',
            target_user_id: prev.target_user_id,
          };
        default:
          return prev;
      }
    });
  };

  const handleSpecificTargetOrgUnitChange = (targetOrgUnitId: string) => {
    const targetUnit = orgUnitById.get(targetOrgUnitId);
    setRuleForm((prev) => ({
      ...prev,
      target_org_unit_id: targetOrgUnitId,
      target_user_id: '',
      target_scope: scopeFromOrgUnitLevel(targetUnit?.level),
    }));
  };

  const toggleMimeToken = (token: string) => {
    setRuleForm((prev) => {
      const current = new Set(normalizeMimeTokens(prev.mime_type_pattern));
      if (current.has(token)) current.delete(token);
      else current.add(token);
      return {
        ...prev,
        mime_type_pattern: Array.from(current).join(';'),
      };
    });
  };

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
    } catch {
      // L'erreur est publiée au bus global (useErrorBus) par buildApiError.
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
    } catch {
      // L'erreur est publiée au bus global (useErrorBus) par buildApiError.
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
    } catch {
      // L'erreur est publiée au bus global (useErrorBus) par buildApiError.
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
    } catch {
      // L'erreur est publiée au bus global (useErrorBus) par buildApiError.
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
      // Si une multi-sélection est utilisée, on neutralise le legacy single FK.
      // L'inverse est aussi vrai : un legacy single FK est conservé si la liste est vide.
      source_org_unit_id: ruleForm.source_org_unit_ids.length > 0 ? null : ruleForm.source_org_unit_id || null,
      source_user_id: ruleForm.source_user_ids.length > 0 ? null : ruleForm.source_user_id || null,
      document_category_id: ruleForm.document_category_ids.length > 0 ? null : ruleForm.document_category_id || null,
      document_category_ids: ruleForm.document_category_ids.length > 0 ? ruleForm.document_category_ids : null,
      source_org_unit_ids: ruleForm.source_org_unit_ids.length > 0 ? ruleForm.source_org_unit_ids : null,
      source_org_unit_excluded_ids: ruleForm.source_org_unit_excluded_ids.length > 0 ? ruleForm.source_org_unit_excluded_ids : null,
      source_user_ids: ruleForm.source_user_ids.length > 0 ? ruleForm.source_user_ids : null,
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
    } catch {
      // L'erreur est publiée au bus global (useErrorBus) par buildApiError.
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
    } catch {
      // L'erreur est publiée au bus global (useErrorBus) par buildApiError.
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
    } catch {
      // L'erreur est publiée au bus global (useErrorBus) par buildApiError.
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
    } catch {
      // L'erreur est déjà publiée au bus global (useErrorBus) par buildApiError
      // → toast/modal automatique + log dev avec technicalDetail (Pydantic).
      // Pas de showToast local ni de console.error : éviterait un doublon.
    } finally {
      setWorking(null);
    }
  };

  const renderDomainsTab = () => {
    const domainActivitiesCount = (domainId: string) =>
      activities.filter((a) => a.domain_id === domainId).length;

    return (
      <div className="flex flex-col lg:flex-row gap-8 h-full">
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
    <div className="flex flex-col lg:flex-row gap-8 h-full">
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

        {activities.length === 0 ? (
          <div className="p-5 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white/40 text-center">
            <p className="text-xs italic text-slate-500 leading-relaxed">
              Aucune activité pour l&apos;instant.<br />
              Cliquez sur <span className="font-bold text-emerald-600">« Nouvelle Activité »</span> ci-dessus pour en créer une. Le panneau de droite vous explique comment.
            </p>
          </div>
        ) : (
          activities.map((activity) => (
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
    const targetIsPerson = targetRoutingMode === 'person';
    const targetIsSpecificOrgUnit = targetRoutingMode === 'specific_org_unit';
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
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">description</span>Type(s) de document</label>
              <MultiCheckSelect
                ariaLabel="Type de document"
                placeholder="N'importe quel type"
                accent="rdpc-blue"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                selected={ruleForm.document_category_ids}
                onChange={(next) => setRuleForm((prev) => ({ ...prev, document_category_ids: next }))}
              />
              <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Cochez un ou plusieurs types — la règle s&apos;applique si <span className="font-bold not-italic">au moins un</span> est sélectionné. Vide = tous types.</p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">apartment</span>Origine concernée</label>
              <OriginScopeSelect
                units={orgUnits}
                included={ruleForm.source_org_unit_ids}
                excluded={ruleForm.source_org_unit_excluded_ids}
                onChange={(nextIncluded, nextExcluded) => setRuleForm((prev) => ({
                  ...prev,
                  source_org_unit_ids: nextIncluded,
                  source_org_unit_excluded_ids: nextExcluded,
                  source_scope: 'service',
                }))}
              />
              <p className="text-[10px] text-slate-400 italic mt-1 ml-1">
                Choisissez une ou plusieurs branches de l&apos;organisation. Si vous retirez une sous-unité d&apos;une branche incluse, elle devient une exception.
              </p>
              {ruleForm.source_org_unit_excluded_ids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ruleForm.source_org_unit_excluded_ids.map((id) => (
                    <span key={id} className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-widest">
                      Sauf {orgUnitById.get(id)?.name || id}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">person</span>Agent(s) émetteur(s)</label>
              <MultiCheckSelect
                ariaLabel="Agent émetteur"
                placeholder="N'importe quel agent"
                accent="rdpc-blue"
                options={users.map((u) => ({ value: u.id, label: u.full_name }))}
                selected={ruleForm.source_user_ids}
                onChange={(next) => setRuleForm((prev) => ({ ...prev, source_user_ids: next }))}
              />
              <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Vide = tous les agents.</p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">search</span>Mots-clés dans le nom du fichier</label>
              <input aria-label="Mots-clés nom fichier" value={ruleForm.filename_pattern} onChange={(event) => setRuleForm((prev) => ({ ...prev, filename_pattern: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium text-slate-700 focus:outline-none focus:border-rdpc-blue" placeholder="marche;devis" />
              <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Plusieurs mots séparés par <span className="font-mono">;</span> — la règle s&apos;applique si <span className="font-bold not-italic">au moins un</span> mot est trouvé. Accents et majuscules ignorés (« marche » attrape aussi « Marché », « MARCHÉS »). Laisser vide pour ignorer ce critère.</p>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-rdpc-blue">draft</span>Formats acceptés</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FILE_FORMAT_OPTIONS.map((formatOption) => {
                  const selected = selectedMimeTokens.includes(formatOption.value);
                  return (
                    <button
                      key={formatOption.value}
                      type="button"
                      onClick={() => toggleMimeToken(formatOption.value)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                        selected
                          ? 'bg-rdpc-blue text-white border-rdpc-blue'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-rdpc-blue hover:text-rdpc-blue'
                      }`}
                    >
                      {formatOption.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 italic mt-2 ml-1">
                Ne cochez rien pour accepter tous les formats. Cochez seulement les formats à filtrer si la règle doit être plus stricte.
              </p>
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
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"><span className="material-symbols-outlined text-base text-emerald-600">forward_to_inbox</span>Comment déterminer le destinataire ?</label>
              <select
                aria-label="Stratégie de destination"
                value={targetRoutingMode}
                onChange={(event) => handleTargetRoutingModeChange(event.target.value as TargetRoutingMode)}
                className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
              >
                <option value="origin">Conserver l&apos;unité d&apos;origine</option>
                <option value="parent_subdirectorate">Sous-direction parente</option>
                <option value="parent_directorate">Direction parente</option>
                <option value="specific_org_unit">Une unité précise</option>
                <option value="person">Une personne précise</option>
              </select>
              {targetIsPerson ? (
                <select aria-label="Utilisateur destinataire" value={ruleForm.target_user_id} onChange={(event) => setRuleForm((prev) => ({ ...prev, target_user_id: event.target.value }))} className="w-full mt-2 bg-white border-2 border-emerald-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                  <option value="">Choisir un agent</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              ) : targetIsSpecificOrgUnit ? (
                <select aria-label="Unité destinataire" value={ruleForm.target_org_unit_id} onChange={(event) => handleSpecificTargetOrgUnitChange(event.target.value)} className="w-full mt-2 bg-white border-2 border-emerald-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500">
                  <option value="">Choisir une unité</option>
                  {orgUnits.map((orgUnit) => <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>)}
                </select>
              ) : (
                <p className="mt-2 rounded-2xl border-2 border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-slate-600">
                  {targetRoutingMode === 'origin' && "Le document reste rattaché à l'unité qui l'a émis, quel que soit son niveau dans la hiérarchie."}
                  {targetRoutingMode === 'parent_subdirectorate' && "Le document remonte vers la sous-direction parente de l'unité d'origine."}
                  {targetRoutingMode === 'parent_directorate' && "Le document remonte vers la direction parente de l'unité d'origine."}
                </p>
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
            <span className="text-[10px] font-medium italic text-slate-400 normal-case tracking-normal">(priorité, code technique)</span>
          </button>
          {showAdvancedRule && (
            <div className="mt-4 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Code technique</label>
                <input aria-label="Code règle classement" value={ruleForm.code} onChange={(event) => setRuleForm((prev) => ({ ...prev, code: slugifyCode(event.target.value) }))} placeholder="route_marche_service" className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-mono font-bold text-slate-700 focus:outline-none focus:border-slate-400" />
                <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Lettres, chiffres, underscores. À fixer en mise en production.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Priorité</label>
                  <input aria-label="Priorité" type="number" min="0" value={ruleForm.priority} onChange={(event) => setRuleForm((prev) => ({ ...prev, priority: event.target.value }))} className="w-full mt-1 bg-white border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-400" />
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Plus haut = passe en premier si plusieurs règles correspondent.</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Formats du fichier</label>
                  <div className="mt-1 min-h-[52px] rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                    {selectedMimeTokens.length > 0
                      ? selectedMimeTokens.map((token) => formatMimeTokenLabel(token)).join(', ')
                      : 'Tous les formats sont acceptés.'}
                  </div>
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Le choix se fait plus haut avec les pastilles PDF, DOCX, XLSX, images, etc.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderRulesTab = () => (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Origine concernée</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRuleOriginLabels.map((originLabel) => (
                    <span
                      key={originLabel}
                      className="px-3 py-1 rounded-full bg-blue-100 text-rdpc-blue text-[10px] font-black uppercase tracking-widest"
                    >
                      {originLabel}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sauf</p>
                {selectedRuleExcludedOriginLabels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRuleExcludedOriginLabels.map((orgUnitName) => (
                      <span
                        key={orgUnitName}
                        className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-widest"
                      >
                        {orgUnitName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 font-bold text-slate-400">Aucune exception</p>
                )}
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stratégie de destination</p>
                <p className="mt-1 font-bold text-slate-800">{selectedRuleTargetStrategyLabel}</p>
                {selectedRuleExplicitTargetLabel && (
                  <p className="mt-1 text-sm font-medium text-slate-500">{selectedRuleExplicitTargetLabel}</p>
                )}
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
              {selectedRuleKeywords.length > 0 && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mots-clés dans le nom du fichier</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRuleKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] italic text-slate-400">
                    La règle s&apos;applique si au moins un de ces mots est trouvé dans le nom du fichier.
                  </p>
                </div>
              )}
              <div className="rounded-2xl bg-slate-50 px-4 py-3 md:col-span-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Formats acceptés</p>
                {selectedRuleMimeTokens.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRuleMimeTokens.map((token) => (
                      <span
                        key={token}
                        className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black uppercase tracking-widest"
                      >
                        {formatMimeTokenLabel(token)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 font-bold text-slate-800">Tous les formats</p>
                )}
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
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      <div className="w-full lg:w-1/3 flex flex-col min-h-0 gap-3">
        <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-3">
        {/* PICKER — Pré-remplir depuis un document existant */}
        <div className="rounded-[1.5rem] border-2 border-amber-200 bg-amber-50/30 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2">Pré-remplir depuis un document existant</p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((s) => !s)}
              className="w-full bg-white border-2 border-amber-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 flex items-center justify-between gap-2 text-left"
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-base text-amber-600 shrink-0">search</span>
                <span className="truncate text-slate-400 font-medium">Rechercher un document importé…</span>
              </span>
              <span className="material-symbols-outlined text-base text-slate-400 shrink-0">{pickerOpen ? 'expand_less' : 'expand_more'}</span>
            </button>
            {pickerOpen && (
              <div className="absolute z-30 mt-2 w-full max-h-72 overflow-hidden rounded-2xl border-2 border-amber-200 bg-white shadow-xl flex flex-col">
                <div className="p-2 border-b border-slate-100 shrink-0">
                  <input
                    type="text"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Tapez un titre…"
                    autoFocus
                    className="w-full bg-slate-50 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none"
                    aria-label="Rechercher un document"
                  />
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  {filteredSimulatorDocs.length === 0 ? (
                    <p className="text-xs italic text-slate-400 text-center py-4 px-3">
                      {simulatorDocs.length === 0 ? 'Aucun document importé pour l’instant.' : 'Aucun document ne correspond.'}
                    </p>
                  ) : (
                    filteredSimulatorDocs.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => applyDocumentToSimulation(doc.id)}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 transition-colors flex items-start gap-2"
                      >
                        <span className="material-symbols-outlined text-base text-slate-400 mt-0.5">description</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{doc.title}</p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-400">{(doc.file_type || 'fichier').toUpperCase()}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-500 italic mt-2">
            Remplit automatiquement le formulaire ci-dessous.
          </p>
        </div>

        {/* FORMULAIRE — Décrire le document à tester */}
        <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-1">Décrivez le document à tester</p>
            <p className="text-[10px] italic text-slate-400">Aucun document n’est créé — c’est 100 % à blanc.</p>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              <span className="material-symbols-outlined text-base text-amber-600">description</span>
              Nom du fichier
            </label>
            <input
              aria-label="Nom du fichier"
              value={simulationForm.filename}
              onChange={(event) => {
                const nextFilename = event.target.value;
                const inferredMime = inferMimeTypeFromFilename(nextFilename);
                setSimulationForm((prev) => ({
                  ...prev,
                  filename: nextFilename,
                  mime_type: inferredMime || prev.mime_type,
                }));
              }}
              placeholder="ex : devis_marche_2026.pdf"
              className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              <span className="material-symbols-outlined text-base text-amber-600">category</span>
              Type de document
            </label>
            <select
              aria-label="Type de document"
              value={simulationForm.document_category_id}
              onChange={(event) => setSimulationForm((prev) => ({ ...prev, document_category_id: event.target.value }))}
              className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">N’importe quel type</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              <span className="material-symbols-outlined text-base text-amber-600">apartment</span>
              Service d’origine
            </label>
            <select
              aria-label="Service d'origine"
              value={simulationForm.source_org_unit_id}
              onChange={(event) => {
                const nextOrgUnitId = event.target.value;
                const nextOrgUnit = orgUnits.find((orgUnit) => orgUnit.id === nextOrgUnitId);
                setSimulationForm((prev) => ({
                  ...prev,
                  source_org_unit_id: nextOrgUnitId,
                  source_scope: nextOrgUnitId ? inferSimulationSourceScope(nextOrgUnit) : prev.source_scope,
                }));
              }}
              className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">Aucun (générique)</option>
              {orgUnits.map((orgUnit) => <option key={orgUnit.id} value={orgUnit.id}>{orgUnit.name}</option>)}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              <span className="material-symbols-outlined text-base text-amber-600">draft</span>
              Format du fichier
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FILE_FORMAT_OPTIONS.map((formatOption) => {
                const selected = selectedSimulatorFormatToken === formatOption.value;
                return (
                  <button
                    key={formatOption.value}
                    type="button"
                    onClick={() => setSimulationForm((prev) => ({
                      ...prev,
                      mime_type: FILE_FORMAT_TO_MIME[formatOption.value] || '',
                    }))}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                      selected
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-amber-500 hover:text-amber-700'
                    }`}
                  >
                    {formatOption.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 italic mt-2 ml-1">
              Proposé automatiquement depuis le nom du fichier. Ajustez ici si besoin.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              <span className="material-symbols-outlined text-base text-amber-600">person</span>
              Agent émetteur
            </label>
            <select
              aria-label="Agent émetteur"
              value={simulationForm.source_user_id}
              onChange={(event) => setSimulationForm((prev) => ({ ...prev, source_user_id: event.target.value }))}
              className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">Aucun (générique)</option>
              {simulatorUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
            </select>
          </div>

          {/* OPTIONS AVANCÉES */}
          <div className="border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setShowAdvancedSim((s) => !s)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-amber-600 transition-colors">
              <span className="material-symbols-outlined text-base">{showAdvancedSim ? 'expand_less' : 'expand_more'}</span>
              Options avancées
              <span className="text-[10px] font-medium italic text-slate-400 normal-case tracking-normal">(lecture technique)</span>
            </button>
            {showAdvancedSim && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Format technique détecté</label>
                  <input
                    aria-label="Format MIME"
                    value={simulationForm.mime_type}
                    readOnly
                    className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-mono font-medium text-slate-700 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Valeur technique réellement transmise au moteur.</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Niveau d’origine détecté</label>
                  <input
                    aria-label="Niveau d'origine détecté"
                    value={formatScope(simulationForm.source_scope)}
                    readOnly
                    className="w-full mt-1 bg-slate-50 border-2 border-slate-200 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 italic mt-1 ml-1">Déduit automatiquement depuis l’unité d’origine ou le document choisi.</p>
                </div>
              </div>
            )}
          </div>

        </div>
        </div>
        {/* Bouton sticky en bas de colonne — toujours accessible quoi que l'on
            ait scrollé dans le formulaire au-dessus. */}
        <button
          type="button"
          onClick={() => { void runSimulation(); }}
          disabled={working === 'simulate'}
          className="shrink-0 w-full px-5 py-3 rounded-[1.5rem] bg-amber-600 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-200"
        >
          <span className="material-symbols-outlined text-base">science</span>
          {working === 'simulate' ? 'Simulation…' : 'Lancer la simulation'}
        </button>
      </div>

      <div className="flex-1 bg-white rounded-[2.5rem] border-2 border-slate-200 relative overflow-hidden flex flex-col p-8 shadow-sm">
        {simulationResult ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-800">Résultat du test</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">{simulationResult.message}</p>
              </div>
              <span className={`px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES[simulationResult.status] || STATUS_STYLES.no_rule}`}>{STATUS_LABELS[simulationResult.status] || simulationResult.status}</span>
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
            <div className="mt-6">
              <SimulationTracePanel stages={simulationResult.stages} />
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
    <div className="flex flex-col gap-6 h-full min-h-0">
      <div className="flex gap-2.5 border-b-2 border-slate-200 shrink-0 overflow-x-auto custom-scrollbar">
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
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rdpc-blue" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'domains' && renderDomainsTab()}
          {activeTab === 'activities' && renderActivitiesTab()}
          {activeTab === 'rules' && renderRulesTab()}
          {activeTab === 'simulator' && renderSimulatorTab()}
        </div>
      )}

      {toast && <ToastView toast={toast} />}
    </div>
  );
};

export default ClassificationSettingsTab;
