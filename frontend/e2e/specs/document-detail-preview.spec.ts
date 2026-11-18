import { test, expect } from '../fixtures/auth.fixture';
import { DocumentsPage, UploadDocumentModalPage } from '../pages/documents.page';

function uniqueMinimalPdf(name: string): { name: string; mimeType: string; buffer: Buffer } {
  const stamp = `${Date.now()}-${process.pid}`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj
% E2E ${stamp}
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer << /Size 4 /Root 1 0 R >>
startxref
190
%%EOF
`;
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(pdf) };
}

test.describe('Aperçu dans la fiche document (DocumentDetailModal)', () => {
  test('ouvre la fiche d un PDF et affiche l aperçu sans déclencher de téléchargement', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');

    let downloadTriggered = false;
    page.on('download', () => {
      downloadTriggered = true;
    });

    const docsPage = new DocumentsPage(page);
    await docsPage.goto();
    await docsPage.expectPageVisible();

    const title = `Note-apercu-${Date.now()}`;
    await docsPage.uploadButton.click();
    const uploadModal = new UploadDocumentModalPage(page);
    await uploadModal.fileInput.setInputFiles(uniqueMinimalPdf(`${title}.pdf`));
    await uploadModal.titleInput.fill(title);
    await uploadModal.submitButton.click();
    await expect(uploadModal.submitButton).toBeHidden({ timeout: 15_000 });

    await page.getByText(title).first().click();

    const previewContainer = page.getByTestId('document-detail-preview');
    await expect(previewContainer).toBeVisible();
    const pdfFrame = previewContainer.locator('iframe[title^="Aperçu de "]');
    await expect(pdfFrame).toBeVisible({ timeout: 15_000 });
    await expect(pdfFrame).toHaveAttribute('src', /^blob:/);

    expect(downloadTriggered).toBe(false);
  });
});
