// Spec pur (npm run test:unit) : logique et affichage du composant DocumentPreviewTab.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test, expect } from '@playwright/test';
import {
  DocumentPreviewTabView,
  UNSUPPORTED_PREVIEW_MESSAGE,
  resolveDocumentPreviewProps,
  type DocumentPreviewTabViewProps,
} from '../../lib/documentPreviewTab';
import type { DocumentPreviewProps } from '../../components/preview/DocumentPreview';

/**
 * Le transpileur JSX de Playwright (`@playwright/test`) produit des descripteurs
 * `{ __pw_type: 'jsx', type, props, key }` pour les fichiers `.tsx`. Ce helper les
 * convertit récursivement en éléments React standards avant `renderToStaticMarkup`.
 */
interface PwJsxNode {
  __pw_type: unknown;
  type: string | React.ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
  key?: React.Key | null;
}

function isPwJsxNode(value: unknown): value is PwJsxNode {
  return typeof value === 'object' && value !== null && '__pw_type' in value;
}

function toReactNode(node: unknown): React.ReactNode {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map((child) => toReactNode(child));
  if (isPwJsxNode(node)) {
    const { children, ...rest } = node.props ?? {};
    if (typeof node.type === 'function') {
      const rendered = (node.type as (p: Record<string, unknown>) => unknown)(node.props ?? {});
      return toReactNode(rendered);
    }
    const reactChildren = Array.isArray(children)
      ? children.map((child) => toReactNode(child))
      : children !== undefined
        ? [toReactNode(children)]
        : [];
    return React.createElement(
      node.type,
      { ...rest, key: node.key ?? undefined },
      ...reactChildren,
    );
  }
  return node as React.ReactNode;
}

function renderTabView(props: DocumentPreviewTabViewProps): string {
  let result: unknown = null;
  const Wrapper: React.FC = () => {
    result = DocumentPreviewTabView(props);
    return null;
  };
  renderToStaticMarkup(React.createElement(Wrapper));
  return renderToStaticMarkup(React.createElement(React.Fragment, null, toReactNode(result)));
}

const samplePdf = {
  id: 'doc-123',
  title: 'Note de service',
  file_type: 'pdf',
  file_path: 'tenants/t1/note.pdf',
  mime_type: 'application/pdf',
};

const sampleZip = {
  id: 'doc-999',
  title: 'Archive scannée',
  file_type: 'zip',
  file_path: 'imports/archive.zip',
  mime_type: 'application/zip',
};

test.describe('Aperçu intégré de la fiche document — logique', () => {
  test('active le chargement uniquement lorsque l’onglet est visible et l’identifiant présent', () => {
    expect(resolveDocumentPreviewProps(samplePdf, true).enabled).toBe(true);
    expect(resolveDocumentPreviewProps(samplePdf, false).enabled).toBe(false);
    expect(resolveDocumentPreviewProps({ ...samplePdf, id: '   ' }, true).enabled).toBe(false);
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
    const zip = resolveDocumentPreviewProps(sampleZip);
    expect(zip.strategyId).toBe('unsupported');
    expect(UNSUPPORTED_PREVIEW_MESSAGE).toBe(
      'Aperçu indisponible pour ce type de fichier : téléchargez-le.',
    );
  });
});

test.describe('Aperçu intégré de la fiche document — affichage du composant', () => {
  test('affiche l’en-tête, le badge de format, le bouton Télécharger et transmet les props à DocumentPreview', () => {
    const captured: DocumentPreviewProps[] = [];
    const StubPreview: React.FC<DocumentPreviewProps> = (props) => {
      captured.push(props);
      const { documentId, filename, enabled } = props;
      return React.createElement('div', {
        'data-testid': 'stub-preview',
        'data-doc-id': documentId,
        'data-filename': filename,
        'data-enabled': String(enabled),
      });
    };

    const onDownload = () => {};
    const html = renderTabView({
      document: samplePdf,
      enabled: true,
      onDownload,
      PreviewRenderer: StubPreview,
    });

    expect(html).toContain('data-testid="document-preview-tab"');
    expect(html).toContain('Aperçu du document');
    expect(html).toContain('>PDF<');
    expect(html).toContain('data-testid="document-preview-download"');
    expect(html).toContain('Télécharger');
    expect(html).toContain('data-testid="stub-preview"');
    expect(html).not.toContain(UNSUPPORTED_PREVIEW_MESSAGE);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      documentId: 'doc-123',
      filename: 'Note de service.pdf',
      mimeType: 'application/pdf',
      enabled: true,
      onDownload,
    });
  });

  test('masque le bouton d’en-tête si onDownload est omis et désactive le chargement quand enabled=false', () => {
    const captured: DocumentPreviewProps[] = [];
    const StubPreview: React.FC<DocumentPreviewProps> = (props) => {
      captured.push(props);
      return null;
    };

    const html = renderTabView({
      document: samplePdf,
      enabled: false,
      PreviewRenderer: StubPreview,
    });

    expect(html).not.toContain('data-testid="document-preview-download"');
    expect(captured).toHaveLength(1);
    expect(captured[0]?.enabled).toBe(false);
  });

  test('affiche le message court en français simple lorsque le format n’est pas pris en charge', () => {
    const StubPreview: React.FC<DocumentPreviewProps> = () => null;
    const html = renderTabView({
      document: sampleZip,
      enabled: true,
      onDownload: () => {},
      PreviewRenderer: StubPreview,
    });

    expect(html).toContain('data-testid="document-preview-unsupported"');
    expect(html).toContain(UNSUPPORTED_PREVIEW_MESSAGE);
    expect(html).toContain('>FILE<');
  });
});
