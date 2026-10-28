import type { ClassificationRule } from '../../types';
import { bestScoredBusinessRuleMatch, folderPathFromClassificationRule } from './businessRulePaths';
import {
  AUTO_VALIDATE_MIN_CONFIDENCE,
  CATCH_ALL_FOLDER_NAMES,
  REVIEW_AMBIGUOUS,
  REVIEW_MIN_CONFIDENCE,
  REVIEW_NO_HINT,
  REVIEW_ROOT,
  REVIEW_UNREADABLE,
  STATUS_TAG_PATTERNS,
  TYPE_FAMILIES,
} from './constants';
import { tokenizeFilenameNormStrings } from './filenameTokens';
import {
  computeOfficialLexiconCandidates,
  scoreOfficialTargetFromFilename,
} from './officialMatching';
import { getExt, sanitizeFolderPath, sanitizeFolderSegment, sanitizeName, stripExtension } from './paths';
import { yearInfoForFile, type YearSource } from './filenameYear';
import { folderPathFor, type LocalArrangementStrategy } from './strategies';
import {
  MAX_TAXONOMY_CANDIDATES_SHOWN,
  TAXONOMY_AMBIGUITY_SCORE_MARGIN,
  type LocalClassificationLexicon,
  type TaxonomyCandidatePath,
} from './taxonomy';
import { normalize } from './text';

/**
 * Un fichier est considéré « à arbitrer » uniquement si le PREMIER segment de
 * son chemin est catch-all. Ainsi :
 *   - `Autres/2024`               → arbitrer (type/domaine inconnu)
 *   - `Sans_date`                 → arbitrer (seul critère perdu)
 *   - `Recettes/Activité/Sans_date` → PAS arbitrer (classif métier OK, seule
 *                                    l'année est imprécise — l'utilisateur
 *                                    n'a rien à corriger côté rangement).
 */
const isCatchAllPath = (path: string): boolean => {
  if (!path) return false;
  const segments = path.split('/').filter(Boolean);
  const first = segments[0];
  if (!first) return false;
  if (first === REVIEW_ROOT) return true;
  return CATCH_ALL_FOLDER_NAMES.has(first);
};

export const localArrangementFileKey = (file: File): string =>
  `${file.name}|${file.size}|${file.lastModified}`;

export type ClassificationSource =
  | 'business_rule'
  | 'official_filename'
  | 'lexicon_projection'
  | 'simple_strategy'
  | 'catch_all'
  | 'unreadable'
  | 'user_override'
  | 'ambiguous_hold';

export type ClassificationReviewStatus = 'auto_validated' | 'needs_review' | 'unclassified';

export interface ClassificationDecision {
  folderPath: string;
  confidence: number;
  source: ClassificationSource;
  reviewStatus: ClassificationReviewStatus;
  reasons: string[];
  tags: string[];
  year: string;
  yearSource: YearSource;
}

export interface ArrangedFile {
  file: File;
  folderPath: string;
  newName: string;
  decision: ClassificationDecision;
  /** Plusieurs chemins plausibles (plan de classement) — choix utilisateur à l'aperçu. */
  taxonomyCandidates?: TaxonomyCandidatePath[];
  duplicateGroupId?: string | null;
}

export interface DuplicateGroupSummary {
  id: string;
  count: number;
}

export interface ArrangedTree {
  total: number;
  totalBytes: number;
  files: ArrangedFile[];
  /** Liste agrégée pour l'aperçu : un item par dossier final, trié alpha. */
  folders: Array<{ path: string; count: number; bytes: number; catchAll: boolean }>;
  /**
   * Nombre de fichiers tombés dans un dossier catch-all (« Autres » ou
   * « Sans_date ») — c'est l'arbitrage qui revient à l'utilisateur.
   */
  filesUnranged: number;
  /** Nombre de dossiers à créer (final) — utile pour le message de fin. */
  foldersCreated: number;
  /** Nombre de dossiers catch-all parmi les dossiers à créer. */
  foldersUnranged: number;
  /** Score agrégé 0–100 (couverture auto vs besoin d'arbitrage). */
  qualityScore: number;
  duplicateGroups: DuplicateGroupSummary[];
}

export interface ArrangementManifestRow {
  original_name: string;
  new_name: string;
  folder_path: string;
  confidence: number;
  review_status: ClassificationReviewStatus;
  source: ClassificationSource;
  reasons: string;
  tags: string;
  year: string;
  year_source: YearSource;
  duplicate_group: string | null;
}

