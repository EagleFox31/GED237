// Spec pur (npm run test:unit) : ce que montre le bloc « Texte reconnu » selon la réponse de GET /ocr (#276).
import { test, expect } from '@playwright/test';
import { FAILED_MESSAGES, READING_GIVE_UP_MS, RECOGNIZED_TEXT_MESSAGES, recognizedTextView } from '../../lib/recognizedText';
import type { DocumentOcr } from '../../services/resources/documents.api';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const ocr = (patch: Partial<DocumentOcr>): DocumentOcr => ({
  document_id: 'd1',
  ocr_content: null,
  ocr_confidence: null,
  ocr_status: 'not_processed',
  ...patch,
});

test.describe('Texte reconnu : affichage selon l’état de lecture', () => {
  test('texte lu : affiché sans espaces autour, sûr sans confiance', () => {
    expect(recognizedTextView(ocr({ ocr_status: 'completed', ocr_content: '  Arrêté\nn° 12  ' }), undefined, NOW)).toEqual({
      kind: 'text',
      text: 'Arrêté\nn° 12',
      uncertain: false,
    });
  });

  test('lecture incertaine : seulement si le serveur le dit (aucun seuil côté écran)', () => {
    const read = (patch: Partial<DocumentOcr>) =>
      recognizedTextView(ocr({ ocr_status: 'completed', ocr_content: 'x', ...patch }), undefined, NOW);
    expect(read({ low_confidence: true })).toMatchObject({ uncertain: true });
    expect(read({ low_confidence: false, ocr_confidence: 0.1 })).toMatchObject({ uncertain: false });
    expect(read({ ocr_confidence: 0.1 })).toMatchObject({ uncertain: false });
  });

  test('échec : un message par raison, jamais le texte du serveur', () => {
    const failed = (ocr_error?: string | null) => recognizedTextView(ocr({ ocr_status: 'failed', ocr_error }), undefined, NOW);
    for (const [reason, message] of Object.entries(FAILED_MESSAGES)) {
      expect(failed(reason)).toEqual({ kind: 'message', message });
    }
    expect(failed(null)).toEqual({ kind: 'message', message: RECOGNIZED_TEXT_MESSAGES.failed });
    expect(failed('Tesseract crashed: SIGSEGV')).toEqual({ kind: 'message', message: RECOGNIZED_TEXT_MESSAGES.failed });
  });

  test('texte lu mais vide : aucun texte lisible', () => {
    expect(recognizedTextView(ocr({ ocr_status: 'completed', ocr_content: '  \n ' }), undefined, NOW)).toEqual({
      kind: 'message',
      message: RECOGNIZED_TEXT_MESSAGES.empty,
    });
  });

  test('en cours (ancien document sans état d’échec) : attente, puis échec au-delà de 24 h après le dépôt', () => {
    const uploaded = (msAgo: number) => new Date(NOW - msAgo).toISOString();
    const processing = ocr({ ocr_status: 'processing' });
    expect(recognizedTextView(processing, uploaded(READING_GIVE_UP_MS), NOW)).toEqual({
      kind: 'message',
      message: RECOGNIZED_TEXT_MESSAGES.processing,
    });
    expect(recognizedTextView(processing, uploaded(READING_GIVE_UP_MS + 1), NOW)).toEqual({
      kind: 'message',
      message: RECOGNIZED_TEXT_MESSAGES.failed,
    });
    // Date de dépôt inconnue ou illisible : on reste sur l'attente.
    expect(recognizedTextView(processing, 'pas une date', NOW)).toMatchObject({ message: RECOGNIZED_TEXT_MESSAGES.processing });
  });

  test('pas de lecture pour ce type de fichier', () => {
    expect(recognizedTextView(ocr({}), undefined, NOW)).toEqual({ kind: 'message', message: RECOGNIZED_TEXT_MESSAGES.notProcessed });
  });
});
