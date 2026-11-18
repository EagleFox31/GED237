// Spec pur (npm run test:unit) : préparation de l'aperçu intégré d'une fiche document.
import { test, expect } from '@playwright/test';
import {
  UNSUPPORTED_PREVIEW_MESSAGE,
  resolveDocumentPreviewProps,
} from '../../lib/documentPreviewTab';

test.describe('Aperçu intégré de la fiche document', () => {
  test('active le chargement uniquement lorsque l’onglet est visible et l’identifiant présent', () => {
    const doc = {
      id: 'doc-123',
      title: 'Note de service',
      file_type: 'pdf',
      file_path: 'tenants/t1/note.pdf',
      mime_type: 'application/pdf',
    };

    expect(resolveDocumentPreviewProps(doc, true).enabled).toBe(true);
    expect(resolveDocumentPreviewProps(doc, false).enabled).toBe(false);
    expect(resolveDocumentPreviewProps({ ...doc, id: '   ' }, true).enabled).toBe(false);
  });

  test('reconstruit le nom de fichier avec extension pour résoudre la stratégie d’aperçu', () => {
    const pdfWithoutMime = resolveDocumentPreviewProps({
      id: 'doc-1',
      title: 'Budget 2026',
      file_type: 'pdf',
      file_path: 'x/y/budget.pdf',
    });
    expect(pdfWithoutMime.filename).toBe('Budget 2026.pdf');
    expect(pdfWithoutMime.strategyId).toBe('pdf');

    const docxFromPath = resolveDocumentPreviewProps({
      id: 'doc-2',
      title: 'Rapport annuel',
      file_type: null,
      file_path: 'archives/rapport.docx',
    });
    expect(docxFromPath.filename).toBe('Rapport annuel.docx');
    expect(docxFromPath.strategyId).toBe('docx');

    const xlsxFromType = resolveDocumentPreviewProps({
      id: 'doc-3',
      title: 'Effectifs',
      file_type: 'xlsx',
      file_path: 'rh/effectifs.xlsx',
    });
    expect(xlsxFromType.filename).toBe('Effectifs.xlsx');
    expect(xlsxFromType.strategyId).toBe('xlsx');

    const imageFromMime = resolveDocumentPreviewProps({
      id: 'doc-4',
      title: 'Scan tampon',
      file_type: 'png',
      file_path: 'scans/tampon.png',
      mime_type: 'image/png',
    });
    expect(imageFromMime.strategyId).toBe('image');
  });

  test('retombe sur la stratégie non prise en charge pour une archive ou un format inconnu', () => {
    const zip = resolveDocumentPreviewProps({
      id: 'doc-5',
      title: 'Lot scanné',
      file_type: 'zip',
      file_path: 'imports/lot.zip',
      mime_type: 'application/zip',
    });
    expect(zip.strategyId).toBe('unsupported');
    expect(UNSUPPORTED_PREVIEW_MESSAGE).toBe(
      'Aperçu indisponible pour ce type de fichier : téléchargez-le.',
    );
  });
});
