// Dépôt de plusieurs fichiers en une fois (audit « parcours réel du fonctionnaire ») : logique pure du
// formulaire de dépôt, testée sans navigateur.
import { fileTooLargeMessage } from './uploadFeedback';

/** Ce qu'il faut d'un fichier pour le trier (File en a davantage). */
export interface PickableFile {
  name: string;
  size: number;
  lastModified: number;
}

const sameFile = (a: PickableFile, b: PickableFile) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Ajoute les fichiers choisis à la sélection : un fichier trop volumineux est refusé tout de suite
 * (avec son nom), un fichier déjà présent n'est pas ajouté deux fois.
 */
export function addFiles<F extends PickableFile>(
  current: F[],
  incoming: F[],
  maxMb: number,
): { files: F[]; refused: string[] } {
  const files = [...current];
  const refused: string[] = [];
  for (const f of incoming) {
    const tooLarge = fileTooLargeMessage(f.size, maxMb);
    if (tooLarge) refused.push(`${f.name} : ${tooLarge}`);
    else if (!files.some((kept) => sameFile(kept, f))) files.push(f);
  }
  return { files, refused };
}

/** Confirmation après un dépôt : le titre s'il n'y a qu'un document, sinon leur nombre. */
export function uploadedNotice(titles: string[]): string | null {
  if (titles.length === 0) return null;
  if (titles.length === 1) return `Document déposé : « ${titles[0]} ».`;
  return `${titles.length} documents déposés.`;
}

/** Échecs d'un dépôt groupé : un par ligne, les fichiers concernés restent dans le formulaire. */
export function uploadFailureSummary(failures: { name: string; message: string }[]): string | null {
  if (failures.length === 0) return null;
  const head = failures.length === 1
    ? "Ce fichier n'a pas été envoyé :"
    : `Ces ${failures.length} fichiers n'ont pas été envoyés :`;
  return [head, ...failures.map((f) => `${f.name} : ${f.message}`)].join('\n');
}
