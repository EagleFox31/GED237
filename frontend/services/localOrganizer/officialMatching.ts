import {
  BUSINESS_SYNONYM_GROUPS,
  OFFICIAL_CLASSIFICATION_PLAN,
  type OfficialTarget,
} from './classificationPlan';
import { POUBELLE_TOKENS, REVIEW_MIN_CONFIDENCE } from './constants';
import { tokenizeFilename, tokenizeFilenameNormStrings } from './filenameTokens';
import { getExt, sanitizeFolderSegment, stripExtension } from './paths';
import { compactSubstringScore, levenshtein, tokenAgainstLabelScore } from './scoring';
import { yearInfoForFile } from './filenameYear';
import {
  MAX_TAXONOMY_CANDIDATES_SHOWN,
  listTaxonomyCandidatePathsForLexicon,
  type LocalClassificationLexicon,
  type TaxonomyCandidatePath,
} from './taxonomy';
import { normalize, normalizeCompactAlphaNum } from './text';

let tokenToOfficialMemo: Map<string, OfficialTarget> | null = null;

const getTokenToOfficialTarget = (): Map<string, OfficialTarget> => {
  if (!tokenToOfficialMemo) {
    const map = new Map<string, OfficialTarget>();
    for (const group of BUSINESS_SYNONYM_GROUPS) {
      for (const token of group.tokens) {
        map.set(normalize(token), group.target);
      }
    }
    tokenToOfficialMemo = map;
  }
  return tokenToOfficialMemo;
};

const folderLabelTokens = (label: string): string[] =>
  normalize(label)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !POUBELLE_TOKENS.has(token));

export interface OfficialMatch {
  target: OfficialTarget;
  score: number;
  reasons: string[];
}

/**
 * Score multi-signaux : synonymes métier, expressions, tolérance typo (Levenshtein),
 * présence des libellés du plan officiel (piliers 01–06).
 */
export const scoreOfficialTargetFromFilename = (file: File): OfficialMatch | null => {
  const tokens = tokenizeFilenameNormStrings(file.name);
  const tokenSet = new Set(tokens);
  const hay = normalize(file.name);
  const hayCompact = normalizeCompactAlphaNum(stripExtension(file.name));

  const scoreByTarget = new Map<string, OfficialMatch>();

  const addScore = (target: OfficialTarget, points: number, reason: string) => {
    const key = `${target.domain}/${target.folder}`;
    const prev = scoreByTarget.get(key) ?? { target, score: 0, reasons: [] as string[] };
    prev.score += points;
    prev.reasons.push(reason);
    scoreByTarget.set(key, prev);
  };

  const tokenMap = getTokenToOfficialTarget();

  for (const token of tokens) {
    const exact = tokenMap.get(token);
    if (exact) addScore(exact, 95, `Alias métier détecté : ${token}`);

    for (const [knownToken, target] of tokenMap.entries()) {
      if (token !== knownToken && token.length >= 4 && knownToken.length >= 4) {
        const maxD = token.length <= 6 ? 1 : token.length <= 10 ? 2 : 3;
        const d = levenshtein(token, knownToken);
        if (d <= maxD) {
          addScore(target, 60 - d * 12, `Mot proche détecté : ${token} ≈ ${knownToken}`);
        }
      }
    }
  }

  for (const group of BUSINESS_SYNONYM_GROUPS) {
    const phrases = group.phrases ?? [];
    for (const phrase of phrases) {
      const normPhrase = normalize(phrase);
      const compactPhrase = normalizeCompactAlphaNum(phrase);
      if (hay.includes(normPhrase) || hayCompact.includes(compactPhrase)) {
        addScore(group.target, 130, `Expression métier détectée : ${phrase}`);
      }
    }
  }

  for (const [domain, folders] of Object.entries(OFFICIAL_CLASSIFICATION_PLAN)) {
    const domainCompact = normalizeCompactAlphaNum(domain);
    const domainHit = domainCompact.length >= 6 && hayCompact.includes(domainCompact) ? 18 : 0;

    for (const folder of folders) {
      let score = domainHit;
      const reasons: string[] = [];
      if (domainHit) reasons.push(`Domaine présent dans le nom : ${domain}`);

      const folderCompact = normalizeCompactAlphaNum(folder);
      if (folderCompact.length >= 6 && hayCompact.includes(folderCompact)) {
        score += 100;
        reasons.push(`Libellé officiel détecté : ${folder}`);
      }

      for (const ft of folderLabelTokens(folder)) {
        if (tokenSet.has(ft)) {
          score += 65;
          reasons.push(`Token officiel détecté : ${ft}`);
        }
      }

      if (score > 0) {
        addScore(
          { domain, folder },
          score,
          reasons.join('; ') || `Correspondance officielle : ${folder}`,
        );
      }
    }
  }

  const matches = Array.from(scoreByTarget.values()).sort((a, b) => b.score - a.score);
  const best = matches[0];
  if (!best || best.score < REVIEW_MIN_CONFIDENCE) return null;

  const second = matches[1];
  if (
    second &&
    second.score >= best.score - 8 &&
    `${second.target.domain}/${second.target.folder}` !== `${best.target.domain}/${best.target.folder}`
  ) {
    return {
      ...best,
      score: Math.min(best.score, 74),
      reasons: [
        ...best.reasons,
        `Ambiguïté proche avec ${second.target.domain}/${second.target.folder}`,
      ],
    };
  }

  return best;
};

