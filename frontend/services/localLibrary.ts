/**
 * Bibliothèque locale du rangement « sur poste ».
 *
 * Quand l'utilisateur range des fichiers via le mode local, on persiste un
 * petit manifeste (sans contenu de fichier — juste les noms et chemins) dans
 * IndexedDB du navigateur. Le dernier rangement peut en plus être copié
 * sur le compte utilisateur (API `/usage/local-arrangement-snapshot`) pour la
 * bibliothèque multi-appareils ; cette couche serveur est opt-in côté produit.
 */

const DB_NAME = 'ged237_local_library';
const DB_VERSION = 2;
const STORE_RUNS = 'runs';
/** Poignées `FileSystemDirectoryHandle` (Chrome / Edge) pour relancer sans nouveau sélecteur. */
const STORE_DEST_HANDLES = 'destination_handles';

/** Aligné sur `sanitizeName` dans `services/localOrganizer/paths.ts` (segments de chemin à l’écriture FSA). */
const sanitizeFsSegment = (name: string): string =>
  name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .slice(0, 200) || 'fichier_sans_nom';

/** Même logique que `DirectoryIngestion` pour le sous-dossier « regroupement ». */
export const computeLocalLibraryWrapperDirName = (wrapper: string | null | undefined): string | null => {
  const trimmed = (wrapper || '').trim();
  if (!trimmed) return null;
  const safeWrapper = trimmed
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return safeWrapper || null;
};

export interface LocalLibraryFileEntry {
  /** Nom du fichier (final, après sanitisation et déduplication). */
  name: string;
  /** Chemin du dossier dans la destination, ex. "Marchés/2024". */
  folder_path: string;
  /** Taille en octets — utile pour ré-identifier un fichier. */
  size: number;
  /** Date de modification (epoch ms) — idem. */
  last_modified: number;
}

export interface LocalLibraryRun {
  id: string;
  /** Epoch ms de la fin du run. */
  created_at: number;
  /** Nom du dossier racine choisi (ou nom de l'archive ZIP). */
  destination: string;
  /** Sous-dossier de regroupement créé dans la destination, le cas échéant. */
  wrapper: string | null;
  /** Stratégie utilisée (cf. `LocalArrangementStrategy`). */
  strategy: string;
  /** Mode d'écriture : direct sur le poste ou archive ZIP téléchargée. */
  mode: 'fsa' | 'zip';
  files: LocalLibraryFileEntry[];
  /** Compteurs cachés pour affichage rapide en liste. */
  total_files: number;
  total_folders: number;
  files_unranged: number;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible dans cet environnement.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RUNS)) {
        const store = db.createObjectStore(STORE_RUNS, { keyPath: 'id' });
        store.createIndex('created_at', 'created_at');
      }
      if (!db.objectStoreNames.contains(STORE_DEST_HANDLES)) {
        db.createObjectStore(STORE_DEST_HANDLES, { keyPath: 'runId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Ouverture IndexedDB refusée.'));
  });

/** Test de disponibilité — utile pour griser l'UI dans des modes restrictifs. */
export const isLocalLibraryAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return typeof window.indexedDB !== 'undefined';
  } catch {
    return false;
  }
};

const generateRunId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const newRunId = generateRunId;

export const getLibraryRun = async (id: string): Promise<LocalLibraryRun | null> => {
  const db = await openDb();
  const run = await new Promise<LocalLibraryRun | null>((resolve, reject) => {
    const tx = db.transaction(STORE_RUNS, 'readonly');
    const req = tx.objectStore(STORE_RUNS).get(id);
    req.onsuccess = () => resolve((req.result as LocalLibraryRun | undefined) ?? null);
    req.onerror = () => reject(req.error || new Error('Lecture IndexedDB échouée.'));
  });
  db.close();
  return run;
};

/** À appeler après un rangement FSA réussi : même racine que « Choisir un dossier ». */
export const saveLibraryDestinationHandle = async (
  runId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_DEST_HANDLES, 'readwrite');
    tx.objectStore(STORE_DEST_HANDLES).put({ runId, handle });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Écriture poignée dossier échouée.'));
    tx.onabort = () => reject(tx.error || new Error('Transaction IndexedDB interrompue.'));
  });
  db.close();
};

export const getLibraryDestinationHandle = async (
  runId: string,
): Promise<FileSystemDirectoryHandle | null> => {
  const db = await openDb();
  const row = await new Promise<{ handle?: FileSystemDirectoryHandle } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_DEST_HANDLES, 'readonly');
    const req = tx.objectStore(STORE_DEST_HANDLES).get(runId);
    req.onsuccess = () => resolve(req.result as { handle?: FileSystemDirectoryHandle } | undefined);
    req.onerror = () => reject(req.error || new Error('Lecture poignée dossier échouée.'));
  });
  db.close();
  return row?.handle ?? null;
};

