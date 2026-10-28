/** Normalisation pour matching local : casse, accents, apostrophes, séparateurs. */
export const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Chaîne normalisée sans séparateurs — pour tolérer espaces / underscores dans les noms de fichiers. */
export const normalizeCompactAlphaNum = (text: string): string =>
  normalize(text).replace(/[^a-z0-9]+/g, '');
