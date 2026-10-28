/** Aligné vision institutionnelle locale (segment année / fallback). */
export const SANS_DATE = 'Sans_date';
export const AUTRES = 'Autres';
export const DIVERS = 'Divers';

/** Seuils confiance — voir `officialMatching`. */
export const AUTO_VALIDATE_MIN_CONFIDENCE = 80;
export const REVIEW_MIN_CONFIDENCE = 55;

/** Familles par extension — vision « rangement par type » + archives compressées. */
export const TYPE_FAMILIES: Record<string, string> = {
  '.pdf': 'PDF',
  '.doc': 'Documents_Word',
  '.docx': 'Documents_Word',
  '.odt': 'Documents_Word',
  '.rtf': 'Textes',
  '.txt': 'Textes',
  '.xls': 'Tableurs_Excel',
  '.xlsx': 'Tableurs_Excel',
  '.ods': 'Tableurs_Excel',
  '.csv': 'Tableurs_Excel',
  '.ppt': 'Presentations',
  '.pptx': 'Presentations',
  '.odp': 'Presentations',
  '.zip': 'Archives',
  '.rar': 'Archives',
  '.7z': 'Archives',
  '.png': 'Images',
  '.jpg': 'Images',
  '.jpeg': 'Images',
  '.tiff': 'Images',
  '.tif': 'Images',
  '.bmp': 'Images',
  '.gif': 'Images',
  '.webp': 'Images',
};

export const REVIEW_ROOT = '99_A_Verifier';
export const REVIEW_AMBIGUOUS = `${REVIEW_ROOT}/Ambigus`;
export const REVIEW_UNREADABLE = `${REVIEW_ROOT}/Illisibles`;
export const REVIEW_NO_HINT = `${REVIEW_ROOT}/Non_classes`;

/**
 * Dossiers catch-all + sous-arbres de revue (premier segment ou racine métier catch-all).
 */
export const CATCH_ALL_FOLDER_NAMES = new Set<string>([
  AUTRES,
  DIVERS,
  SANS_DATE,
  REVIEW_ROOT,
  REVIEW_AMBIGUOUS,
  REVIEW_NO_HINT,
  REVIEW_UNREADABLE,
]);

/** Jetons « poubelle » — ne portent pas le classement officiel (matching lexique local). */
export const POUBELLE_TOKENS = new Set([
  'new', 'tmp', 'temp', 'test', 'divers', 'autres', 'backup', 'copie', 'copy', 'scan', 'old',
  'nouveau', 'dossier', 'fichier', 'document', 'final', 'ok', 'v1', 'v2', 'v3', 'bis',
]);

/** Indices pour tags extraits du nom (hors chemin métier). */
export const STATUS_TAG_PATTERNS: Readonly<Record<string, readonly string[]>> = {
  urgent: ['urgent', 'prioritaire'],
  archive: ['archive', 'archiv', 'archives', 'archivage'],
  scan: ['scan', 'scanne', 'scannee', 'numerise', 'numerisee'],
  copie: ['copie', 'copy', 'duplicata'],
  brouillon: ['brouillon', 'draft', 'tmp', 'temp'],
  signe: ['signer', 'signe', 'signee', 'signature', 'ok'],
  corrige: ['corrige', 'corrigee', 'correction'],
  final: ['final', 'definitif', 'definitive'],
  ancien: ['old', 'ancien', 'ancienne'],
  nouveau: ['new', 'nouveau', 'nouvelle'],
  a_trier: ['a_trier', 'trier', 'a classer'],
};

/**
 * Stopwords français + bruit fichier — voir tokenizeFilename (`filenameTokens.ts`).
 */
export const KEYWORD_STOPWORDS: ReadonlySet<string> = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'en', 'au', 'aux', 'par',
  'pour', 'avec', 'sur', 'sous', 'sans', 'dans', 'chez', 'vers', 'contre',
  'et', 'ou', 'mais', 'donc', 'ni', 'car', 'que', 'qui', 'quoi', 'dont', 'ne',
  'pas', 'plus', 'moins', 'tres', 'est', 'sont', 'etre', 'ete',
  'mon', 'ton', 'son', 'mes', 'tes', 'ses', 'notre', 'votre', 'leur', 'nos',
  'vos', 'leurs', 'cet', 'cette', 'ces', 'celui', 'celle', 'ceux', 'celles',
  'copie', 'copies', 'copy', 'version', 'versions', 'final', 'finale',
  'draft', 'brouillon', 'tmp', 'temp', 'old', 'new', 'nouveau', 'nouvelle',
  'ancien', 'ancienne', 'rev', 'revision', 'def', 'definitif', 'definitive',
  'maj', 'update', 'updated', 'modifie', 'modifiee', 'modif',
  'document', 'documents', 'doc', 'docs', 'fichier', 'fichiers', 'file', 'files',
  'page', 'pages', 'photo', 'photos', 'image', 'images', 'scan', 'scans',
  'general', 'generale', 'divers', 'autres', 'autre', 'sans', 'sans_objet',
  'test', 'tests', 'exemple', 'exemples', 'sample', 'samples', 'demo',
  'untitled', 'sans_nom', 'sansnom', 'nouveau_document',
]);

/** Indices « process » — bonus taxonomie référentiel + anti faux dossiers basés sur un nom propre. */
export const DOCUMENT_PROCESS_TOKEN_HINTS: ReadonlySet<string> = new Set([
  'contrat', 'contrats', 'prestation', 'prestations', 'avenant', 'avenants',
  'rapport', 'rapports', 'synthese', 'rendu', 'rendus',
  'facture', 'factures', 'facturation',
  'attestation', 'attestations', 'certificat', 'certificats',
  'budget', 'budgets',
  'nomination', 'nominations',
  'paie',
  'convention', 'conventions',
  'note', 'notes',
  'cahier', 'cahiers', 'charges',
  'migration',
  'presentation', 'presentations',
  'virement', 'virements',
  'courrier', 'courriers',
  'decret', 'decrets', 'arrete',
  'mandat', 'mandats',
  'comptable', 'comptables',
  'conge', 'conges', 'absence', 'absences',
  'recrutement', 'embauche',
  'formation', 'formations',
  'entretien', 'entretiens', 'evaluation',
  'bilan', 'fiscal', 'tva', 'tresorerie',
  'achat', 'achats', 'commande', 'commandes',
  'pv', 'marche', 'dao',
  'livrable', 'jalon', 'specification', 'reporting', 'risque',
  'incident', 'incidents', 'ticket', 'sauvegarde', 'inventaire',
  'licence', 'licences', 'configuration', 'release', 'runbook',
]);
