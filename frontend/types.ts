// frontend/types.ts
// ─── Types matching backend API schemas ─────────────────────

export interface Document {
  id: string;
  title: string;
  tenant_id: string;
  org_unit_id: string;
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
  tenant_id: string;
  user_id: string | null;
  table_name: string;
  record_id: string;
  action: string;
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
