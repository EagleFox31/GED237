import {
  buildArrangementManifestCsv,
  buildArrangementManifestJson,
  type ArrangedTree,
} from './arrangement';
import { getExt, sanitizeName } from './paths';

/** Chromium File System Access — absent des libs TS par défaut sur certains setups. */
type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
  };

/** Détecte la disponibilité de la File System Access API (Chrome / Edge). */
export const supportsFileSystemAccess = (): boolean =>
  typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';

export interface LocalWriteProgress {
  written: number;
  total: number;
  current: string;
}

export interface LocalWriteResult {
  ok: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * Demande à l'utilisateur de choisir un dossier de destination (Chromium uniquement).
 * Retourne `null` si l'utilisateur a annulé ou si l'API n'est pas disponible.
 */
export const pickLocalDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!supportsFileSystemAccess()) return null;
  try {
    return await (window as DirectoryPickerWindow).showDirectoryPicker!({ mode: 'readwrite' });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
};

const fileExists = async (dir: FileSystemDirectoryHandle, name: string): Promise<boolean> => {
  try {
    await dir.getFileHandle(name, { create: false });
    return true;
  } catch {
    return false;
  }
};

const ensureUniqueName = async (dir: FileSystemDirectoryHandle, desired: string): Promise<string> => {
  if (!(await fileExists(dir, desired))) return desired;
  const ext = getExt(desired);
  const stem = ext ? desired.slice(0, -ext.length) : desired;
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${stem} (${i})${ext}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await fileExists(dir, candidate))) return candidate;
  }
  return `${stem}_${Date.now()}${ext}`;
};

/**
 * Écrit l'arborescence préparée dans le dossier choisi, en créant les
 * sous-dossiers nécessaires et en évitant l'écrasement (suffixe `(1)`,
 * `(2)`… si un fichier de même nom existe déjà).
 */
export const writeArrangedToDirectory = async (
  rootDir: FileSystemDirectoryHandle,
  tree: ArrangedTree,
  onProgress?: (p: LocalWriteProgress) => void,
): Promise<LocalWriteResult> => {
  const dirCache = new Map<string, FileSystemDirectoryHandle>();

  const ensureDir = async (path: string): Promise<FileSystemDirectoryHandle> => {
    if (path === '') return rootDir;
    if (dirCache.has(path)) return dirCache.get(path)!;
    const segments = path.split('/').filter(Boolean);
    let current: FileSystemDirectoryHandle = rootDir;
    for (const segment of segments) {
      const safeSegment = sanitizeName(segment);
      // eslint-disable-next-line no-await-in-loop
      current = await current.getDirectoryHandle(safeSegment, { create: true });
    }
    dirCache.set(path, current);
    return current;
  };

  let ok = 0;
  const errors: Array<{ file: string; error: string }> = [];

  for (let index = 0; index < tree.files.length; index += 1) {
    const item = tree.files[index]!;
    onProgress?.({ written: index, total: tree.files.length, current: item.file.name });
    try {
      // eslint-disable-next-line no-await-in-loop
      const dir = await ensureDir(item.folderPath);
      // eslint-disable-next-line no-await-in-loop
      const finalName = await ensureUniqueName(dir, item.newName);
      // eslint-disable-next-line no-await-in-loop
      const fileHandle = await dir.getFileHandle(finalName, { create: true });
      // eslint-disable-next-line no-await-in-loop
      const writable = await fileHandle.createWritable();
      // eslint-disable-next-line no-await-in-loop
      await writable.write(item.file);
      // eslint-disable-next-line no-await-in-loop
      await writable.close();
      ok += 1;
    } catch (err: unknown) {
      errors.push({
        file: item.file.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  onProgress?.({ written: tree.files.length, total: tree.files.length, current: '' });
  return { ok, errors };
};

/**
 * Écrit un manifeste JSON ou CSV à la racine du dossier d’écriture (FSA uniquement).
 */
export const writeManifestToDirectory = async (
  rootDir: FileSystemDirectoryHandle,
  tree: ArrangedTree,
  format: 'json' | 'csv',
): Promise<void> => {
  const fileName = format === 'json' ? 'arrangement_manifest.json' : 'arrangement_manifest.csv';
  const payload =
    format === 'json' ? buildArrangementManifestJson(tree) : buildArrangementManifestCsv(tree);
  const fh = await rootDir.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  await w.write(payload);
  await w.close();
};