const weakNamePenalty = (file: File): number => {
  const tokens = tokenizeFilenameNormStrings(file.name);
  if (tokens.length <= 1) return 14;
  if (tokens.length <= 3) return 7;
  return 0;
};

export const extractStatusTags = (filename: string): string[] => {
  const hay = normalize(filename);
  const tags: string[] = [];
  for (const [tag, patterns] of Object.entries(STATUS_TAG_PATTERNS)) {
    for (const p of patterns) {
      const np = normalize(String(p));
      if (np.length >= 3 && hay.includes(np)) {
        tags.push(tag);
        break;
      }
    }
  }
  return tags;
};

const probableDuplicateKey = (file: File): string => {
  const ext = getExt(file.name);
  const stem = normalize(stripExtension(file.name)).replace(/\s+/g, '_').slice(0, 96);
  return `${ext}|${file.size}|${stem}`;
};

const applyDuplicateHints = (items: ArrangedFile[]): ArrangedFile[] => {
  const groups = new Map<string, ArrangedFile[]>();
  for (const it of items) {
    const k = probableDuplicateKey(it.file);
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }
  const dupKeyToId = new Map<string, string>();
  let n = 0;
  for (const [k, arr] of groups) {
    if (arr.length >= 2) {
      n += 1;
      dupKeyToId.set(k, `dup_${n}`);
    }
  }
  return items.map((it) => {
    const id = dupKeyToId.get(probableDuplicateKey(it.file));
    if (!id) return it;
    return {
      ...it,
      duplicateGroupId: id,
      decision: {
        ...it.decision,
        tags: Array.from(new Set([...it.decision.tags, 'probable_duplicate'])),
      },
    };
  });
};

const makeDecision = (args: {
  file: File;
  folderPath: string;
  confidence: number;
  source: ClassificationSource;
  reasons: string[];
  tags?: string[];
}): ClassificationDecision => {
  const yi = yearInfoForFile(args.file);
  const raw = Math.round(args.confidence - weakNamePenalty(args.file));
  const confidence = Math.max(0, Math.min(100, raw));

  let reviewStatus: ClassificationReviewStatus = 'unclassified';
  if (confidence >= AUTO_VALIDATE_MIN_CONFIDENCE) reviewStatus = 'auto_validated';
  else if (confidence >= REVIEW_MIN_CONFIDENCE) reviewStatus = 'needs_review';

  const tagSet = new Set([...(args.tags ?? []), ...extractStatusTags(args.file.name)]);

  return {
    folderPath: args.folderPath,
    confidence,
    source: args.source,
    reviewStatus,
    reasons: args.reasons,
    tags: Array.from(tagSet),
    year: yi.year,
    yearSource: yi.source,
  };
};

const fileHasKnownExtension = (file: File): boolean => Boolean(TYPE_FAMILIES[getExt(file.name)]);

