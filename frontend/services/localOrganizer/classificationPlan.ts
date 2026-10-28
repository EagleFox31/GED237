/**
 * Plan institutionnel (piliers 01–06) et groupes de synonymes métier → dossiers officiels.
 * Le scoring et la fusion phrases/tokens sont dans `officialMatching.ts`.
 */

export type OfficialTarget = Readonly<{ domain: string; folder: string }>;

export type BusinessSynonymGroup = Readonly<{
  target: OfficialTarget;
  tokens: readonly string[];
  phrases?: readonly string[];
}>;

export const OFFICIAL_CLASSIFICATION_PLAN: Record<string, readonly string[]> = {
  '01_Administration_Generale': [
    'Courriers',
    'Notes',
    'Conventions',
    'Reunions_et_instances',
    'Proces_verbaux',
    'Archives_et_conservation',
    'Pilotage_et_strategie',
  ],

  '02_Finances_Comptabilite': [
    'Factures',
    'Budgets',
    'Ordres_de_virement',
    'Etats_financiers',
    'Fiscalite',
    'Tresorerie',
    'Achats_et_commandes',
    'Rapprochements_bancaires',
    'Engagements_et_marches',
    'Immobilisations_et_actifs',
  ],

  '03_Ressources_Humaines': [
    'Contrats',
    'Attestations',
    'Nominations',
    'Fiches_de_paie',
    'Documents_personnels',
    'Formation',
  ],

  '04_Projets_et_Marches': [
    'Cahiers_des_charges',
    'Specifications_techniques',
    'Jalons_et_livrables',
    'Suivi_et_reporting',
    'Risques_et_changements',
    'Recettes_et_tests',
    'Presentations',
  ],

  '05_Systemes_Information': [
    'Incidents_et_exploitation',
    'Sauvegardes',
    'Inventaires_IT',
    'Licences_et_abonnements',
    'Configurations',
    'Releases_et_changements',
    'Runbooks_et_procedures',
  ],

  '06_Juridique_Conformite': [
    'Contentieux',
    'Contrats_et_avenants',
    'Conformite',
    'Audits',
    'Textes_reglementaires',
    'Decisions',
    'Autorisations',
  ],
};

export const OFFICIAL_FOLDERS = OFFICIAL_CLASSIFICATION_PLAN;

