// frontend/services/index.ts
//
// Façade agrégée — SEUL point d'import pour les consommateurs.
//
// Pattern : barrel export + re-agrégation dans un objet `api` identique à
// l'ancien api.ts. Les composants continuent d'écrire :
//
//   import { api } from '../services'        (ou '../services/api')
//   import { api } from '@/services'
//
// et ne bougent PAS.  Le wiring interne est ici, invisible aux consommateurs.
//
// ────────────────────────────────────────────────────────────────────────────
// Exports nommés (pour les imports directs par domaine si nécessaire)
// ────────────────────────────────────────────────────────────────────────────

export { authApi }             from './resources/auth.api';
export { documentsApi }        from './resources/documents.api';
export { workflowsApi }        from './resources/workflows.api';
export { orgUnitsApi }         from './resources/orgUnits.api';
export { usersApi }            from './resources/users.api';
export { tenantsApi }          from './resources/tenants.api';
export { gedrulesApi }         from './resources/gedrules.api';
export { classificationApi }   from './resources/classification.api';
export { importsApi }          from './resources/imports.api';
export { spacesApi }           from './resources/spaces.api';
export { notificationsApi }    from './resources/notifications.api';
export { authzApi }            from './resources/authz.api';
export { auditApi }            from './resources/audit.api';
export { analyticsApi }        from './resources/analytics.api';
export { reportsApi }          from './resources/reports.api';
export { searchApi }           from './resources/search.api';
export { healthApi }           from './resources/health.api';
export { usageApi }            from './resources/usage.api';

// Re-exports http/ pour les rares cas où un hook/composant a besoin du
// transport directement (ex: categories.api.ts, stores d'auth).
export { fetchWithRefresh, apiCall, apiCallVoid, requestJson, getHeaders } from './http/client';
export { clearAuthSession, persistAuthTokens, isAuthEndpoint }             from './http/session';
export { buildApiError }                                                    from './http/errorAdapter';

// ────────────────────────────────────────────────────────────────────────────
// Objet `api` agrégé — backwards-compat totale
// ────────────────────────────────────────────────────────────────────────────
// Les consommateurs existants appellent api.login(), api.getDocuments(), etc.
// sans aucun changement.

import { authApi }           from './resources/auth.api';
import { documentsApi }      from './resources/documents.api';
import { workflowsApi }      from './resources/workflows.api';
import { orgUnitsApi }       from './resources/orgUnits.api';
import { usersApi }          from './resources/users.api';
import { tenantsApi }        from './resources/tenants.api';
import { gedrulesApi }       from './resources/gedrules.api';
import { classificationApi } from './resources/classification.api';
import { importsApi }        from './resources/imports.api';
import { spacesApi }         from './resources/spaces.api';
import { notificationsApi }  from './resources/notifications.api';
import { authzApi }          from './resources/authz.api';
import { auditApi }          from './resources/audit.api';
import { analyticsApi }      from './resources/analytics.api';
import { reportsApi }        from './resources/reports.api';
import { searchApi }         from './resources/search.api';
import { healthApi }         from './resources/health.api';
import { usageApi }          from './resources/usage.api';

