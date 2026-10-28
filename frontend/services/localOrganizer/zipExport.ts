import JSZip from 'jszip';

import type { ArrangedTree } from './arrangement';
import type { LocalWriteProgress, LocalWriteResult } from './fsAccess';

/**
 * Construit un ZIP avec la même arborescence et déclenche le téléchargement.
 * Fallback universel pour les navigateurs sans File System Access API.
 * Retourne le même contrat que `writeArrangedToDirectory` (fichiers OK / erreurs).
 */
export const downloadArrangedAsZip = async (
  tree: ArrangedTree,
  zipName: string,
  onProgress?: (p: LocalWriteProgress) => void,
): Promise<LocalWriteResult> => {
  const zip = new JSZip();
  const errors: Array<{ file: string; error: string }> = [];
  let prepared = 0;

  for (let index = 0; index < tree.files.length; index += 1) {
    const item = tree.files[index]!;
    onProgress?.({ written: index, total: tree.files.length, current: item.file.name });
    try {
      if (item.folderPath) {
        const folder = zip.folder(item.folderPath);
        if (folder) folder.file(item.newName, item.file);
        else zip.file(`${item.folderPath}/${item.newName}`, item.file);
      } else {
        zip.file(item.newName, item.file);
      }
      prepared += 1;
    } catch (err: unknown) {
      errors.push({
        file: item.file.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  onProgress?.({ written: tree.files.length, total: tree.files.length, current: '' });

  try {
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = zipName;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 100);

    return { ok: prepared, errors };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ file: zipName, error: `ZIP : ${msg}` });
    return { ok: 0, errors };
  }
};