const classifyByBusinessRulesFlow = (
  file: File,
  rules: ClassificationRule[] | undefined,
  classificationLexicon: LocalClassificationLexicon | null | undefined,
): Pick<ArrangedFile, 'folderPath' | 'taxonomyCandidates' | 'decision'> => {
  const yearSeg = yearInfoForFile(file).year;

  if (!fileHasKnownExtension(file)) {
    const path = `${REVIEW_UNREADABLE}/${yearSeg}`;
    return {
      folderPath: path,
      decision: makeDecision({
        file,
        folderPath: path,
        confidence: 48,
        source: 'unreadable',
        reasons: ['Extension non reconnue pour le classement métier'],
      }),
    };
  }

  if (rules && rules.length > 0) {
    const br = bestScoredBusinessRuleMatch(file, rules);
    if (br && br.score >= REVIEW_MIN_CONFIDENCE) {
      const folderPath = folderPathFromClassificationRule(file, br.rule);
      return {
        folderPath,
        decision: makeDecision({
          file,
          folderPath,
          confidence: br.score,
          source: 'business_rule',
          reasons: br.reasons,
        }),
      };
    }
  }

  const officialScored = scoreOfficialTargetFromFilename(file);
  const useLexicon = classificationLexicon && classificationLexicon.activities.length > 0;

  if (officialScored && officialScored.score >= AUTO_VALIDATE_MIN_CONFIDENCE) {
    const path = `${sanitizeFolderSegment(officialScored.target.domain)}/${sanitizeFolderSegment(officialScored.target.folder)}/${yearSeg}`;
    return {
      folderPath: path,
      decision: makeDecision({
        file,
        folderPath: path,
        confidence: officialScored.score,
        source: 'official_filename',
        reasons: officialScored.reasons,
      }),
    };
  }

  if (useLexicon && classificationLexicon) {
    let candidates = computeOfficialLexiconCandidates(file, classificationLexicon).filter(
      (c) => c.score >= REVIEW_MIN_CONFIDENCE,
    );
    candidates.sort((a, b) => b.score - a.score || a.folderPath.localeCompare(b.folderPath, 'fr'));
    candidates = candidates.slice(0, MAX_TAXONOMY_CANDIDATES_SHOWN);

    if (candidates.length === 0) {
      if (officialScored && officialScored.score >= REVIEW_MIN_CONFIDENCE) {
        const path = `${sanitizeFolderSegment(officialScored.target.domain)}/${sanitizeFolderSegment(officialScored.target.folder)}/${yearSeg}`;
        return {
          folderPath: path,
          decision: makeDecision({
            file,
            folderPath: path,
            confidence: officialScored.score,
            source: 'official_filename',
            reasons: officialScored.reasons,
          }),
        };
      }
      const fallback = `${REVIEW_NO_HINT}/${yearSeg}`;
      return {
        folderPath: fallback,
        decision: makeDecision({
          file,
          folderPath: fallback,
          confidence: officialScored?.score ?? 38,
          source: 'catch_all',
          reasons: officialScored?.reasons ?? ['Aucune projection fiable depuis le référentiel'],
        }),
      };
    }

    const winner = candidates[0]!;
    const second = candidates[1];
    const ambiguous =
      second !== undefined && second.score >= winner.score - TAXONOMY_AMBIGUITY_SCORE_MARGIN;

    if (ambiguous) {
      const path = `${REVIEW_AMBIGUOUS}/${yearSeg}`;
      return {
        folderPath: path,
        taxonomyCandidates: candidates,
        decision: makeDecision({
          file,
          folderPath: path,
          confidence: Math.min(winner.score, 72),
          source: 'ambiguous_hold',
          reasons: [
            `Ambiguïté référentiel (${candidates.length} chemins proches)`,
            ...(winner.reasons ?? []).slice(0, 2),
          ],
        }),
      };
    }

    return {
      folderPath: winner.folderPath,
      decision: makeDecision({
        file,
        folderPath: winner.folderPath,
        confidence: winner.score,
        source: 'lexicon_projection',
        reasons: winner.reasons ?? ['Projection référentiel → plan officiel'],
      }),
    };
  }

  if (officialScored && officialScored.score >= REVIEW_MIN_CONFIDENCE) {
    const path = `${sanitizeFolderSegment(officialScored.target.domain)}/${sanitizeFolderSegment(officialScored.target.folder)}/${yearSeg}`;
    return {
      folderPath: path,
      decision: makeDecision({
        file,
        folderPath: path,
        confidence: officialScored.score,
        source: 'official_filename',
        reasons: officialScored.reasons,
      }),
    };
  }

  const fallback = `${REVIEW_NO_HINT}/${yearSeg}`;
  return {
    folderPath: fallback,
    decision: makeDecision({
      file,
      folderPath: fallback,
      confidence: 40,
      source: 'catch_all',
      reasons: ['Pas de règle ni signal officiel exploitable'],
    }),
  };
};

const finalizeArrangedTree = (files: ArrangedFile[]): ArrangedTree => {
  let totalBytes = 0;
  const folderStats = new Map<string, { count: number; bytes: number }>();

  for (const item of files) {
    totalBytes += item.file.size || 0;
    const prev = folderStats.get(item.folderPath) || { count: 0, bytes: 0 };
    folderStats.set(item.folderPath, {
      count: prev.count + 1,
      bytes: prev.bytes + (item.file.size || 0),
    });
  }

  const folders = Array.from(folderStats.entries())
    .map(([path, stats]) => ({ path, ...stats, catchAll: isCatchAllPath(path) }))
    .sort((a, b) => a.path.localeCompare(b.path, 'fr'));

  const filesUnranged = folders
    .filter((folder) => folder.catchAll)
    .reduce((sum, folder) => sum + folder.count, 0);
  const foldersUnranged = folders.filter((folder) => folder.catchAll).length;

  const dupCounts = new Map<string, number>();
  for (const f of files) {
    if (f.duplicateGroupId) {
      dupCounts.set(f.duplicateGroupId, (dupCounts.get(f.duplicateGroupId) ?? 0) + 1);
    }
  }
  const duplicateGroups = [...dupCounts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id, 'fr'));

  let qualityScore = 100;
  if (files.length > 0) {
    const auto = files.filter((f) => f.decision.reviewStatus === 'auto_validated').length;
    const avgConf = files.reduce((s, f) => s + f.decision.confidence, 0) / files.length;
    qualityScore = Math.round((auto / files.length) * 58 + avgConf * 0.42);
    qualityScore = Math.max(0, Math.min(100, qualityScore));
  }

  return {
    total: files.length,
    totalBytes,
    files,
    folders,
    filesUnranged,
    foldersCreated: folders.length,
    foldersUnranged,
    qualityScore,
    duplicateGroups,
  };
};

