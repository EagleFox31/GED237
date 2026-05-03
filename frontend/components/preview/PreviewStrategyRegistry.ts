import type { PreviewSource, PreviewStrategy } from './types';
import { pdfStrategy } from './strategies/PdfStrategy';
import { imageStrategy } from './strategies/ImageStrategy';
import { docxStrategy } from './strategies/DocxStrategy';
import { xlsxStrategy } from './strategies/XlsxStrategy';
import { unsupportedStrategy } from './strategies/UnsupportedStrategy';

/**
 * Ordre = priorité de résolution (premier match gagne).
 * `unsupportedStrategy` est le fallback final, il DOIT rester en dernier.
 *
 * Pour ajouter un format (ex. .odt) : créer la stratégie dans `strategies/`
 * et l'insérer ici AVANT unsupportedStrategy. Aucun autre fichier à modifier (OCP).
 */
const STRATEGIES: PreviewStrategy[] = [
  pdfStrategy,
  imageStrategy,
  docxStrategy,
  xlsxStrategy,
  unsupportedStrategy,
];

export function resolvePreviewStrategy(source: PreviewSource): PreviewStrategy {
  return STRATEGIES.find((s) => s.canHandle(source)) ?? unsupportedStrategy;
}

export const STRATEGIES_REGISTRY = STRATEGIES;
