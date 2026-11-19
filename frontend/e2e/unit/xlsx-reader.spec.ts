import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

import { PREVIEW_MAX_ROWS } from '../../components/preview/previewLimits';
import { listSheets, readSheet } from '../../components/preview/xlsxReader';

/** Classeur : « Budget » (en-tête + 599 lignes) et « Résumé » (3 lignes). */
function workbook(): ArrayBuffer {
  const book = XLSX.utils.book_new();
  const rows = [['Ligne', 'Montant'], ...Array.from({ length: 599 }, (_, i) => [`L${i + 1}`, i * 10])];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Budget');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Total'], [5990], ['fin']]), 'Résumé');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** Module XLSX qui garde le classeur renvoyé par chaque `read`, pour voir ce qui a été lu. */
function recording(): { lib: typeof XLSX; books: XLSX.WorkBook[] } {
  const books: XLSX.WorkBook[] = [];
  const lib = {
    ...XLSX,
    read: (data: unknown, opts?: XLSX.ParsingOptions) => {
      const book = XLSX.read(data, opts);
      books.push(book);
      return book;
    },
  } as typeof XLSX;
  return { lib, books };
}

test.describe('xlsxReader', () => {
  test('la liste des onglets ne lit aucune cellule', () => {
    const { lib, books } = recording();
    expect(listSheets(lib, workbook())).toEqual(['Budget', 'Résumé']);
    expect(Object.keys(books[0]?.Sheets ?? {})).toEqual([]);
  });

  test('seul l’onglet affiché est lu ; les autres ne le sont pas', () => {
    const { lib, books } = recording();
    expect(readSheet(lib, workbook(), 'Résumé')?.['!ref']).toBe('A1:A3');
    expect(books).toHaveLength(1);
    expect(Object.keys(books[0]!.Sheets)).toEqual(['Résumé']);
  });

  test('l’onglet géant est plafonné, sa taille réelle reste connue', () => {
    const sheet = readSheet(XLSX, workbook(), 'Budget');
    expect(sheet?.['!ref']).toBe(`A1:B${PREVIEW_MAX_ROWS}`);
    expect(sheet?.['!fullref']).toBe('A1:B600');
  });
});
