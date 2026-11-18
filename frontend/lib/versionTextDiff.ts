// Diff de texte entre deux versions, calculé dans le navigateur.
// Les bibliothèques (diff, pdfjs-dist) sont chargées à la demande : le bundle principal ne grossit pas.

export type TextDiffLine = { kind: 'same' | 'added' | 'removed'; text: string };

const toLines = (value: string): string[] => {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return value === '' ? [] : lines;
};

/** Comparaison ligne à ligne. */
export const diffText = async (before: string, after: string): Promise<TextDiffLine[]> => {
  const { diffArrays } = await import('diff');
  return diffArrays(toLines(before), toLines(after)).flatMap((part) => {
    const kind = part.added ? 'added' : part.removed ? 'removed' : 'same';
    return part.value.map((text) => ({ kind, text }) as TextDiffLine);
  });
};

export const textDiffSummary = (lines: TextDiffLine[]): string => {
  const added = lines.filter((l) => l.kind === 'added').length;
  const removed = lines.filter((l) => l.kind === 'removed').length;
  if (added === 0 && removed === 0) return 'Le texte est identique.';
  const count = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;
  return `${count(added, 'ligne ajoutée', 'lignes ajoutées')}, ${count(removed, 'ligne retirée', 'lignes retirées')}.`;
};

/** Texte d'un PDF (couche texte). Chaîne vide pour un scan : l'appelant bascule alors sur la vue visuelle. */
export const extractPdfText = async (data: ArrayBuffer): Promise<string> => {
  const pdfjs = await import('pdfjs-dist');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), disableWorker: true } as never).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' ').trim());
  }
  return pages.join('\n').trim();
};