export const api = {
    // Auth
    login:          authApi.login,
    verifyOTP:      authApi.verifyOTP,
    logout:         authApi.logout,
    changePassword: authApi.changePassword,

    // Documents
    uploadDocument:              documentsApi.uploadDocument,
    getDocuments:                documentsApi.getDocuments,
    getDocument:                 documentsApi.getDocument,
    getDocumentContentBlob:      documentsApi.getDocumentContentBlob,
    updateDocument:              documentsApi.updateDocument,
    deleteDocument:              documentsApi.deleteDocument,
    getDocumentVersions:         documentsApi.getDocumentVersions,
    getDocumentStats:            documentsApi.getDocumentStats,
    getWorkspaceDocuments:       documentsApi.getWorkspaceDocuments,
    getNeedsReviewDocuments:     documentsApi.getNeedsReviewDocuments,
    getClassificationReviews:    documentsApi.getClassificationReviews,
    resolveReview:               documentsApi.resolveReview,
    resolveClassificationReview: documentsApi.resolveClassificationReview,
    getDocumentAuditLogs:        documentsApi.getDocumentAuditLogs,
    ingestDirectory:             documentsApi.ingestDirectory,
    startDocumentWorkflow:       documentsApi.startDocumentWorkflow,

    // Imports
    analyzeImportJob:    importsApi.analyzeImportJob,
    commitImportJob:     importsApi.commitImportJob,
    getImportJob:        importsApi.getImportJob,
    getImportJobItems:   importsApi.getImportJobItems,

    // Workflows
    createWorkflowSteps:  workflowsApi.createWorkflowSteps,
    getWorkflowSteps:     workflowsApi.getWorkflowSteps,
    getWorkflowActions:   workflowsApi.getWorkflowActions,
    getPendingWorkflows:  workflowsApi.getPendingWorkflows,
    getPendingAssignments: workflowsApi.getPendingAssignments,
    validateWorkflowStep: workflowsApi.validateWorkflowStep,
    submitWorkflowAction: workflowsApi.submitWorkflowAction,
    assignPendingStep:    workflowsApi.assignPendingStep,
    getWorkflowStats:     workflowsApi.getWorkflowStats,

    // Org Units
    getOrgUnitsTree:          orgUnitsApi.getOrgUnitsTree,
    getOrgUnitsTreeForTenant: orgUnitsApi.getOrgUnitsTreeForTenant,
    getOrgUnits:              orgUnitsApi.getOrgUnits,
    getOrgUnitTypes:          orgUnitsApi.getOrgUnitTypes,
    getOrgUnitsForTenant:     orgUnitsApi.getOrgUnitsForTenant,
    createOrgUnit:            orgUnitsApi.createOrgUnit,
    updateOrgUnit:            orgUnitsApi.updateOrgUnit,
    deleteOrgUnit:            orgUnitsApi.deleteOrgUnit,

    // Users
    getUsers:           usersApi.getUsers,
    getPlatformUsers:   usersApi.getPlatformUsers,
    createUser:         usersApi.createUser,
    updateUser:         usersApi.updateUser,
    deleteUser:         usersApi.deleteUser,
    getAssignableRoles: usersApi.getAssignableRoles,
    resetUserPassword:  usersApi.resetUserPassword,
    toggleUserActive:   usersApi.toggleUserActive,
    disableUserMfa:     usersApi.disableUserMfa,

    // Tenants
    getPublicTenants: tenantsApi.getPublicTenants,
    getTenants:       tenantsApi.getTenants,
    getTenant:        tenantsApi.getTenant,
    createTenant:     tenantsApi.createTenant,
    updateTenant:     tenantsApi.updateTenant,

    // GEDRules
    getTemplates:       gedrulesApi.getTemplates,
    createTemplate:     gedrulesApi.createTemplate,
    updateTemplate:     gedrulesApi.updateTemplate,
    deleteTemplate:     gedrulesApi.deleteTemplate,
    getRoutingRules:    gedrulesApi.getRoutingRules,
    createRoutingRule:  gedrulesApi.createRoutingRule,
    updateRoutingRule:  gedrulesApi.updateRoutingRule,
    deleteRoutingRule:  gedrulesApi.deleteRoutingRule,
    simulateRouting:    gedrulesApi.simulateRouting,

    // Classification
    getClassificationDomains:        classificationApi.getClassificationDomains,
    createClassificationDomain:      classificationApi.createClassificationDomain,
    updateClassificationDomain:      classificationApi.updateClassificationDomain,
    deleteClassificationDomain:      classificationApi.deleteClassificationDomain,
    getClassificationActivities:     classificationApi.getClassificationActivities,
    createClassificationActivity:    classificationApi.createClassificationActivity,
    updateClassificationActivity:    classificationApi.updateClassificationActivity,
    deleteClassificationActivity:    classificationApi.deleteClassificationActivity,
    getClassificationRules:          classificationApi.getClassificationRules,
    getClassificationRule:           classificationApi.getClassificationRule,
    createClassificationRule:        classificationApi.createClassificationRule,
    updateClassificationRule:        classificationApi.updateClassificationRule,
    deleteClassificationRule:        classificationApi.deleteClassificationRule,
    simulateClassification:          classificationApi.simulateClassification,

    // Spaces
    getSpacesTree:     spacesApi.getSpacesTree,
    getSpaceDocuments: spacesApi.getSpaceDocuments,

    // Notifications
    getNotifications:            notificationsApi.getNotifications,
    markNotificationAsRead:      notificationsApi.markNotificationAsRead,
    markAllNotificationsAsRead:  notificationsApi.markAllNotificationsAsRead,

    // AuthZ
    getAuthzPolicies:    authzApi.getAuthzPolicies,
    addAuthzPolicy:      authzApi.addAuthzPolicy,
    deleteAuthzPolicy:   authzApi.deleteAuthzPolicy,
    getAuthzRoles:       authzApi.getAuthzRoles,
    getAuthzMetrics:     authzApi.getAuthzMetrics,
    getAuthzTopDenies:   authzApi.getAuthzTopDenies,
    resetAuthzMetrics:   authzApi.resetAuthzMetrics,
    getAuthzHealth:      authzApi.getAuthzHealth,

    // Audit
    getAuditLogs: auditApi.getAuditLogs,

    // Analytics
    getTenantAnalytics:   analyticsApi.getTenantAnalytics,
    getPlatformAnalytics: analyticsApi.getPlatformAnalytics,

    // Reports
    getReportsEvolution:  reportsApi.getReportsEvolution,
    getReportsDocumentActivity: reportsApi.getReportsDocumentActivity,
    getReportsWorkflowActivity: reportsApi.getReportsWorkflowActivity,
    getReportsServiceActivity: reportsApi.getReportsServiceActivity,

    // Search
    searchDocuments: searchApi.searchDocuments,

    // Health
    getHealth: healthApi.getHealth,

    // Usage telemetry
    recordLocalOrganize: usageApi.recordLocalOrganize,
    getLocalArrangementSnapshot: usageApi.getLocalArrangementSnapshot,
    putLocalArrangementSnapshot: usageApi.putLocalArrangementSnapshot,
    deleteLocalArrangementSnapshot: usageApi.deleteLocalArrangementSnapshot,
} as const;