export const BUSINESS_SYNONYM_GROUPS: readonly BusinessSynonymGroup[] = [
  {
    target: { domain: '01_Administration_Generale', folder: 'Courriers' },
    tokens: ['courrier', 'courriers', 'correspondance', 'lettre', 'bordereau', 'accuse', 'reception'],
    phrases: ['accuse de reception', 'courrier entrant', 'courrier sortant'],
  },
  {
    target: { domain: '01_Administration_Generale', folder: 'Notes' },
    tokens: ['note', 'notes', 'memo', 'synthese', 'acte', 'arrete', 'decret', 'decrets'],
    phrases: ['note interne', 'note de service', 'note strategique'],
  },
  {
    target: { domain: '01_Administration_Generale', folder: 'Conventions' },
    tokens: ['convention', 'conventions', 'partenariat', 'partenariats'],
  },
  {
    target: { domain: '01_Administration_Generale', folder: 'Reunions_et_instances' },
    tokens: ['reunion', 'reunions', 'codir', 'copil', 'comex', 'convocation', 'ordre', 'jour', 'odj'],
    phrases: ['ordre du jour', 'cr reunion', 'compte rendu reunion'],
  },
  {
    target: { domain: '01_Administration_Generale', folder: 'Proces_verbaux' },
    tokens: ['pv', 'proces', 'verbal', 'verbaux'],
    phrases: ['proces verbal'],
  },
  {
    target: { domain: '01_Administration_Generale', folder: 'Archives_et_conservation' },
    tokens: ['archive', 'archives', 'archiv', 'archivage', 'conservation'],
  },
  {
    target: { domain: '01_Administration_Generale', folder: 'Pilotage_et_strategie' },
    tokens: [
      'rapport', 'rapports', 'rpport', 'rpaport', 'rppoorbis', 'rappoort', 'dg', 'annuel', 'mensuel',
      'strategie', 'strategique', 'pilotage', 'dashboard', 'tableau', 'kpi', 'arbitrage', 'decisionnel',
    ],
    phrases: ['rapport dg', 'rapport annuel', 'tableau kpi', 'tableau de bord'],
  },

  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Factures' },
    tokens: ['facture', 'factures', 'avoir', 'avoirs', 'fournisseur', 'fournisseurs', 'factturr', 'frcture'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Budgets' },
    tokens: ['budget', 'budgets', 'previsionnel', 'realise', 'prevu', 'budgto', 'bbud'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Ordres_de_virement' },
    tokens: ['virement', 'virements', 'ordre', 'ordres', 'op', 'opv', 'paiement', 'mandat'],
    phrases: ['ordre de virement', 'ordre paiement'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Etats_financiers' },
    tokens: ['balance', 'balances', 'bilan', 'gl', 'grand', 'livre', 'closing', 'liasse', 'liasses'],
    phrases: ['grand livre', 'gl export', 'etats financiers'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Fiscalite' },
    tokens: ['fiscalite', 'fiscal', 'tva', 'impot', 'impots', 'declaration', 'declarations'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Tresorerie' },
    tokens: ['tresorerie', 'cash', 'flux', 'banque', 'bancaire'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Achats_et_commandes' },
    tokens: ['achat', 'achats', 'commande', 'commandes', 'bon', 'bc'],
    phrases: ['bon de commande', 'bon livraison'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Rapprochements_bancaires' },
    tokens: ['rapprochement', 'rapprochements'],
    phrases: ['rapprochement bancaire'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Engagements_et_marches' },
    tokens: ['engagement', 'engagements', 'marche', 'marches', 'dao', 'appel', 'offres'],
    phrases: ['appel offres', 'appel d offres'],
  },
  {
    target: { domain: '02_Finances_Comptabilite', folder: 'Immobilisations_et_actifs' },
    tokens: ['immobilisation', 'immobilisations', 'actif', 'actifs', 'patrimoine'],
  },

  {
    target: { domain: '03_Ressources_Humaines', folder: 'Contrats' },
    tokens: ['contrat', 'contrats', 'cdi', 'cdd', 'prestation', 'avenant', 'embauche'],
  },
  {
    target: { domain: '03_Ressources_Humaines', folder: 'Attestations' },
    tokens: ['attestation', 'attestations', 'atestation', 'certificat', 'certificats', 'travail'],
    phrases: ['attestation travail', 'certificat travail'],
  },
  {
    target: { domain: '03_Ressources_Humaines', folder: 'Nominations' },
    tokens: ['nomination', 'nominations', 'decret', 'drh', 'affectation'],
    phrases: ['decret nomination'],
  },
  {
    target: { domain: '03_Ressources_Humaines', folder: 'Fiches_de_paie' },
    tokens: ['paie', 'paies', 'fiche', 'fiches', 'bulletin', 'bulletins', 'salaire'],
    phrases: ['fiche paie', 'bulletin paie'],
  },
  {
    target: { domain: '03_Ressources_Humaines', folder: 'Documents_personnels' },
    tokens: ['personnel', 'cv', 'conge', 'absence', 'discipline', 'sanction', 'medical', 'medecine', 'evaluation'],
  },
  {
    target: { domain: '03_Ressources_Humaines', folder: 'Formation' },
    tokens: ['formation', 'formations', 'plan', 'capacitation'],
    phrases: ['plan formation'],
  },

  {
    target: { domain: '04_Projets_et_Marches', folder: 'Cahiers_des_charges' },
    tokens: ['cahier', 'charges', 'cdc', 'tdr', 'termes', 'reference', 'erp'],
    phrases: ['cahier charges', 'termes de reference'],
  },
  {
    target: { domain: '04_Projets_et_Marches', folder: 'Specifications_techniques' },
    tokens: ['specification', 'specifications', 'spec', 'technique', 'techniques'],
  },
  {
    target: { domain: '04_Projets_et_Marches', folder: 'Jalons_et_livrables' },
    tokens: ['livrable', 'livrables', 'jalon', 'jalons', 'planning'],
  },
  {
    target: { domain: '04_Projets_et_Marches', folder: 'Suivi_et_reporting' },
    tokens: ['suivi', 'reporting', 'rapport', 'migration', 'avancement'],
  },
  {
    target: { domain: '04_Projets_et_Marches', folder: 'Risques_et_changements' },
    tokens: ['risque', 'risques', 'changement', 'changements', 'change'],
  },
  {
    target: { domain: '04_Projets_et_Marches', folder: 'Recettes_et_tests' },
    tokens: ['recette', 'recettes', 'test', 'tests', 'uat', 'validation'],
  },
  {
    target: { domain: '04_Projets_et_Marches', folder: 'Presentations' },
    tokens: ['presentation', 'presentations', 'ppt', 'pptx', 'slide', 'slides'],
  },

  {
    target: { domain: '05_Systemes_Information', folder: 'Incidents_et_exploitation' },
    tokens: ['incident', 'incidents', 'ticket', 'tickets', 'exploitation', 'run', 'support'],
  },
  {
    target: { domain: '05_Systemes_Information', folder: 'Sauvegardes' },
    tokens: ['sauvegarde', 'sauvegardes', 'backup', 'restore', 'restauration'],
  },
  {
    target: { domain: '05_Systemes_Information', folder: 'Inventaires_IT' },
    tokens: ['inventaire', 'inventaires', 'stock', 'materiel', 'parc'],
    phrases: ['inventaire stock', 'parc informatique'],
  },
  {
    target: { domain: '05_Systemes_Information', folder: 'Licences_et_abonnements' },
    tokens: ['licence', 'licences', 'abonnement', 'abonnements', 'subscription'],
  },
  {
    target: { domain: '05_Systemes_Information', folder: 'Configurations' },
    tokens: ['configuration', 'configurations', 'config', 'export'],
  },
  {
    target: { domain: '05_Systemes_Information', folder: 'Releases_et_changements' },
    tokens: ['release', 'releases', 'version', 'versions', 'deploiement'],
  },
  {
    target: { domain: '05_Systemes_Information', folder: 'Runbooks_et_procedures' },
    tokens: ['runbook', 'runbooks', 'procedure', 'procedures', 'mode', 'operatoire'],
    phrases: ['mode operatoire'],
  },

  {
    target: { domain: '06_Juridique_Conformite', folder: 'Contentieux' },
    tokens: ['contentieux', 'litige', 'litiges', 'plainte', 'reclamation'],
  },
  {
    target: { domain: '06_Juridique_Conformite', folder: 'Contrats_et_avenants' },
    tokens: ['contrat', 'contrats', 'avenant', 'avenants', 'clause', 'clauses'],
  },
  {
    target: { domain: '06_Juridique_Conformite', folder: 'Conformite' },
    tokens: ['conformite', 'compliance', 'rgpd', 'kys', 'kyc', 'procedure'],
  },
  {
    target: { domain: '06_Juridique_Conformite', folder: 'Audits' },
    tokens: ['audit', 'audits', 'controle', 'controles'],
  },
  {
    target: { domain: '06_Juridique_Conformite', folder: 'Textes_reglementaires' },
    tokens: ['loi', 'lois', 'decret', 'arrete', 'circulaire', 'reglement', 'reglementaire'],
  },
  {
    target: { domain: '06_Juridique_Conformite', folder: 'Decisions' },
    tokens: ['decision', 'decisions', 'arbitrage'],
  },
  {
    target: { domain: '06_Juridique_Conformite', folder: 'Autorisations' },
    tokens: ['autorisation', 'autorisations', 'agrement', 'agrements'],
  },
];
