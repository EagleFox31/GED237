// frontend/services/resources/reports.api.ts
//
// Domaine : reporting métier et séries d évolution.
// SRP : change uniquement si le contrat /reports/* évolue.

import { apiCall } from '../http/client';

export interface ReportsEvolutionFilters {
    tenant_id: string;
    date_from: string;
    date_to: string;
    granularity: 'day' | 'week' | 'month';
    org_unit_id?: string | null;
    recursive: boolean;
    domain_id?: string | null;
    activity_id?: string | null;
    document_category_id?: string | null;
}

export interface ReportsTimeseriesPoint {
    bucket_start: string;
    bucket_label: string;
    value: number;
}

export type ReportsSeriesKey =
    | 'documents_created'
    | 'documents_auto_classified'
    | 'documents_needing_review';

export interface ReportsEvolutionSeries {
    documents_created: ReportsTimeseriesPoint[];
    documents_auto_classified: ReportsTimeseriesPoint[];
    documents_needing_review: ReportsTimeseriesPoint[];
    imports_completed: ReportsTimeseriesPoint[];
    workflow_steps_completed: ReportsTimeseriesPoint[];
    workflow_steps_rejected: ReportsTimeseriesPoint[];
}

export interface ReportsEvolutionTotals {
    documents_created: number;
    documents_auto_classified: number;
    documents_needing_review: number;
    imports_completed: number;
    workflow_steps_completed: number;
    workflow_steps_rejected: number;
}

export interface ReportsBreakdownItem {
    id?: string | null;
    label: string;
    value: number;
}

export interface ReportsSeriesBreakdowns {
    documents_created: ReportsBreakdownItem[];
    documents_auto_classified: ReportsBreakdownItem[];
    documents_needing_review: ReportsBreakdownItem[];
}

export interface ReportsEvolutionBreakdowns {
    org_units: ReportsSeriesBreakdowns;
    domains: ReportsBreakdownItem[];
    activities: ReportsBreakdownItem[];
    imports: ReportsBreakdownItem[];
}

export interface ReportsEvolutionResponse {
    filters: ReportsEvolutionFilters;
    series: ReportsEvolutionSeries;
    totals: ReportsEvolutionTotals;
    breakdowns: ReportsEvolutionBreakdowns;
}

export interface ReportsDocumentActivityBreakdownItem {
    key: string;
    label: string;
    value: number;
}

export interface ReportsDocumentActivitySignals {
    unclassified_documents: number;
    documents_missing_information: number;
    documents_needing_review: number;
    imports_needing_review: number;
    /** Compteurs anonymes du mode « Ranger sur mon poste ». */
    local_organize_runs: number;
    local_organize_files: number;
    local_organize_files_unranged: number;
}

export interface ReportsDocumentActivityAvailability {
    by_file_type: boolean;
    by_org_unit: boolean;
    urgent_documents: boolean;
    confidential_documents: boolean;
}

export interface ReportsDocumentActivityResponse {
    total_active_documents: number;
    validated_documents: number;
    archived_documents: number;
    reviewed_documents: number;
    by_status: ReportsDocumentActivityBreakdownItem[];
    by_file_type: ReportsDocumentActivityBreakdownItem[];
    by_org_unit: ReportsDocumentActivityBreakdownItem[];
    signals: ReportsDocumentActivitySignals;
    availability: ReportsDocumentActivityAvailability;
}

export interface ReportsWorkflowActivityBreakdownItem {
    key: string;
    label: string;
    value: number;
}

export interface ReportsWorkflowDelayItem {
    key: string;
    label: string;
    average_days: number;
    steps_count: number;
}

export interface ReportsWorkflowActivityAvailability {
    by_step: boolean;
    pending_actions: boolean;
    delay_by_org_unit: boolean;
}

export interface ReportsWorkflowActivityResponse {
    active_steps: number;
    completed_steps: number;
    rejected_steps: number;
    open_workflows: number;
    completed_workflows: number;
    blocked_workflows_estimated: number;
    by_step: ReportsWorkflowActivityBreakdownItem[];
    pending_actions: ReportsWorkflowActivityBreakdownItem[];
    slowest_steps: ReportsWorkflowDelayItem[];
    delay_by_org_unit: ReportsWorkflowDelayItem[];
    availability: ReportsWorkflowActivityAvailability;
}

