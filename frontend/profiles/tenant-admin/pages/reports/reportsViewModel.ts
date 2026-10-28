import type { ClassificationReview, TenantMetrics } from '../../../../types';
import type {
  ReportsDocumentActivityResponse,
  ReportsServiceActivityResponse,
  ReportsWorkflowActivityResponse,
} from '../../../../services/resources/reports.api';

export type ReportsViewMode = 'synthese' | 'documents' | 'workflows' | 'services';

export interface ReportsKpiItem {
  id: string;
  label: string;
  value: string;
  helper: string;
  shortHelper?: string;
  tone: 'neutral' | 'good' | 'warn' | 'info';
  estimated?: boolean;
}

export interface ReportsInsightItem {
  id: string;
  title: string;
  value: string;
  helper: string;
  tone: 'neutral' | 'good' | 'warn';
  actionLabel?: string;
  actionHref?: string;
}

export interface ReportsTableRow {
  id: string;
  family: string;
  indicator: string;
  value: number | string;
  detail: string;
  status: 'stable' | 'attention' | 'positive' | 'info';
  actionHint: string;
  /** Route interne vers le module d'action, si applicable. */
  actionHref?: string;
}

// --- Synthèse opérationnelle (Eckerson : Monitor → Analyze → Act) -------

/**
 * Niveau 1 — état général de la journée, scannable en < 2 secondes.
 * Cf. Stephen Few : « single screen, glanceable status ».
 */
export interface ReportsSummaryStatus {
  level: 'good' | 'warn' | 'bad';
  headline: string;
  /** Petits chiffres de contexte affichés à côté du headline. */
  signals: Array<{ label: string; value: string; tone: 'warn' | 'bad' | 'neutral' }>;
}

/**
 * Niveau 3 — items qui méritent une action concrète aujourd'hui, avec
 * lien direct vers la page qui permet de traiter (Eckerson : « Act »).
 */
export interface ReportsPriorityAction {
  id: string;
  count: number;
  label: string;
  helper: string;
  href: string;
  tone: 'warn' | 'bad' | 'info';
}

export interface ReportsViewModel {
  kpis: ReportsKpiItem[];
  documentKpis: ReportsKpiItem[];
  workflowKpis: ReportsKpiItem[];
  serviceKpis: ReportsKpiItem[];
  insights: ReportsInsightItem[];
  rowsByMode: Record<ReportsViewMode, ReportsTableRow[]>;
  summaryStatus: ReportsSummaryStatus;
  summaryActions: ReportsPriorityAction[];
}

const classifyReviewCounts = (reviews: ClassificationReview[]) => {
  const openReviews = reviews.filter((review) => review.review_status === 'open');
  return {
    open: openReviews.length,
    importSource: openReviews.filter((review) => review.review_source === 'import_job_item').length,
    documentSource: openReviews.filter((review) => review.review_source === 'document').length,
  };
};

const toneFromRatio = (value: number, warningFrom: number): ReportsKpiItem['tone'] =>
  value >= warningFrom ? 'warn' : value > 0 ? 'info' : 'good';

