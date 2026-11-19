// Spec pur (npm run test:unit) : dépôt de plusieurs fichiers en une fois.
import { test, expect } from '@playwright/test';
import { addFiles, uploadedNotice, uploadFailureSummary } from '../../lib/multiUpload';

const MB = 1024 * 1024;
const f = (name: string, size = 1_000, lastModified = 1) => ({ name, size, lastModified });

test.describe('Dépôt groupé (lib/multiUpload)', () => {
  test('les fichiers s ajoutent à la sélection, sans doublon', () => {
    const { files, refused } = addFiles([f('a.pdf')], [f('a.pdf'), f('b.pdf')], 100);
    expect(files.map((x) => x.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(refused).toEqual([]);
  });

  test('deux fichiers de même nom mais différents sont gardés tous les deux', () => {
    expect(addFiles([f('scan.pdf', 10)], [f('scan.pdf', 20)], 100).files).toHaveLength(2);
  });

  test('un fichier trop volumineux est refusé avec son nom, les autres restent', () => {
    const { files, refused } = addFiles([], [f('gros.pdf', 200 * MB), f('ok.pdf')], 100);
    expect(files.map((x) => x.name)).toEqual(['ok.pdf']);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain('gros.pdf');
    expect(refused[0]).toContain('trop volumineux');
  });

  test('la confirmation donne le titre pour un document, le nombre pour plusieurs', () => {
    expect(uploadedNotice([])).toBeNull();
    expect(uploadedNotice(['Note'])).toBe('Document déposé : « Note ».');
    expect(uploadedNotice(['A', 'B', 'C'])).toBe('3 documents déposés.');
  });

  test('les échecs sont listés un par ligne', () => {
    expect(uploadFailureSummary([])).toBeNull();
    const one = uploadFailureSummary([{ name: 'a.pdf', message: 'Erreur réseau.' }]) ?? '';
    expect(one.split('\n')).toEqual(["Ce fichier n'a pas été envoyé :", 'a.pdf : Erreur réseau.']);
    const two = uploadFailureSummary([{ name: 'a.pdf', message: 'x' }, { name: 'b.pdf', message: 'y' }]) ?? '';
    expect(two.split('\n')).toHaveLength(3);
  });
});
