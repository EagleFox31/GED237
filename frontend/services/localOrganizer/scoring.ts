import { normalize, normalizeCompactAlphaNum } from './text';

/** Score minimal pour accepiter un couple domaine / activité du référentiel. */
export const MIN_TAXONOMY_MATCH_SCORE = 14;

/** Score minimal pour accepter un couple domaine/dossier institutionnel depuis le nom du fichier. */
export const OFFICIAL_MATCH_MIN_SCORE = 46;

export const compactSubstringScore = (hayCompact: string, label: string): number => {
  const lc = normalizeCompactAlphaNum(label);
  if (lc.length < 2) return 0;
  if (!hayCompact.includes(lc)) return 0;
  return 14 + Math.min(lc.length, 28);
};

export const tokenAgainstLabelScore = (tokenNorm: string, label: string): number => {
  const lc = normalizeCompactAlphaNum(label);
  if (lc.length < 2) return 0;
  if (tokenNorm.length >= 3 && lc.includes(tokenNorm)) return 12 + tokenNorm.length;
  if (tokenNorm.length >= 4 && tokenNorm.includes(lc)) return 10 + lc.length;
  if (tokenNorm.length === 2 && lc === tokenNorm) return 11;
  return 0;
};

export const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) {
    const row = dp[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= n; j += 1) {
    const row0 = dp[0];
    if (row0) row0[j] = j;
  }
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const up = dp[i - 1]?.[j];
      const left = dp[i]?.[j - 1];
      const diag = dp[i - 1]?.[j - 1];
      const row = dp[i];
      if (row && up !== undefined && left !== undefined && diag !== undefined) {
        row[j] = Math.min(up + 1, left + 1, diag + cost);
      }
    }
  }
  return dp[m]?.[n] ?? n + m;
};

/** Mots grammaticaux dans les libellés officiels (« Fiches de paie », « X_et_Y », …). */
const LABEL_STOPWORDS = new Set(['de', 'la', 'le', 'des', 'du', 'les', 'un', 'une', 'd', 'et']);

export const folderLabelWordNorms = (folderLabel: string): string[] =>
  normalize(folderLabel.replace(/_/g, ' '))
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !LABEL_STOPWORDS.has(w));
