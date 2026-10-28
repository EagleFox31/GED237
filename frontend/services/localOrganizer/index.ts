/**
 * Local file organizer — service pur (sans React) qui range les fichiers
 * sélectionnés par l'utilisateur en sous-dossiers, soit directement sur son
 * poste via la File System Access API (Chrome / Edge / Chromium), soit en
 * fallback ZIP universel pour Firefox / Safari.
 *
 * Façade stable : l’implémentation est découpée par responsabilité dans ce dossier.
 */

export type { YearSource } from './filenameYear';
export { yearInfoForFile } from './filenameYear';
export type { LocalArrangementStrategy } from './strategies';
export { LOCAL_ARRANGEMENT_OPTIONS } from './strategies';

export type { LocalClassificationLexicon } from './taxonomy';
export { buildLocalClassificationLexicon } from './taxonomy';

export type { BusinessSynonymGroup, OfficialTarget } from './classificationPlan';
export { BUSINESS_SYNONYM_GROUPS, OFFICIAL_CLASSIFICATION_PLAN, OFFICIAL_FOLDERS } from './classificationPlan';

export {
  matchOfficialFolderFromFilename,
  scoreOfficialTargetFromFilename,
  computeOfficialLexiconCandidates,
  scoreOfficialLabelAgainstFileContext,
  remapTaxonomyWinnerToOfficialPath,
} from './officialMatching';

export {
  TAXONOMY_AMBIGUITY_SCORE_MARGIN,
  MAX_TAXONOMY_CANDIDATES_SHOWN,
  buildTaxonomyRankedPaths,
  listTaxonomyCandidatePathsForLexicon,
  type TaxonomyCandidatePath,
} from './taxonomy';

export {
  localArrangementFileKey,
  extractStatusTags,
  buildArrangementManifest,
  buildArrangementManifestJson,
  buildArrangementManifestCsv,
  type ArrangedFile,
  type ArrangedTree,
  type ArrangementManifestRow,
  type ClassificationDecision,
  type ClassificationReviewStatus,
  type ClassificationSource,
  type DuplicateGroupSummary,
  applyLocalFolderPathOverrides,
  arrangeFiles,
} from './arrangement';

export { supportsFileSystemAccess } from './fsAccess';
export { prepareBusinessRulesForLocalMatching } from './businessRulesPrep';
export type { BusinessRuleMatch } from './businessRulePaths';
export { bestScoredBusinessRuleMatch, folderPathFromClassificationRule } from './businessRulePaths';
export type { LocalWriteProgress, LocalWriteResult } from './fsAccess';
export { pickLocalDirectory, writeArrangedToDirectory, writeManifestToDirectory } from './fsAccess';
export { downloadArrangedAsZip } from './zipExport';
