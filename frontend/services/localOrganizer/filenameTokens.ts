import { KEYWORD_STOPWORDS, POUBELLE_TOKENS } from './constants';
import { getExt, stripExtension } from './paths';
import { normalize } from './text';

export interface KeywordToken {
  norm: string;
  raw: string;
}

/** Tokenisation du nom de fichier (sans extension, stopwords, len ≥ 3). */
export const tokenizeFilename = (filename: string): KeywordToken[] => {
  const ext = getExt(filename);
  const stem = ext ? filename.slice(0, -ext.length) : filename;
  const chunks = stem.split(/[^\p{L}]+/u);
  const tokens: KeywordToken[] = [];
  for (const chunk of chunks) {
    if (chunk) {
      const norm = normalize(chunk);
      if (norm.length >= 3 && !KEYWORD_STOPWORDS.has(norm)) {
        tokens.push({ norm, raw: chunk });
      }
    }
  }
  return tokens;
};

/**
 * Jetons normalisés pour le moteur officiel (synonymes + Levenshtein) — len ≥ 2, hors poubelle.
 */
export const tokenizeFilenameNormStrings = (filename: string): string[] =>
  normalize(stripExtension(filename))
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !POUBELLE_TOKENS.has(t));