export interface ReportsServiceActivityItem {
    id: string;
    label: string;
    documents_total: number;
    documents_in_progress: number;
    documents_needing_review: number;
    open_workflows: number;
    estimated_delays: number;
    average_workflow_days: number;
    active_users: number;
    inactive_users: number;
}

export interface ReportsServiceActivityResponse {
    services: ReportsServiceActivityItem[];
    total_services: number;
    overloaded_services: number;
    services_with_reviews: number;
    availability: Record<string, boolean>;
}

export const reportsApi = {
    getReportsEvolution: (params: {
        dateFrom?: string;
        dateTo?: string;
        granularity?: 'day' | 'week' | 'month';
        orgUnitId?: string;
        recursive?: boolean;
        domainId?: string;
        activityId?: string;
        documentCategoryId?: string;
        tenantId?: string;
    } = {}): Promise<ReportsEvolutionResponse> => {
        const q = new URLSearchParams();
        if (params.dateFrom) q.set('date_from', params.dateFrom);
        if (params.dateTo) q.set('date_to', params.dateTo);
        if (params.granularity) q.set('granularity', params.granularity);
        if (params.orgUnitId) q.set('org_unit_id', params.orgUnitId);
        if (params.recursive) q.set('recursive', 'true');
        if (params.domainId) q.set('domain_id', params.domainId);
        if (params.activityId) q.set('activity_id', params.activityId);
        if (params.documentCategoryId) q.set('document_category_id', params.documentCategoryId);
        if (params.tenantId) q.set('tenant_id', params.tenantId);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiCall<ReportsEvolutionResponse>(
            `/reports/evolution${qs}`,
            {},
            "Récupération de l'évolution des rapports impossible",
        );
    },
    getReportsDocumentActivity: (params: {
        orgUnitId?: string;
        recursive?: boolean;
        domainId?: string;
        activityId?: string;
        documentCategoryId?: string;
        tenantId?: string;
    } = {}): Promise<ReportsDocumentActivityResponse> => {
        const q = new URLSearchParams();
        if (params.orgUnitId) q.set('org_unit_id', params.orgUnitId);
        if (params.recursive) q.set('recursive', 'true');
        if (params.domainId) q.set('domain_id', params.domainId);
        if (params.activityId) q.set('activity_id', params.activityId);
        if (params.documentCategoryId) q.set('document_category_id', params.documentCategoryId);
        if (params.tenantId) q.set('tenant_id', params.tenantId);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiCall<ReportsDocumentActivityResponse>(
            `/reports/document-activity${qs}`,
            {},
            "Récupération de l'activité documentaire impossible",
        );
    },
    getReportsWorkflowActivity: (params: {
        orgUnitId?: string;
        recursive?: boolean;
        domainId?: string;
        activityId?: string;
        documentCategoryId?: string;
        tenantId?: string;
    } = {}): Promise<ReportsWorkflowActivityResponse> => {
        const q = new URLSearchParams();
        if (params.orgUnitId) q.set('org_unit_id', params.orgUnitId);
        if (params.recursive) q.set('recursive', 'true');
        if (params.domainId) q.set('domain_id', params.domainId);
        if (params.activityId) q.set('activity_id', params.activityId);
        if (params.documentCategoryId) q.set('document_category_id', params.documentCategoryId);
        if (params.tenantId) q.set('tenant_id', params.tenantId);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiCall<ReportsWorkflowActivityResponse>(
            `/reports/workflow-activity${qs}`,
            {},
            "Récupération de l'activité des circuits impossible",
        );
    },
    getReportsServiceActivity: (params: {
        orgUnitId?: string;
        recursive?: boolean;
        domainId?: string;
        activityId?: string;
        documentCategoryId?: string;
        tenantId?: string;
    } = {}): Promise<ReportsServiceActivityResponse> => {
        const q = new URLSearchParams();
        if (params.orgUnitId) q.set('org_unit_id', params.orgUnitId);
        if (params.recursive) q.set('recursive', 'true');
        if (params.domainId) q.set('domain_id', params.domainId);
        if (params.activityId) q.set('activity_id', params.activityId);
        if (params.documentCategoryId) q.set('document_category_id', params.documentCategoryId);
        if (params.tenantId) q.set('tenant_id', params.tenantId);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiCall<ReportsServiceActivityResponse>(
            `/reports/service-activity${qs}`,
            {},
            "Récupération de l'activité des services impossible",
        );
    },
};