export const matchOfficialFolderFromFilename = (file: File): { domain: string; folder: string } | null => {
  const m = scoreOfficialTargetFromFilename(file);
  if (!m) return null;
  return { domain: m.target.domain, folder: m.target.folder };
};

/** Infère la clé pilier (01_…) depuis un libellé domaine référentiel GED. */
export const resolveLexiconDomainToOfficialKey = (lexiconDomainName: string): string | null => {
  const hay = normalize(lexiconDomainName.replace(/_/g, ' '));
  const keys = Object.keys(OFFICIAL_CLASSIFICATION_PLAN);
  for (const k of keys) {
    const nk = normalize(k.replace(/_/g, ' '));
    if (hay.includes(nk) || nk.includes(hay)) return k;
  }
  const rules: Array<{ re: RegExp; key: string }> = [
    { re: /jurid|conform|legal|reglement|contentieux/, key: '06_Juridique_Conformite' },
    { re: /rh\b|ressources?\s*humaines|personnel|social|paye|paie/, key: '03_Ressources_Humaines' },
    {
      re: /si\b|systeme|systemes|informatique|numerique|digital|technique|infra|serveur|reseau|cyber|dsi|\bit\b|exploitation/,
      key: '05_Systemes_Information',
    },
    {
      re: /financ|compta|comptabilit|tresor|budget|facture|comptable|fiscal|audit|marche|dao|engagement/,
      key: '02_Finances_Comptabilite',
    },
    {
      re: /projet|migration|cahier|charges?|presentation|agile|livrable|jalon|specification|reporting|risque|recette|test\b/,
      key: '04_Projets_et_Marches',
    },
    {
      re: /admin|general|secretariat|direction|courrier|convention|note|rapport|pilotage|codir|mairi|prefecture|minist/,
      key: '01_Administration_Generale',
    },
  ];
  for (const { re, key } of rules) {
    if (re.test(hay)) return key;
  }
  return null;
};

const MIN_OFFICIAL_FOLDER_SCORE = 24;

/**
 * Score un libellé de dossier officiel (pilier) contre le nom du fichier et
 * le couple domaine/activité référentiel — utilisé par remap et projection lexicon.
 */
