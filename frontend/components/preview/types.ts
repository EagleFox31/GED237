/**
 * Contrat public du module d'aperçu (DIP).
 * Toute nouvelle stratégie de format DOIT implémenter PreviewStrategy
 * et être enregistrée dans PreviewStrategyRegistry.
 */

export interface PreviewSource {
  /** MIME normalisé en lowercase. */
  mime: string;
  /** Nom du fichier original (pour fallback sur l'extension). */
  filename: string;
}

export interface PreviewRenderProps {
  blob: Blob;
  /** Object URL prêt à l'emploi (révoqué automatiquement par le hook). */
  blobUrl: string;
  filename: string;
  onDownload: () => void;
}

export interface PreviewStrategy {
  /** Identifiant stable pour debug / tests. */
  readonly id: string;
  /** Décide si la stratégie sait rendre cette source. */
  canHandle(source: PreviewSource): boolean;
  /** Composant React rendu quand canHandle == true. */
  Renderer: React.ComponentType<PreviewRenderProps>;
}
