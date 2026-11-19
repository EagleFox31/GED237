// Extrait renvoyé par GET /search (`highlight`, produit par ts_headline avec
// StartSel=<mark>, StopSel=</mark>). Le texte vient du contenu lu dans le scan : il
// n'est jamais interprété comme du HTML. Seuls les marqueurs exacts sont reconnus,
// tout le reste (y compris des balises présentes dans le document) reste du texte.

export interface HighlightPart {
  text: string;
  marked: boolean;
}

const MARKERS = /(<mark>|<\/mark>)/;

export function parseHighlight(raw: string | null | undefined): HighlightPart[] {
  if (!raw) return [];
  const parts: HighlightPart[] = [];
  let marked = false;
  for (const token of raw.split(MARKERS)) {
    if (token === '<mark>') { marked = true; continue; }
    if (token === '</mark>') { marked = false; continue; }
    // Le texte lu dans un scan garde ses retours à la ligne : une seule ligne suffit ici.
    const text = token.replace(/\s+/g, ' ');
    if (text) parts.push({ text, marked });
  }
  return parts;
}

/** L'extrait n'a d'intérêt que s'il montre le mot trouvé (sinon : début du texte, sans rapport). */
export function hasHighlightMatch(parts: HighlightPart[]): boolean {
  return parts.some((part) => part.marked && part.text.trim() !== '');
}