/**
 * Recalcule dossiers / KPI après que l'utilisateur a choisi un chemin parmi
 * plusieurs candidats taxonomiques.
 */
export const applyLocalFolderPathOverrides = (
  base: ArrangedTree,
  overrides: Record<string, string>,
): ArrangedTree => {
  const nextFiles = base.files.map((item) => {
    const key = localArrangementFileKey(item.file);
    const chosen = overrides[key];
    if (chosen !== undefined) {
      const sanitized = sanitizeFolderPath(chosen);
      return {
        ...item,
        folderPath: sanitized,
        taxonomyCandidates: undefined,
        decision: {
          ...item.decision,
          folderPath: sanitized,
          source: 'user_override' as ClassificationSource,
          reviewStatus: 'needs_review' as ClassificationReviewStatus,
          reasons: [...item.decision.reasons, 'Chemin choisi manuellement dans l’aperçu'],
        },
      };
    }
    return item;
  });
  return finalizeArrangedTree(nextFiles);
};

export const arrangeFiles = (
  files: File[],
  strategy: LocalArrangementStrategy,
  /**
   * Règles métier — uniquement pour `by_business_rules`.
   * Triées par priorité ASC (cf. `prepareBusinessRulesForLocalMatching`).
   */
  rules?: ClassificationRule[],
  /**
   * Référentiel GED : projection vers `OFFICIAL_CLASSIFICATION_PLAN`
   * après les règles et le matching officiel sur le nom de fichier.
   */
  classificationLexicon?: LocalClassificationLexicon | null,
): ArrangedTree => {
  const arranged: ArrangedFile[] = [];

  for (const file of files) {
    if (strategy === 'by_business_rules') {
      const r = classifyByBusinessRulesFlow(file, rules, classificationLexicon);
      arranged.push({
        file,
        folderPath: r.folderPath,
        newName: sanitizeName(file.name),
        decision: r.decision,
        ...(r.taxonomyCandidates ? { taxonomyCandidates: r.taxonomyCandidates } : {}),
      });
    } else {
      const folderPath = folderPathFor(file, strategy);
      arranged.push({
        file,
        folderPath,
        newName: sanitizeName(file.name),
        decision: makeDecision({
          file,
          folderPath,
          confidence: 66,
          source: 'simple_strategy',
          reasons: ['Rangement selon la stratégie locale choisie'],
        }),
      });
    }
  }

  return finalizeArrangedTree(applyDuplicateHints(arranged));
};

const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export const buildArrangementManifest = (tree: ArrangedTree): ArrangementManifestRow[] =>
  tree.files.map((item) => ({
    original_name: item.file.name,
    new_name: item.newName,
    folder_path: item.folderPath,
    confidence: item.decision.confidence,
    review_status: item.decision.reviewStatus,
    source: item.decision.source,
    reasons: item.decision.reasons.join(' | '),
    tags: item.decision.tags.join(','),
    year: item.decision.year,
    year_source: item.decision.yearSource,
    duplicate_group: item.duplicateGroupId ?? null,
  }));

export const buildArrangementManifestJson = (tree: ArrangedTree): string =>
  JSON.stringify(buildArrangementManifest(tree), null, 2);

export const buildArrangementManifestCsv = (tree: ArrangedTree): string => {
  const rows = buildArrangementManifest(tree);
  const headers = [
    'original_name',
    'new_name',
    'folder_path',
    'confidence',
    'review_status',
    'source',
    'reasons',
    'tags',
    'year',
    'year_source',
    'duplicate_group',
  ] as const;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.original_name),
        csvEscape(row.new_name),
        csvEscape(row.folder_path),
        String(row.confidence),
        csvEscape(row.review_status),
        csvEscape(row.source),
        csvEscape(row.reasons),
        csvEscape(row.tags),
        csvEscape(row.year),
        csvEscape(row.year_source),
        row.duplicate_group ? csvEscape(row.duplicate_group) : '',
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
};
