// Comparaison de deux versions d'un document : fonctions pures (sans réseau, sans React).
// Les libellés sont du français simple, pensés pour un agent, pas pour un technicien.

export interface VersionInfo {
  id?: string;
  version_number: string;
  uploaded_at?: string | null;
  uploaded_by_name?: string | null;
  change_note?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  checksum_sha256?: string | null;
}

export type FieldChange = {
  key: 'size' | 'type' | 'note' | 'author' | 'date';
  label: string;
  before: string;
  after: string;
  /** false : la valeur est identique, la ligne est quand même montrée pour rassurer. */
  changed: boolean;
};

const KIB = 1024;

export const formatSize = (bytes?: number | null): string => {
  if (bytes == null) return '—';
  if (bytes < KIB) return `${bytes} o`;
  if (bytes < KIB * KIB) return `${(bytes / KIB).toFixed(1).replace('.', ',')} Ko`;
  return `${(bytes / (KIB * KIB)).toFixed(1).replace('.', ',')} Mo`;
};

const TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'text/plain': 'Texte',
  'image/png': 'Image PNG',
  'image/jpeg': 'Image JPEG',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
};

export const typeLabel = (mime?: string | null): string => (mime ? TYPE_LABELS[mime] ?? mime : '—');

const dateLabel = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
};

/** Ordre stable : l'ancienne version à gauche, la plus récente à droite (par numéro, puis par date). */
export const orderVersions = <T extends VersionInfo>(a: T, b: T): [T, T] => {
  const [ta, tb] = [Date.parse(a.uploaded_at ?? ''), Date.parse(b.uploaded_at ?? '')];
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta < tb ? [a, b] : [b, a];
  return a.version_number.localeCompare(b.version_number, undefined, { numeric: true }) <= 0 ? [a, b] : [b, a];
};

export const compareMetadata = (before: VersionInfo, after: VersionInfo): FieldChange[] => {
  const row = (key: FieldChange['key'], label: string, b: string, a: string): FieldChange =>
    ({ key, label, before: b, after: a, changed: b !== a });

  return [
    row('size', 'Taille', formatSize(before.file_size), formatSize(after.file_size)),
    row('type', 'Type de fichier', typeLabel(before.mime_type), typeLabel(after.mime_type)),
    row('note', 'Note de version', before.change_note?.trim() || '—', after.change_note?.trim() || '—'),
    row('author', 'Mis en ligne par', before.uploaded_by_name || 'Système', after.uploaded_by_name || 'Système'),
    row('date', 'Date', dateLabel(before.uploaded_at), dateLabel(after.uploaded_at)),
  ];
};

/** Phrase de synthèse : dit tout de suite si le fichier a changé. */
export const contentSummary = (before: VersionInfo, after: VersionInfo): string => {
  if (!before.checksum_sha256 || !after.checksum_sha256) return 'Impossible de dire si le fichier a changé.';
  return before.checksum_sha256 === after.checksum_sha256
    ? 'Le fichier est identique dans les deux versions.'
    : 'Le fichier a changé entre les deux versions.';
};
