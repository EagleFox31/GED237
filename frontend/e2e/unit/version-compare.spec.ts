import { test, expect } from '@playwright/test';
import {
  compareMetadata, contentSummary, formatSize, orderVersions,
  type VersionInfo,
} from '../../lib/versionCompare';

// Spec pur (sans navigateur ni pile) : exécuté par `npm run test:unit`.

const v = (over: Partial<VersionInfo>): VersionInfo => ({
  version_number: '1.0', uploaded_at: '2026-11-01T08:00:00Z', uploaded_by_name: 'Awa',
  change_note: null, file_size: 1024, mime_type: 'application/pdf', checksum_sha256: 'aaa', ...over,
});

test.describe('Comparaison de deux versions', () => {
  test('formatSize : octets, Ko, Mo, inconnu', () => {
    expect(formatSize(0)).toBe('0 o');
    expect(formatSize(1536)).toBe('1,5 Ko');
    expect(formatSize(5 * 1024 * 1024)).toBe('5,0 Mo');
    expect(formatSize(null)).toBe('—');
  });

  test('orderVersions : la plus ancienne à gauche, quel que soit l\'ordre de choix', () => {
    const old = v({ version_number: '1.0', uploaded_at: '2026-11-01T08:00:00Z' });
    const recent = v({ version_number: '1.1', uploaded_at: '2026-11-02T08:00:00Z' });
    expect(orderVersions(recent, old)).toEqual([old, recent]);
    expect(orderVersions(old, recent)).toEqual([old, recent]);
  });

  test('orderVersions : à date égale, le numéro tranche (1.10 après 1.2)', () => {
    const a = v({ version_number: '1.10' });
    const b = v({ version_number: '1.2' });
    expect(orderVersions(a, b)[1].version_number).toBe('1.10');
  });

  test('compareMetadata : marque seulement ce qui change', () => {
    const rows = compareMetadata(v({}), v({ file_size: 2048, change_note: 'Correction', uploaded_by_name: 'Paul' }));
    const changed = rows.filter((r) => r.changed).map((r) => r.key).sort();
    expect(changed).toEqual(['author', 'note', 'size']);
    expect(rows.find((r) => r.key === 'size')).toMatchObject({ before: '1,0 Ko', after: '2,0 Ko' });
    expect(rows.find((r) => r.key === 'note')?.before).toBe('—');
  });

  test('contentSummary : empreinte égale, différente ou absente', () => {
    expect(contentSummary(v({}), v({}))).toBe('Le fichier est identique dans les deux versions.');
    expect(contentSummary(v({}), v({ checksum_sha256: 'bbb' }))).toBe('Le fichier a changé entre les deux versions.');
    expect(contentSummary(v({}), v({ checksum_sha256: null }))).toBe('Impossible de dire si le fichier a changé.');
  });
});
