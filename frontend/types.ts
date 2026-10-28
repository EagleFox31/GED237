// frontend/types.ts
// ─── Types matching backend API schemas ─────────────────────

export interface Document {
  id: string;
  title: string;
  tenant_id: string;
  org_unit_id: string | null;
  owner_id: string;
  file_path: string;
  file_type: string | null;    // normalized short type: "pdf", "docx", etc.
  file_size: number | null;    // bytes
  mime_type?: string;          // full MIME type: "application/pdf", etc.
  document_category_id: string | null;
  category_code: string | null;
  category_name: string | null;
  tags: string[];
  status: 'draft' | 'in_review' | 'validated' | 'signed' | 'archived' | 'rejected' | 'returned';
  processing_mode?: 'archive' | 'process';
  current_version_number: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
  description?: string | null;
  classification_domain_id?: string | null;
  classification_domain_name?: string | null;
  classification_activity_id?: string | null;
  classification_activity_name?: string | null;
  classification_year?: number | null;
  classification_scope?: 'person' | 'service' | 'subdirectorate' | 'directorate';
  classification_target_org_unit_id?: string | null;
  classification_target_user_id?: string | null;
  classification_status?: 'pending' | 'classified' | 'needs_review' | 'rejected';
  logical_space_path?: string | null;
  source_relative_path?: string | null;
  import_job_id?: string | null;
}

export type ClassificationReviewStatus = 'open' | 'resolved' | 'cancelled';

export interface ClassificationReview {
  id: string;
  tenant_id: string;
  document_id?: string | null;
  import_job_item_id?: string | null;
  review_source: 'document' | 'import_job_item';
  review_status: ClassificationReviewStatus;
  processing_mode?: 'archive' | 'process' | null;
  arbitration_reason?: string | null;
  suggested_domain_id?: string | null;
  suggested_activity_id?: string | null;
  suggested_year?: number | null;
  suggested_scope?: 'person' | 'service' | 'subdirectorate' | 'directorate' | null;
  suggested_target_org_unit_id?: string | null;
  suggested_target_user_id?: string | null;
  resolved_by_id?: string | null;
  resolved_at?: string | null;
  resolution_comment?: string | null;
  created_at: string;
  updated_at: string;
  document?: Document | null;
  import_job_item?: ImportJobItem | null;
}

export interface ResolveClassificationReviewPayload {
  classification_domain_id: string;
  classification_activity_id: string;
  classification_year: number;
  classification_scope: 'person' | 'service' | 'subdirectorate' | 'directorate';
  classification_target_org_unit_id?: string;
  classification_target_user_id?: string;
  document_category_id?: string;
  new_filename?: string;
  comment?: string;
  relaunch_workflow?: boolean;
}

export interface ResolveClassificationReviewResponse {
  success: boolean;
  review_id: string;
  document_id: string;
  review_status: ClassificationReviewStatus;
  document_classification_status: string;
  logical_space_path?: string | null;
  workflow_relaunched: boolean;
  document: Document;
}

