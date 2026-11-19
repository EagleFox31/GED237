import { test, expect } from '@playwright/test';
import { downloadName } from '../../lib/downloadName';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Nom du fichier téléchargé', () => {
  test('ajoute l\'extension du type quand le titre n\'en a pas', () => {
    expect(downloadName({ title: 'Budget 2026', file_type: 'pdf' })).toBe('Budget 2026.pdf');
  });
  test('ne double pas l\'extension', () => {
    expect(downloadName({ title: 'note.PDF', file_type: 'pdf' })).toBe('note.PDF');
  });
  test('ignore un type qui ne ressemble pas à une extension (sous-type MIME)', () => {
    expect(downloadName({ title: 'Scan', file_type: 'octet-stream', file_path: 'x/scan.pdf' })).toBe('Scan.pdf');
    expect(downloadName({ title: 'Scan', file_type: 'vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('Scan');
  });
  test('retombe sur l\'extension du chemin stocké, puis sur le titre seul', () => {
    expect(downloadName({ title: 'Courrier', file_type: null, file_path: 'a/b/c.docx' })).toBe('Courrier.docx');
    expect(downloadName({ title: 'Courrier' })).toBe('Courrier');
    expect(downloadName({ title: '  ' })).toBe('document');
  });
});
