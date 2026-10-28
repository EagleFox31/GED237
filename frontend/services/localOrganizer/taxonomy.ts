import type { ClassificationActivity, ClassificationDomain } from '../../types';
import { DOCUMENT_PROCESS_TOKEN_HINTS, SANS_DATE } from './constants';
import { tokenizeFilename } from './filenameTokens';
import { yearFromFilename } from './filenameYear';
import { getExt, sanitizeFolderSegment } from './paths';
import {
  MIN_TAXONOMY_MATCH_SCORE,
  compactSubstringScore,
  tokenAgainstLabelScore,
} from './scoring';
import { normalize, normalizeCompactAlphaNum } from './text';

/** Référentiel domaines / activités (plan de classement) pour le fallback intelligent. */
export interface LocalClassificationLexicon {
  domains: Array<{ id: string; name: string }>;
  activities: Array<{ id: string; domain_id: string; name: string }>;
}

export const buildLocalClassificationLexicon = (
  domains: ClassificationDomain[],
  activities: ClassificationActivity[],
): LocalClassificationLexicon => ({
  domains: domains
    .filter((d) => d.is_active !== false)
    .map((d) => ({ id: d.id, name: d.name.trim() })),
  activities: activities
    .filter((a) => a.is_active !== false)
    .map((a) => ({ id: a.id, domain_id: a.domain_id, name: a.name.trim() })),
});

/** Écart max entre scores pour considérer plusieurs dossiers « plausibles » pour l'utilisateur. */
export const TAXONOMY_AMBIGUITY_SCORE_MARGIN = 8;

/** Nombre max de chemins proposés en cas d'ambiguïté. */
export const MAX_TAXONOMY_CANDIDATES_SHOWN = 6;

export interface TaxonomyCandidatePath {
  folderPath: string;
  score: number;
  domainName: string;
  activityName: string;
  /** Diagnostics optionnels (projection officielle, UI peut ignorer). */
  reasons?: string[];
}

/**
 * Quand le nom contient déjà des indices **métier**, on évite qu'un libellé
 * domaine/activité qui ne fait qu'**répliquer un nom propre** du fichier
 * (ex. activité « Mvondo ») domine le couple Domaine/Activité réellement utile.
 */
const personalLabelEchoPenalty = (
  label: string,
  tokenNormSet: ReadonlySet<string>,
  hayCompact: string,
): number => {
  const parts = normalize(label)
    .split(/\s+/)
    .filter((p) => p.length >= 3);
  if (parts.length === 0) return 0;

  const isMetierWord = (w: string): boolean => DOCUMENT_PROCESS_TOKEN_HINTS.has(w);

  if (parts.length === 1) {
    const w = parts[0]!;
    if (w.length < 5) return 0;
    if (isMetierWord(w)) return 0;
    if (!tokenNormSet.has(w)) return 0;
    const lc = normalizeCompactAlphaNum(label);
    if (lc.length < 4 || !hayCompact.includes(lc)) return 0;
    return 38;
  }

  const longParts = parts.filter((p) => p.length >= 4);
  if (longParts.length >= 2) {
    const allEcho = longParts.every((p) => tokenNormSet.has(p) && !isMetierWord(p));
    if (allEcho) {
      const lc = normalizeCompactAlphaNum(label);
      if (lc.length >= 6 && hayCompact.includes(lc)) return 30;
    }
  }

  return 0;
};