export interface ClassificationDomain {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassificationActivity {
  id: string;
  tenant_id: string;
  domain_id: string;
  domain_name?: string | null;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassificationRule {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string | null;
  priority: number;
  is_active: boolean;
  source_scope: 'person' | 'service' | 'subdirectorate';
  source_org_unit_id?: string | null;
  source_org_unit_name?: string | null;
  source_user_id?: string | null;
  source_user_name?: string | null;
  document_category_id?: string | null;
  document_category_name?: string | null;
  // Multi-sélection (sémantique OU). Liste non vide = prime sur les 3 single FK ci-dessus.
  document_category_ids?: string[] | null;
  source_org_unit_ids?: string[] | null;
  source_org_unit_excluded_ids?: string[] | null;
  source_user_ids?: string[] | null;
  filename_pattern?: string | null;
  mime_type_pattern?: string | null;
  target_scope: 'person' | 'service' | 'subdirectorate' | 'directorate';
  target_org_unit_id?: string | null;
  target_org_unit_name?: string | null;
  target_user_id?: string | null;
  target_user_name?: string | null;
  domain_id?: string | null;
  domain_name?: string | null;
  activity_id?: string | null;
  activity_name?: string | null;
  year_strategy: 'current' | 'from_filename' | 'from_metadata' | 'fixed';
  fixed_year?: number | null;
  workflow_template_id?: string | null;
  workflow_template_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassificationSimulationResponse {
  status: 'classified' | 'needs_review' | 'no_rule' | 'rejected';
  rule_id?: string | null;
  rule_code?: string | null;
  rule_name?: string | null;
  rule_priority?: number | null;
  message: string;
  logical_space_path?: string | null;
  classification_scope?: 'person' | 'service' | 'subdirectorate' | 'directorate' | null;
  classification_target_org_unit_id?: string | null;
  classification_target_org_unit_name?: string | null;
  classification_target_user_id?: string | null;
  classification_target_user_name?: string | null;
  classification_domain_id?: string | null;
  classification_domain_name?: string | null;
  classification_activity_id?: string | null;
  classification_activity_name?: string | null;
  classification_year?: number | null;
  diagnostics?: ClassificationRuleDiagnostic[];
  stages?: ClassificationSimulationStage[];
}

export interface ClassificationRuleCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ClassificationRuleDiagnostic {
  rule_id: string;
  rule_code: string;
  rule_name: string;
  rule_priority: number;
  matched: boolean;
  checks: ClassificationRuleCheck[];
}

export interface ClassificationStageRule {
  rule_id: string;
  rule_code: string;
  rule_name: string;
  rule_priority: number;
  detail: string;
}

export interface ClassificationSimulationStage {
  key: string;
  label: string;
  summary: string;
  remaining_rules: ClassificationStageRule[];
  removed_rules: ClassificationStageRule[];
}

export type ImportSourceScope = 'person' | 'service' | 'subdirectorate';
export type ImportJobStatus =
  | 'draft'
  | 'analyzed'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'cancelled';
export type ImportJobItemStatus =
  | 'pending'
  | 'classified'
  | 'needs_review'
  | 'duplicate'
  | 'ignored'
  | 'imported'
  | 'failed';
export type ImportProcessingMode = 'archive' | 'process';

export interface ImportJobItem {
  id: string;
  import_job_id: string;
  original_filename: string;
  source_relative_path: string;
  mime_type: string | null;
  file_size: number;
  checksum_sha256?: string | null;
  detected_document_category_id?: string | null;
  resolved_domain_id?: string | null;
  resolved_activity_id?: string | null;
  resolved_year?: number | null;
  resolved_scope?: string | null;
  resolved_target_org_unit_id?: string | null;
  resolved_target_user_id?: string | null;
  workflow_template_id?: string | null;
  logical_space_path?: string | null;
  status: ImportJobItemStatus;
  error_message?: string | null;
  document_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportJob {
  id: string;
  tenant_id: string;
  created_by_id: string;
  source_scope: ImportSourceScope;
  target_org_unit_id?: string | null;
  target_user_id?: string | null;
  default_document_category_id?: string | null;
  forced_year?: number | null;
  processing_mode: ImportProcessingMode;
  status: ImportJobStatus;
  total_files: number;
  supported_files: number;
  ignored_files: number;
  duplicate_files: number;
  error_files: number;
  created_at: string;
  updated_at: string;
}

export interface ImportJobWithItems extends ImportJob {
  items: ImportJobItem[];
}

export interface ImportCommitResponse {
  job: ImportJobWithItems;
  imported_documents: number;
  pending_review_items: number;
  failed_items: number;
}

export interface WorkflowStep {
  id: string;
  document_id: string;
  step_order: number;
  label: string;
  assigned_to: string | null;
  status: 'pending' | 'completed' | 'current' | 'rejected' | 'returned' | 'cancelled' | 'pending_assignment';
  expected_action_type: 'visa' | 'approval' | 'final_signature' | 'read_ack';
  completed_at: string | null;
  comment: string | null;
}

export interface WorkflowTask extends WorkflowStep {
  // WorkflowStep from /pending endpoint - same shape
  document_title?: string;  // joined from document if available
}

export interface Tenant {
  id: string;
  name: string;
  short_name: string;
  domain?: string;
  logo_url?: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  matricule: string;
  role_id: number;
  tenant_id: string;
  org_unit_id?: string;
  is_active: boolean;
}

export interface DocumentCategory {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DocumentCategoryCreate = Omit<DocumentCategory, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>;

export interface TenantMetrics {
  users: { total: number };
  documents: { total: number; storage_used_mb: number; storage_quota_mb?: number };
  workflows: { pending: number; completed: number; rejected: number };
}

export interface PlatformMetrics {
  tenants: { total: number };
  users: { total: number };
  platform: { total_documents: number; total_storage_gb: number };
}

// ─── AuthZ types ────────────────────────────────────────────

export interface PolicyRule {
  ptype: string;
  v0: string;
  v1: string;
  v2: string;
  v3?: string;
  v4?: string;
  v5?: string;
}

export interface PolicyMutationResponse {
  created: boolean;
  policy: PolicyRule;
}

export interface PolicyDeleteResponse {
  deleted: boolean;
  policy: PolicyRule;
}

export interface AuthzMetricPoint {
  decision: string;
  role: string;
  resource: string;
  action: string;
  tenant_id: string;
  reason: string;
  count: number;
}

export interface AuthzHealthResponse {
  backend: string;
  dropped_count: number;
  degraded: boolean;
}

// ─── Audit types ────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  user_name?: string | null;
  user_matricule?: string | null;
  table_name: string;
  table_label?: string | null;
  record_id: string;
  resource_label?: string | null;
  action: string;
  action_label?: string | null;
  detail?: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─── Helper utilities ───────────────────────────────────────

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getFileTypeLabel(fileType: string | null): string {
  if (!fileType) return 'FILE';
  const normalized = fileType.toLowerCase();
  if (normalized.includes('pdf')) return 'PDF';
  if (normalized.includes('word') || normalized.includes('docx') || normalized === 'doc') return 'DOCX';
  if (normalized.includes('sheet') || normalized.includes('excel') || normalized.includes('xlsx') || normalized === 'xls') return 'EXCEL';
  if (
    normalized.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff'].includes(normalized)
  ) return 'IMAGE';
  return 'FILE';
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'draft': 'Brouillon',
    'in_review': 'En Révision',
    'validated': 'Validé',
    'signed': 'Signé',
    'archived': 'Archivé',
    'rejected': 'Rejeté',
    'returned': 'Renvoyé',
    'pending_assignment': 'En attente d\'assignation',
  };
  return map[status] || status;
}

export function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('fr-CM', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch {
    return isoDate;
  }
}
