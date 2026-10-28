/**
 * Caractères interdits sous Windows / macOS / Linux dans un nom de fichier.
 * On remplace par `_` pour éviter qu'une écriture FSA ou ZIP n'échoue.
 */
export const sanitizeName = (name: string): string =>
  name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'fichier_sans_nom';

export const getExt = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
};

export const stripExtension = (filename: string): string => {
  const ext = getExt(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
};

/**
 * Segment de dossier lisible institutionnel : espaces → underscores (plan 01_…).
 */
export const sanitizeFolderSegment = (raw: string): string => {
  const step = sanitizeName(raw)
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return step.slice(0, 120) || 'Sans_nom';
};

export const sanitizeFolderPath = (path: string): string =>
  path
    .split('/')
    .map((segment) => sanitizeFolderSegment(segment))
    .filter(Boolean)
    .join('/');