/** Chemins référentiel triés par score (avant projection plan officiel). */
export const buildTaxonomyRankedPaths = (
  file: File,
  lexicon: LocalClassificationLexicon,
): TaxonomyCandidatePath[] => {
  const ext = getExt(file.name);
  const stem = ext ? file.name.slice(0, -ext.length) : file.name;
  const hayCompact = normalizeCompactAlphaNum(stem);
  const tokens = tokenizeFilename(file.name);
  const tokenNormSet = new Set(tokens.map((t) => t.norm));
  const domainById = new Map(lexicon.domains.map((d) => [d.id, d.name]));

  const yFromName = yearFromFilename(file.name);
  let yearSeg = SANS_DATE;
  if (yFromName !== null && yFromName >= 1970 && yFromName <= 9999) {
    yearSeg = String(yFromName);
  } else if (file.lastModified) {
    const yy = new Date(file.lastModified).getFullYear();
    if (Number.isFinite(yy) && yy >= 1970 && yy <= 9999) yearSeg = String(yy);
  }

  const rows: Array<{ score: number; domainName: string; activityName: string }> = [];

  for (const act of lexicon.activities) {
    const domainName = domainById.get(act.domain_id);
    if (domainName) {
      let score = 0;
      let activitySignal = 0;

      const actStem = compactSubstringScore(hayCompact, act.name);
      score += actStem;
      if (actStem > 0) activitySignal += 1;

      const domStem = compactSubstringScore(hayCompact, domainName);
      score += Math.floor(domStem * 0.62);

      let hintBonus = 0;
      for (const { norm } of tokens) {
        if (DOCUMENT_PROCESS_TOKEN_HINTS.has(norm)) {
          hintBonus += tokenAgainstLabelScore(norm, act.name);
          hintBonus += Math.floor(tokenAgainstLabelScore(norm, domainName) * 0.52);
        }
      }
      score += Math.min(hintBonus, 48);

      for (const { norm } of tokens) {
        const ta = tokenAgainstLabelScore(norm, act.name);
        if (ta > 0) activitySignal += 1;
        score += ta;
        score += Math.floor(tokenAgainstLabelScore(norm, domainName) * 0.52);
      }

      score -= personalLabelEchoPenalty(act.name, tokenNormSet, hayCompact);
      score -= personalLabelEchoPenalty(domainName, tokenNormSet, hayCompact);

      const weakSignal =
        activitySignal === 0 && score < MIN_TAXONOMY_MATCH_SCORE + 10 && domStem < 22;
      if (!weakSignal && score >= MIN_TAXONOMY_MATCH_SCORE) {
        rows.push({ score, domainName, activityName: act.name });
      }
    }
  }

  rows.sort((a, b) => b.score - a.score || a.activityName.localeCompare(b.activityName, 'fr'));

  const pathBestScore = new Map<string, number>();
  const pathMeta = new Map<string, { domainName: string; activityName: string }>();

  for (const r of rows) {
    const folderPath = `${sanitizeFolderSegment(r.domainName)}/${sanitizeFolderSegment(r.activityName)}/${yearSeg}`;
    const prev = pathBestScore.get(folderPath);
    if (prev === undefined || r.score > prev) {
      pathBestScore.set(folderPath, r.score);
      pathMeta.set(folderPath, { domainName: r.domainName, activityName: r.activityName });
    }
  }

  return [...pathBestScore.entries()]
    .map(([folderPath, score]) => {
      const meta = pathMeta.get(folderPath)!;
      return {
        folderPath,
        score,
        domainName: meta.domainName,
        activityName: meta.activityName,
      };
    })
    .sort((a, b) => b.score - a.score || a.folderPath.localeCompare(b.folderPath, 'fr'));
};

/** Top-N chemins référentiel pour projection vers le plan officiel. */
export const listTaxonomyCandidatePathsForLexicon = (
  file: File,
  lexicon: LocalClassificationLexicon,
  limit = MAX_TAXONOMY_CANDIDATES_SHOWN * 2,
): TaxonomyCandidatePath[] => buildTaxonomyRankedPaths(file, lexicon).slice(0, limit);

export const computeTaxonomyCandidates = (
  file: File,
  lexicon: LocalClassificationLexicon,
): {
  primaryPath: string | null;
  candidates: TaxonomyCandidatePath[];
  winner: { domainName: string; activityName: string } | null;
} => {
  const scoredPaths = buildTaxonomyRankedPaths(file, lexicon);

  if (scoredPaths.length === 0) {
    return { primaryPath: null, candidates: [], winner: null };
  }

  const top = scoredPaths[0]!;
  const closeEnough = scoredPaths
    .filter((p) => p.score >= top.score - TAXONOMY_AMBIGUITY_SCORE_MARGIN)
    .slice(0, MAX_TAXONOMY_CANDIDATES_SHOWN);

  const winner = { domainName: top.domainName, activityName: top.activityName };

  return {
    primaryPath: top.folderPath,
    candidates: closeEnough.length > 1 ? closeEnough : [],
    winner,
  };
};
