export const UI_TOOLTIPS = {
  directoryIngestion: {
    chooseDirectory:
      'Choisissez un dossier local pour préparer tout son contenu en une seule opération.',
    chooseFiles:
      'Choisissez seulement quelques fichiers précis si vous ne voulez pas traiter tout un dossier.',
    recursive:
      'Activez cette option pour inclure aussi les sous-dossiers dans la préparation.',
    analyzeReady:
      "Lance l'analyse des fichiers pour prévisualiser les destinations sans créer de documents définitifs.",
    analyzeDisabledNoFiles:
      "Sélectionnez d'abord un dossier ou des fichiers avant de lancer l'analyse.",
    analyzeDisabledBusy:
      "Patientez jusqu'à la fin de l'opération en cours avant de relancer l'analyse.",
    commitReady:
      "Importe uniquement les fichiers prêts. Les cas ambigus restent en vérification manuelle.",
    commitDisabledNoAnalysis:
      "L'import reste indisponible tant que les fichiers n'ont pas été analysés.",
    commitDisabledNoImportable:
      "Aucun fichier n'est importable pour l'instant. Vérifiez le contexte ou complétez la vérification.",
    batchSummary:
      "Résumé avant import : vérifiez surtout combien de fichiers sont prêts et combien devront être repris manuellement.",
  },
  reports: {
    refresh:
      "Recharge les indicateurs et les tableaux visibles pour refléter l'état documentaire le plus récent.",
    exportTable:
      "Exporte la vue visible au format Excel pour une reprise rapide hors de la plateforme.",
    generateReport:
      "Prépare un rapport plus structuré avec le type, le format et le niveau de détail de votre choix.",
    tabSynthese:
      "Vue d'ensemble de l'institution : état général, signaux utiles et points d'attention immédiats.",
    tabDocuments:
      "Lecture des volumes documentaires, des évolutions et des points de vigilance liés aux documents.",
    tabWorkflows:
      "Lecture du traitement des documents : validations, signatures, lenteurs visibles, retours et blocages estimés.",
    tabServices:
      "Lecture comparative par service : charge visible, retards estimés et activité récente des agents.",
  },
} as const;
