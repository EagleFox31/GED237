import type { ClassificationRule } from '../../types';
import { AUTRES, SANS_DATE } from './constants';
import { yearFromFilename } from './filenameYear';
import { sanitizeFolderSegment } from './paths';
import { normalize } from './text';

// ───────────────────────────────────────────────────────────────────────────
// Moteur de classement local — port du _matches_filename_pattern Python.
// Sémantique IDENTIQUE au backend : OU sur tokens séparés par `;,|`,
// comparaison insensible à la casse ET aux accents.
// ───────────────────────────────────────────────────────────────────────────

const matchesFilenamePattern = (filename: string, pattern: string | null | undefined): boolean => {
  if (!pattern) return true;
  const tokens = pattern
    .split(/[;,|]+/)
    .map((token) => normalize(token.trim()))
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return true;
  const haystack = normalize(filename);
  return tokens.some((token) => haystack.includes(token));
};

const matchesMimePattern = (file: File, pattern: string | null | undefined): boolean => {
  if (!pattern) return true;
  const tokens = pattern
    .split(/[;,|]+/)
    .map((token) => normalize(token.trim()))
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return true;
  const fileType = normalize(file.type || '');
  if (!fileType) return true;
  return tokens.some((token) => fileType.includes(token));
};

const resolveYearForRule = (file: File, rule: ClassificationRule): number | null => {
  switch (rule.year_strategy) {
    case 'fixed':
      return typeof rule.fixed_year === 'number' && rule.fixed_year > 0 ? rule.fixed_year : null;
    case 'from_filename':
      return yearFromFilename(file.name);
    case 'from_metadata':
      if (!file.lastModified) return null;
      return new Date(file.lastModified).getFullYear();
    case 'current':
    default:
      return new Date().getFullYear();
  }
};

const folderPathFromRule = (file: File, rule: ClassificationRule): string => {
  const segments: string[] = [];
  const domain = rule.domain_name?.trim();
  const activity = rule.activity_name?.trim();
  if (domain) segments.push(sanitizeFolderSegment(domain));
  if (activity) segments.push(sanitizeFolderSegment(activity));

  const year = resolveYearForRule(file, rule);
  segments.push(year !== null ? String(year) : SANS_DATE);

  if (segments.length === 1) {
    return `${AUTRES}/${segments[0]}`;
  }
  return segments.join('/');
};

/** Même logique que `folderPathFromRule`, exposée pour arrangement / tests. */
export const folderPathFromClassificationRule = folderPathFromRule;

export interface BusinessRuleMatch {
  rule: ClassificationRule;
  score: number;
  reasons: string[];
}

const scoreMatchedRule = (_file: File, rule: ClassificationRule): BusinessRuleMatch => {
  let score = 70;
  const reasons: string[] = [];

  const pattern = rule.filename_pattern?.trim();
  if (pattern) {
    const tokens = pattern
      .split(/[;,|]+/)
      .map((token) => normalize(token.trim()))
      .filter((token) => token.length > 0);
    score += Math.min(12 + tokens.length * 6, 28);
    reasons.push(tokens.length ? `Motifs fichier : ${tokens.slice(0, 4).join(', ')}` : 'Motif fichier');
  } else {
    reasons.push('Règle sans motif nom de fichier (large)');
    score -= 8;
  }

  if (rule.mime_type_pattern?.trim()) {
    score += 14;
    reasons.push('Filtre type MIME actif');
  }

  score += Math.max(0, Math.min(18, 30 - rule.priority));

  if (rule.domain_name?.trim() && rule.activity_name?.trim()) {
    score += 6;
    reasons.push('Domaine et activité cibles renseignés');
  }

  reasons.unshift(`Règle « ${rule.name.trim() || rule.code} »`);

  return { rule, score: Math.min(98, Math.round(score)), reasons };
};

/**
 * Parmi les règles qui matchent le fichier, retient le meilleur score
 * (cas où plusieurs motifs se chevauchent).
 */
export const bestScoredBusinessRuleMatch = (
  file: File,
  rules: ClassificationRule[],
): BusinessRuleMatch | null => {
  let best: BusinessRuleMatch | null = null;
  for (const rule of rules) {
    if (
      rule.is_active !== false &&
      matchesFilenamePattern(file.name, rule.filename_pattern) &&
      matchesMimePattern(file, rule.mime_type_pattern)
    ) {
      const scored = scoreMatchedRule(file, rule);
      if (
        !best ||
        scored.score > best.score ||
        (scored.score === best.score && rule.priority < best.rule.priority)
      ) {
        best = scored;
      }
    }
  }
  return best;
};

/**
 * Évalue les règles métier (actives, triées par priorité) sur un fichier.
 * Renvoie le chemin du dossier si une règle matche, sinon `null` —
 * c'est l'appelant qui décide du fallback (mots-clés ou catch-all).
 */
export const folderPathFromBusinessRules = (
  file: File,
  rules: ClassificationRule[],
): string | null => {
  for (const rule of rules) {
    if (
      rule.is_active !== false &&
      matchesFilenamePattern(file.name, rule.filename_pattern) &&
      matchesMimePattern(file, rule.mime_type_pattern)
    ) {
      return folderPathFromRule(file, rule);
    }
  }
  return null;
};