/**
 * Relit les fichiers réels sous la racine choisie lors du rangement (+ wrapper), dans l’ordre du manifeste.
 */
export const loadLibraryFilesFromFsaDestination = async (
  destinationRoot: FileSystemDirectoryHandle,
  wrapper: string | null | undefined,
  entries: LocalLibraryFileEntry[],
): Promise<File[]> => {
  let base: FileSystemDirectoryHandle = destinationRoot;
  const wrap = computeLocalLibraryWrapperDirName(wrapper);
  if (wrap) {
    base = await destinationRoot.getDirectoryHandle(wrap);
  }
  const out: File[] = [];
  for (const entry of entries) {
    let dir = base;
    if (entry.folder_path?.trim()) {
      const segments = entry.folder_path.split('/').filter(Boolean);
      for (const seg of segments) {
        const safe = sanitizeFsSegment(seg);
        // eslint-disable-next-line no-await-in-loop
        dir = await dir.getDirectoryHandle(safe);
      }
    }
    // eslint-disable-next-line no-await-in-loop
    const fh = await dir.getFileHandle(entry.name);
    // eslint-disable-next-line no-await-in-loop
    const file = await fh.getFile();
    out.push(file);
  }
  return out;
};

export const saveLibraryRun = async (run: LocalLibraryRun): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_RUNS, 'readwrite');
    tx.objectStore(STORE_RUNS).put(run);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Écriture IndexedDB échouée.'));
    tx.onabort = () => reject(tx.error || new Error('Transaction IndexedDB interrompue.'));
  });
  db.close();
};

/** Liste les runs (les plus récents en tête). */
export const listLibraryRuns = async (): Promise<LocalLibraryRun[]> => {
  const db = await openDb();
  const runs = await new Promise<LocalLibraryRun[]>((resolve, reject) => {
    const tx = db.transaction(STORE_RUNS, 'readonly');
    const req = tx.objectStore(STORE_RUNS).getAll();
    req.onsuccess = () => resolve((req.result || []) as LocalLibraryRun[]);
    req.onerror = () => reject(req.error || new Error('Lecture IndexedDB échouée.'));
  });
  db.close();
  runs.sort((a, b) => b.created_at - a.created_at);
  return runs;
};

export const deleteLibraryRun = async (id: string): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_RUNS, STORE_DEST_HANDLES], 'readwrite');
    tx.objectStore(STORE_RUNS).delete(id);
    tx.objectStore(STORE_DEST_HANDLES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Suppression IndexedDB échouée.'));
  });
  db.close();
};

export const clearLocalLibrary = async (): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_RUNS, STORE_DEST_HANDLES], 'readwrite');
    tx.objectStore(STORE_RUNS).clear();
    tx.objectStore(STORE_DEST_HANDLES).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Effacement IndexedDB échoué.'));
  });
  db.close();
};

// ───────────────────────────────────────────────────────────────────────────
// Recherche bibliothécaire — match sur le nom du fichier ET sur le chemin
// du dossier (pour qu'une recherche par sujet retourne aussi tous les
// fichiers rangés dans un dossier de ce sujet).
// ───────────────────────────────────────────────────────────────────────────

export interface LocalLibrarySearchHit {
  run: LocalLibraryRun;
  file: LocalLibraryFileEntry;
  /** Score de pertinence simple (nb de tokens matchés × bonus nom) — pour tri. */
  score: number;
}

const normalizeForSearch = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Recherche full-text simple, en mémoire, sur tous les runs déjà chargés.
 *  - Les tokens de la requête sont AND-és (« devis 2024 » = devis ET 2024).
 *  - Un match dans le nom du fichier vaut plus qu'un match dans le chemin
 *    de dossier — pour mettre les fichiers évidents en haut.
 *  - Tronqué à `limit` résultats pour ne pas geler l'UI.
 */
export const searchLocalLibrary = (
  runs: LocalLibraryRun[],
  query: string,
  limit = 300,
): LocalLibrarySearchHit[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const q = normalizeForSearch(trimmed);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const hits: LocalLibrarySearchHit[] = [];
  for (const run of runs) {
    for (const file of run.files) {
      const nameNorm = normalizeForSearch(file.name);
      const pathNorm = normalizeForSearch(file.folder_path);
      let allMatch = true;
      let score = 0;
      for (const token of tokens) {
        const inName = nameNorm.includes(token);
        const inPath = pathNorm.includes(token);
        if (!inName && !inPath) {
          allMatch = false;
          break;
        }
        score += inName ? 2 : 1;
      }
      if (allMatch) {
        hits.push({ run, file, score });
        if (hits.length >= limit * 2) break; // garde-fou
      }
    }
    if (hits.length >= limit * 2) break;
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.run.created_at - a.run.created_at;
  });
  return hits.slice(0, limit);
};