export const scoreOfficialLabelAgainstFileContext = (
  folderLabel: string,
  winner: { domainName: string; activityName: string },
  file: File,
): { score: number; reasons: string[] } => {
  const ext = getExt(file.name);
  const stem = ext ? file.name.slice(0, -ext.length) : file.name;
  const hayCompact = normalizeCompactAlphaNum(stem);
  const actCompact = normalizeCompactAlphaNum(winner.activityName);

  let score = compactSubstringScore(hayCompact, folderLabel);
  score += compactSubstringScore(actCompact, folderLabel);
  for (const { norm } of tokenizeFilename(file.name)) {
    score += tokenAgainstLabelScore(norm, folderLabel);
  }
  score += Math.floor(compactSubstringScore(hayCompact, winner.activityName) * 0.2);

  const reasons: string[] = [];
  if (score >= 40) reasons.push(`Fort alignement avec « ${folderLabel} »`);
  else if (score >= MIN_OFFICIAL_FOLDER_SCORE) reasons.push(`Alignement modéré : ${folderLabel}`);
  return { score, reasons };
};

const pickBestOfficialFolderForLexiconRow = (
  domainKey: string,
  winner: { domainName: string; activityName: string },
  file: File,
): { folder: string; score: number; reasons: string[] } | null => {
  const folders = OFFICIAL_CLASSIFICATION_PLAN[domainKey];
  if (!folders?.length) return null;

  let bestFolder: string | null = null;
  let bestScore = -1;
  let bestReasons: string[] = [];

  for (const folder of folders) {
    const { score, reasons } = scoreOfficialLabelAgainstFileContext(folder, winner, file);
    if (score > bestScore) {
      bestScore = score;
      bestFolder = folder;
      bestReasons = reasons;
    }
  }

  if (bestFolder === null || bestScore < MIN_OFFICIAL_FOLDER_SCORE) return null;
  return { folder: bestFolder, score: bestScore, reasons: bestReasons };
};

/** Convertit le meilleur couple référentiel en chemin Domaine/Dossier/Année (segments sanités). */
export const remapTaxonomyWinnerToOfficialPath = (
  winner: { domainName: string; activityName: string },
  file: File,
): string | null => {
  const yearSeg = yearInfoForFile(file).year;

  const domainKey = resolveLexiconDomainToOfficialKey(winner.domainName);
  if (!domainKey) return null;

  const picked = pickBestOfficialFolderForLexiconRow(domainKey, winner, file);
  if (!picked) return null;
  return `${sanitizeFolderSegment(domainKey)}/${sanitizeFolderSegment(picked.folder)}/${yearSeg}`;
};

/**
 * Projette les meilleurs candidats référentiel vers le plan officiel 01–06.
 */
export const computeOfficialLexiconCandidates = (
  file: File,
  lexicon: LocalClassificationLexicon,
): TaxonomyCandidatePath[] => {
  const ranked = listTaxonomyCandidatePathsForLexicon(file, lexicon);
  const out: TaxonomyCandidatePath[] = [];

  for (const row of ranked) {
    if (row.score >= REVIEW_MIN_CONFIDENCE) {
      const domainKey = resolveLexiconDomainToOfficialKey(row.domainName);
      if (domainKey) {
        const picked = pickBestOfficialFolderForLexiconRow(domainKey, row, file);
        if (picked) {
          const yearSeg = yearInfoForFile(file).year;
          const folderPath = `${sanitizeFolderSegment(domainKey)}/${sanitizeFolderSegment(picked.folder)}/${yearSeg}`;
          out.push({
            folderPath,
            score: row.score,
            domainName: row.domainName,
            activityName: row.activityName,
            reasons: [`Référentiel → pilier ${domainKey}`, ...picked.reasons, `Score référentiel ${row.score}`],
          });
        }
      }
    }
  }

  out.sort((a, b) => b.score - a.score || a.folderPath.localeCompare(b.folderPath, 'fr'));
  return out.slice(0, MAX_TAXONOMY_CANDIDATES_SHOWN * 2);
};