export function buildReportsViewModel(params: {
  tenantMetrics: TenantMetrics | null;
  documentStats: any | null;
  workflowStats: any | null;
  documentActivity: ReportsDocumentActivityResponse | null;
  workflowActivity: ReportsWorkflowActivityResponse | null;
  serviceActivity: ReportsServiceActivityResponse | null;
  classificationReviews: ClassificationReview[];
}): ReportsViewModel {
  const {
    tenantMetrics,
    documentStats,
    workflowStats,
    documentActivity,
    workflowActivity,
    serviceActivity,
    classificationReviews,
  } = params;

  const docsTotal = tenantMetrics?.documents?.total ?? documentStats?.total ?? 0;
  const storageMb = tenantMetrics?.documents?.storage_used_mb ?? 0;
  const storageQuotaMb = tenantMetrics?.documents?.storage_quota_mb ?? 0;
  const byStatus = documentStats?.by_status ?? {};
  const workflowPending = workflowStats?.active_workflow_steps ?? tenantMetrics?.workflows?.pending ?? 0;
  const workflowCompleted = workflowStats?.completed_workflow_steps ?? tenantMetrics?.workflows?.completed ?? 0;
  const workflowRejected = tenantMetrics?.workflows?.rejected ?? 0;
  const workflowActiveSteps = workflowActivity?.active_steps ?? workflowPending;
  const workflowCompletedSteps = workflowActivity?.completed_steps ?? workflowCompleted;
  const workflowRejectedSteps = workflowActivity?.rejected_steps ?? workflowRejected;
  const workflowOpenCases = workflowActivity?.open_workflows ?? workflowPending;
  const workflowBlockedEstimated = workflowActivity?.blocked_workflows_estimated ?? 0;
  const slowestWorkflowStep = workflowActivity?.slowest_steps?.[0] ?? null;
  const slowestWorkflowOrgUnit = workflowActivity?.delay_by_org_unit?.[0] ?? null;
  const servicesTracked = serviceActivity?.total_services ?? 0;
  const overloadedServices = serviceActivity?.overloaded_services ?? 0;
  const servicesWithReviews = serviceActivity?.services_with_reviews ?? 0;
  const servicesDocumentsInProgress = (serviceActivity?.services ?? []).reduce(
    (sum, service) => sum + service.documents_in_progress,
    0,
  );
  const servicesEstimatedDelays = (serviceActivity?.services ?? []).reduce(
    (sum, service) => sum + service.estimated_delays,
    0,
  );

  const reviewCounts = classifyReviewCounts(classificationReviews);
  const autoClassified = Number(byStatus.archived ?? 0) + Number(byStatus.signed ?? 0) + Number(byStatus.validated ?? 0);
  const autoRate = docsTotal > 0 ? Math.round((autoClassified / docsTotal) * 100) : 0;
  const processedDocs = Number(byStatus.validated ?? 0)
    + Number(byStatus.signed ?? 0)
    + Number(byStatus.archived ?? 0)
    + Number(byStatus.rejected ?? 0);
  const documentsInProgress = Math.max(
    0,
    Number(byStatus.draft ?? 0)
      + Number(byStatus.in_review ?? 0)
      + Number(byStatus.returned ?? 0),
  );
  const processingRate = docsTotal > 0 ? Math.round((processedDocs / docsTotal) * 100) : 0;
  const estimatedDelayPressure = reviewCounts.open + workflowPending;
  const mainBlockage = reviewCounts.open > 0
    ? 'Décisions manuelles en attente'
    : workflowPending > 0
      ? 'Circuits encore ouverts'
      : 'Aucun blocage majeur visible';
  const leadingOrgUnit = documentActivity?.by_org_unit?.[0] ?? null;
  const documentsToReview = documentActivity?.signals.documents_needing_review ?? reviewCounts.documentSource;
  const importsToReview = documentActivity?.signals.imports_needing_review ?? reviewCounts.importSource;
  const unclassifiedDocuments = documentActivity?.signals.unclassified_documents ?? 0;
  const documentsMissingInformation = documentActivity?.signals.documents_missing_information ?? 0;
  const documentKpis: ReportsKpiItem[] = [
    {
      id: 'documents-active',
      label: 'Documents actifs',
      value: String(documentActivity?.total_active_documents ?? docsTotal),
      helper: 'Documents encore présents hors corbeille dans l’institution.',
      shortHelper: 'Présents dans l’institution',
      tone: 'neutral',
    },
    {
      id: 'documents-validated',
      label: 'Validés ou signés',
      value: String(documentActivity?.validated_documents ?? (Number(byStatus.validated ?? 0) + Number(byStatus.signed ?? 0))),
      helper: 'Documents déjà passés dans une validation visible.',
      shortHelper: 'Décision déjà visible',
      tone: 'good',
    },
    {
      id: 'documents-archived',
      label: 'Archivés',
      value: String(documentActivity?.archived_documents ?? Number(byStatus.archived ?? 0)),
      helper: 'Documents déjà rangés dans un état d’archivage.',
      shortHelper: 'Déjà archivés',
      tone: (documentActivity?.archived_documents ?? Number(byStatus.archived ?? 0)) > 0 ? 'info' : 'neutral',
    },
    {
      id: 'documents-to-review',
      label: 'Documents à revoir',
      value: String(documentsToReview),
      helper: 'Documents qui demandent encore une reprise ou une décision manuelle.',
      shortHelper: 'Reprise ou décision attendue',
      tone: documentsToReview > 0 ? 'warn' : 'good',
    },
  ];

  const workflowKpis: ReportsKpiItem[] = [
    {
      id: 'workflow-open',
      label: 'Documents en traitement',
      value: String(workflowOpenCases),
      helper: 'Documents ayant encore une validation, une signature ou une affectation ouverte.',
      shortHelper: 'Traitement non terminé',
      tone: workflowOpenCases > 0 ? 'info' : 'good',
    },
    {
      id: 'workflow-active-steps',
      label: 'Actions en attente',
      value: String(workflowActiveSteps),
      helper: 'Validations, signatures ou affectations encore attendues sur les documents.',
      shortHelper: 'Validation, signature ou affectation',
      tone: workflowActiveSteps > 0 ? 'info' : 'good',
    },
    {
      id: 'workflow-blocked-estimated',
      label: 'Documents sans avancée',
      value: String(workflowBlockedEstimated),
      helper: 'Estimation des documents sans avancée visible depuis plus de cinq jours.',
      shortHelper: 'Plus de cinq jours sans avancée',
      tone: workflowBlockedEstimated > 0 ? 'warn' : 'good',
      estimated: true,
    },
    {
      id: 'workflow-rejected',
      label: 'Documents refusés ou retournés',
      value: String(workflowRejectedSteps),
      helper: 'Documents revenus pour correction, refusés ou annulés pendant le traitement.',
      shortHelper: 'Correction, refus ou annulation',
      tone: workflowRejectedSteps > 0 ? 'warn' : 'good',
    },
  ];

  const serviceKpis: ReportsKpiItem[] = [
    {
      id: 'services-tracked',
      label: 'Services suivis',
      value: String(servicesTracked),
      helper: 'Unités visibles dans cette lecture avec au moins une activité documentaire ou de circuit.',
      shortHelper: 'Avec activité visible',
      tone: servicesTracked > 0 ? 'neutral' : 'info',
    },
    {
      id: 'services-documents-in-progress',
      label: 'Documents en cours',
      value: String(servicesDocumentsInProgress),
      helper: 'Documents encore en traitement dans les services visibles.',
      shortHelper: 'Traitement encore en cours',
      tone: servicesDocumentsInProgress > 0 ? 'info' : 'good',
    },
    {
      id: 'services-reviews',
      label: 'Services à revoir',
      value: String(servicesWithReviews),
      helper: 'Unités où des documents demandent encore une reprise manuelle.',
      shortHelper: 'Reprise manuelle attendue',
      tone: servicesWithReviews > 0 ? 'warn' : 'good',
    },
    {
      id: 'services-overloaded',
      label: 'Retards estimés',
      value: String(servicesEstimatedDelays),
      helper: 'Documents sans avancée visible ou en attente prolongée dans les services suivis.',
      shortHelper: 'Retards visibles par service',
      tone: overloadedServices > 0 || servicesEstimatedDelays > 0 ? 'warn' : 'good',
      estimated: true,
    },
  ];

  const kpis: ReportsKpiItem[] = [
    {
      id: 'documents_total',
      label: 'Documents suivis',
      value: String(docsTotal),
      helper: 'Documents actuellement suivis par l’institution hors corbeille.',
      shortHelper: 'Suivis par l’institution',
      tone: 'neutral',
    },
    {
      id: 'documents_in_progress',
      label: 'Documents en cours',
      value: String(documentsInProgress),
      helper: 'Documents encore en brouillon, en revue ou revenus pour correction.',
      shortHelper: 'Brouillon, revue ou correction',
      tone: documentsInProgress > 0 ? 'info' : 'good',
    },
    {
      id: 'documents_processed',
      label: 'Documents traités',
      value: String(processedDocs),
      helper: 'Documents ayant déjà abouti à une décision visible dans la GED.',
      shortHelper: 'Décision déjà visible',
      tone: processedDocs > 0 ? 'good' : 'neutral',
    },
    {
      id: 'estimated_delay_pressure',
      label: 'Retards estimés',
      value: String(estimatedDelayPressure),
      helper: 'Estimation fondée sur les reprises manuelles et les circuits encore ouverts.',
      shortHelper: 'Reprises et circuits ouverts',
      tone: toneFromRatio(estimatedDelayPressure, 1),
      estimated: true,
    },
    {
      id: 'processing_rate',
      label: 'Taux de traitement',
      value: `${processingRate}%`,
      helper: 'Part des documents déjà passés dans un état final visible.',
      shortHelper: 'Part déjà finalisée',
      tone: processingRate >= 70 ? 'good' : processingRate >= 40 ? 'info' : 'warn',
    },
  ];

  const insights: ReportsInsightItem[] = [
    {
      id: 'critical-alert',
      title: 'Alerte importante',
      value: `${reviewCounts.open}`,
      helper: reviewCounts.open > 0
        ? `${reviewCounts.importSource} import(s) et ${reviewCounts.documentSource} document(s) demandent encore une décision.`
        : 'Aucune décision manuelle en attente pour le moment.',
      tone: reviewCounts.open > 0 ? 'warn' : 'good',
      actionLabel: reviewCounts.open > 0 ? 'Ouvrir la reprise' : undefined,
      actionHref: reviewCounts.open > 0 ? '/classification-reviews' : undefined,
    },
    {
      id: 'main-blockage',
      title: 'Blocage principal',
      value: mainBlockage,
      helper: workflowPending > 0
        ? `${workflowPending} étape(s) de circuit restent encore ouvertes.`
        : 'Aucun blocage de circuit n’apparaît dans les statistiques actuelles.',
      tone: workflowPending > 0 ? 'warn' : 'good',
    },
    {
      id: 'sensitive-signal',
      title: 'Signal utile',
      value: workflowRejected > 0 ? `${workflowRejected} rejet(s)` : `${storageMb} MB`,
      helper: workflowRejected > 0
        ? 'Des rejets sont remontés et méritent une vérification dans les circuits.'
        : storageQuotaMb > 0
          ? `Stockage occupé sur une référence de ${storageQuotaMb} MB.`
          : 'Aucun rejet n’apparaît et la capacité de référence n’est pas encore disponible.',
      tone: workflowRejected > 0 ? 'warn' : 'neutral',
    },
  ];

  const syntheseRows: ReportsTableRow[] = [
    {
      id: 'syn-docs-total',
      family: 'Documents',
      indicator: 'Documents suivis',
      value: docsTotal,
      detail: 'Total des documents encore présents hors corbeille.',
      status: 'stable',
      actionHint: 'Comparer ce volume avec les imports et dépôts récents.',
    },
    {
      id: 'syn-in-progress',
      family: 'Documents',
      indicator: 'Documents en cours',
      value: documentsInProgress,
      detail: 'Documents encore en brouillon, en revue ou revenus pour correction.',
      status: documentsInProgress > 0 ? 'info' : 'stable',
      actionHint: 'Vérifier si les reprises s’accumulent dans certains services.',
    },
    {
      id: 'syn-processed',
      family: 'Documents',
      indicator: 'Documents traités',
      value: processedDocs,
      detail: 'Documents ayant déjà abouti à une décision visible dans la GED.',
      status: processedDocs > 0 ? 'positive' : 'stable',
      actionHint: 'Suivre l’évolution du rythme de traitement.',
    },
    {
      id: 'syn-estimated-delays',
      family: 'Retards',
      indicator: 'Retards estimés',
      value: estimatedDelayPressure,
      detail: 'Estimation fondée sur les reprises manuelles et les circuits encore ouverts.',
      status: estimatedDelayPressure > 0 ? 'attention' : 'stable',
      actionHint: 'Confirmer les vrais retards avec les vues de circuits et de reprise.',
    },
    {
      id: 'syn-processing-rate',
      family: 'Traitement',
      indicator: 'Taux de traitement',
      value: `${processingRate}%`,
      detail: 'Part des documents déjà passés dans un état final visible.',
      status: processingRate >= 70 ? 'positive' : processingRate >= 40 ? 'info' : 'attention',
      actionHint: 'Comparer ce taux avec les volumes entrants et les blocages.',
    },
    {
      id: 'syn-workflows-done',
      family: 'Circuits',
      indicator: 'Circuits terminés',
      value: workflowCompleted,
      detail: 'Étapes de validation déjà bouclées.',
      status: 'positive',
      actionHint: 'Utiliser ce volume pour suivre le rythme de traitement.',
    },
  ];

  const documentsRows: ReportsTableRow[] = [
    {
      id: 'doc-total',
      family: 'Volumes',
      indicator: 'Documents actifs',
      value: documentActivity?.total_active_documents ?? docsTotal,
      detail: 'Documents disponibles hors corbeille.',
      status: 'stable',
      actionHint: 'Comparer ce volume avec les créations observées sur la période.',
    },
    {
      id: 'doc-validated',
      family: 'Statuts',
      indicator: 'Validés ou signés',
      value: documentActivity?.validated_documents ?? (Number(byStatus.validated ?? 0) + Number(byStatus.signed ?? 0)),
      detail: 'Documents déjà passés par une validation visible.',
      status: 'positive',
      actionHint: 'Comparer ce volume avec les documents encore en traitement.',
    },
    {
      id: 'doc-archived',
      family: 'Statuts',
      indicator: 'Archivés',
      value: documentActivity?.archived_documents ?? Number(byStatus.archived ?? 0),
      detail: 'Documents déjà rangés dans un état d’archivage.',
      status: 'info',
      actionHint: 'Suivre la part des documents qui sortent du circuit actif.',
    },
    {
      id: 'doc-leading-service',
      family: 'Services',
      indicator: 'Service le plus présent',
      value: leadingOrgUnit?.label ?? 'Aucun',
      detail: leadingOrgUnit ? `${leadingOrgUnit.value} document(s) visibles dans cette unité.` : 'Aucune lecture légère par service n’est encore disponible.',
      status: leadingOrgUnit ? 'stable' : 'info',
      actionHint: 'Utiliser l’onglet Services pour la charge et les retards détaillés.',
    },
    {
      id: 'doc-reviews-total',
      family: 'Points de vigilance',
      indicator: 'Documents à revoir',
      value: documentsToReview,
      detail: 'Documents déjà créés qui attendent encore une décision manuelle.',
      status: documentsToReview > 0 ? 'attention' : 'positive',
      actionHint: documentsToReview > 0 ? 'Ouvrir la bannette de reprise' : 'Aucune reprise en attente.',
      actionHref: documentsToReview > 0 ? '/classification-reviews' : undefined,
    },
    {
      id: 'doc-unclassified',
      family: 'Points de vigilance',
      indicator: 'Documents non classés',
      value: unclassifiedDocuments,
      detail: 'Documents encore en attente de classement ou revenus en reprise.',
      status: unclassifiedDocuments > 0 ? 'attention' : 'stable',
      actionHint: unclassifiedDocuments > 0 ? 'Revoir les règles de classement' : 'Tous les documents sont classés.',
      actionHref: unclassifiedDocuments > 0 ? '/classement' : undefined,
    },
    {
      id: 'doc-missing-info',
      family: 'Points de vigilance',
      indicator: 'Informations manquantes',
      value: documentsMissingInformation,
      detail: 'Documents sans catégorie ou sans éléments de classement encore complets.',
      status: documentsMissingInformation > 0 ? 'info' : 'stable',
      actionHint: documentsMissingInformation > 0 ? 'Revoir les règles de classement' : 'Aucune information manquante.',
      actionHref: documentsMissingInformation > 0 ? '/classement' : undefined,
    },
    {
      id: 'doc-imports-review',
      family: 'Points de vigilance',
      indicator: 'Imports à vérifier',
      value: importsToReview,
      detail: 'Lots importés qui attendent encore une reprise dans la bannette.',
      status: importsToReview > 0 ? 'attention' : 'stable',
      actionHint: importsToReview > 0 ? 'Ouvrir Import en masse' : 'Aucun import en attente.',
      actionHref: importsToReview > 0 ? '/ingestion' : undefined,
    },
    {
      id: 'doc-storage',
      family: 'Capacité',
      indicator: 'Stockage occupé',
      value: `${storageMb} MB`,
      detail: storageQuotaMb > 0 ? `Capacité de référence : ${storageQuotaMb} MB.` : 'Capacité non disponible pour le moment.',
      status: storageQuotaMb > 0 && storageMb / storageQuotaMb >= 0.8 ? 'attention' : 'info',
      actionHint: 'Garder ce signal comme lecture d’ambiance, pas comme indicateur principal.',
    },
    {
      id: 'doc-auto',
      family: 'Classement',
      indicator: 'Part classée automatiquement',
      value: `${autoRate}%`,
      detail: 'Calcul fondé sur les documents déjà traités.',
      status: autoRate >= 70 ? 'positive' : autoRate >= 40 ? 'info' : 'attention',
      actionHint: 'Suivre l’effet des règles sans en faire une lecture service.',
    },
  ];

  const workflowRows: ReportsTableRow[] = [
    {
      id: 'wf-active',
      family: 'Travail en cours',
      indicator: 'Actions en attente',
      value: workflowActiveSteps,
      detail: 'Validations, signatures ou affectations encore attendues sur les documents.',
      status: workflowActiveSteps > 0 ? 'info' : 'stable',
      actionHint: 'Suivre les validations, signatures et affectations encore ouvertes.',
    },
    {
      id: 'wf-open',
      family: 'Travail en cours',
      indicator: 'Documents en traitement',
      value: workflowOpenCases,
      detail: 'Documents qui ont encore une validation, une signature ou une affectation ouverte.',
      status: workflowOpenCases > 0 ? 'info' : 'stable',
      actionHint: 'Identifier les documents qui n’avancent pas avant la fin du traitement.',
    },
    {
      id: 'wf-completed',
      family: 'Traitement',
      indicator: 'Étapes terminées',
      value: workflowCompletedSteps,
      detail: 'Historique des étapes déjà clôturées dans les circuits.',
      status: 'positive',
      actionHint: 'Mesurer la fluidité du traitement sur la période.',
    },
    {
      id: 'wf-rejected',
      family: 'Alertes',
      indicator: 'Documents refusés ou retournés',
      value: workflowRejectedSteps,
      detail: 'Documents revenus pour correction, refusés ou annulés pendant le traitement.',
      status: workflowRejectedSteps > 0 ? 'attention' : 'stable',
      actionHint: workflowRejectedSteps > 0 ? 'Voir les documents concernés' : 'Aucun refus ni retour sur la période.',
      actionHref: workflowRejectedSteps > 0 ? '/tasks' : undefined,
    },
    {
      id: 'wf-blocked-estimated',
      family: 'Blocages',
      indicator: 'Documents sans avancée',
      value: workflowBlockedEstimated,
      detail: 'Documents sans avancée visible depuis plus de cinq jours, à confirmer métier si nécessaire.',
      status: workflowBlockedEstimated > 0 ? 'attention' : 'stable',
      actionHint: workflowBlockedEstimated > 0 ? 'Voir les documents concernés' : 'Aucun blocage détecté.',
      actionHref: workflowBlockedEstimated > 0 ? '/tasks' : undefined,
    },
    {
      id: 'wf-slowest-step',
      family: 'Délais',
      indicator: 'Étape la plus lente',
      value: slowestWorkflowStep ? `${slowestWorkflowStep.average_days} j` : '—',
      detail: slowestWorkflowStep
        ? `${slowestWorkflowStep.label} sur ${slowestWorkflowStep.steps_count} étape(s) terminée(s).`
        : 'Aucun délai moyen par étape n’est encore disponible.',
      status: slowestWorkflowStep && slowestWorkflowStep.average_days >= 5 ? 'attention' : 'info',
      actionHint: 'Utiliser ce signal pour cibler les étapes qui rallongent le traitement.',
    },
    {
      id: 'wf-slowest-service',
      family: 'Délais',
      indicator: 'Service le plus lent',
      value: slowestWorkflowOrgUnit ? `${slowestWorkflowOrgUnit.average_days} j` : '—',
      detail: slowestWorkflowOrgUnit
        ? `${slowestWorkflowOrgUnit.label} sur ${slowestWorkflowOrgUnit.steps_count} étape(s) terminée(s).`
        : 'Aucun délai moyen par service n’est encore disponible.',
      status: slowestWorkflowOrgUnit && slowestWorkflowOrgUnit.average_days >= 5 ? 'attention' : 'info',
      actionHint: 'Comparer ce signal avec l’onglet Services dès que les agrégats unitaires seront complets.',
    },
  ];

  const servicesRows: ReportsTableRow[] = (serviceActivity?.services ?? []).map((service) => ({
    id: `svc-${service.id}`,
    family: 'Services',
    indicator: service.label,
    value: `${service.documents_in_progress} en cours`,
    detail: [
      `${service.documents_total} document(s)`,
      `${service.documents_needing_review} à revoir`,
      `${service.open_workflows} circuit(s) ouvert(s)`,
      `${service.average_workflow_days} j de délai moyen`,
    ].join(' · '),
    status: service.estimated_delays > 0
      ? 'attention'
      : service.documents_in_progress > 0 || service.documents_needing_review > 0
        ? 'info'
        : 'positive',
    actionHint: service.estimated_delays > 0
      ? `${service.estimated_delays} retard(s) estimé(s) · ${service.active_users} agent(s) actif(s), ${service.inactive_users} peu actif(s).`
      : `${service.active_users} agent(s) actif(s) récent(s), ${service.inactive_users} sans activité récente.`,
  }));

  // --- Status + Actions (Synthèse opérationnelle) -----------------------
  // Seuils choisis pour rester sobres (Few : couleur réservée à l'alerte).
  // Rouge = vraie alerte, ambre = vigilance, vert = rien à faire.
  const reviewsOpen = reviewCounts.open;
  const blockedCount = workflowBlockedEstimated;
  const importsToRedo = importsToReview;
  const documentsToRedo = documentsToReview;
  const isBad = blockedCount >= 1 || reviewsOpen >= 10;
  const isWarn = !isBad && (reviewsOpen > 0 || blockedCount > 0 || importsToRedo > 0 || documentsToRedo > 0);

  const summaryStatus: ReportsSummaryStatus = {
    level: isBad ? 'bad' : isWarn ? 'warn' : 'good',
    headline: isBad
      ? 'Action requise aujourd’hui'
      : isWarn
        ? 'Vigilance — quelques décisions en attente'
        : 'Situation maîtrisée — rien à arbitrer',
    signals: [
      reviewsOpen > 0
        ? { label: 'Décisions en attente', value: String(reviewsOpen), tone: 'bad' as const }
        : null,
      blockedCount > 0
        ? { label: 'Circuits bloqués > 5 j', value: String(blockedCount), tone: 'bad' as const }
        : null,
      importsToRedo > 0
        ? { label: 'Imports à reprendre', value: String(importsToRedo), tone: 'warn' as const }
        : null,
    ].filter((value): value is { label: string; value: string; tone: 'warn' | 'bad' } => value !== null),
  };

  const summaryActions: ReportsPriorityAction[] = [];
  if (reviewsOpen > 0) {
    summaryActions.push({
      id: 'reviews',
      count: reviewsOpen,
      label: reviewsOpen === 1 ? 'décision de classement à prendre' : 'décisions de classement à prendre',
      helper:
        reviewCounts.importSource > 0 && reviewCounts.documentSource > 0
          ? `${reviewCounts.importSource} import(s) et ${reviewCounts.documentSource} document(s) attendent une décision.`
          : reviewCounts.importSource > 0
            ? `${reviewCounts.importSource} import(s) attendent une décision.`
            : `${reviewCounts.documentSource} document(s) attendent une décision.`,
      href: '/classification-reviews',
      tone: 'bad',
    });
  }
  if (blockedCount > 0) {
    summaryActions.push({
      id: 'blocked',
      count: blockedCount,
      label: blockedCount === 1 ? 'circuit bloqué depuis plus de 5 jours' : 'circuits bloqués depuis plus de 5 jours',
      helper: 'Étapes ouvertes anormalement longues — vérifier les responsables et relancer si besoin.',
      href: '/tasks',
      tone: 'bad',
    });
  }
  if (documentsToRedo > 0 && reviewsOpen === 0) {
    // On n'affiche cette ligne que si elle n'est pas déjà couverte par
    // les décisions de classement (qui contiennent ces documents).
    summaryActions.push({
      id: 'documents-to-redo',
      count: documentsToRedo,
      label: documentsToRedo === 1 ? 'document à compléter' : 'documents à compléter',
      helper: 'Documents revenus en reprise ou avec des informations manquantes.',
      href: '/documents',
      tone: 'warn',
    });
  }

  return {
    kpis,
    documentKpis,
    workflowKpis,
    serviceKpis,
    insights,
    rowsByMode: {
      synthese: syntheseRows,
      documents: documentsRows,
      workflows: workflowRows,
      services: servicesRows,
    },
    summaryStatus,
    summaryActions,
  };
}
