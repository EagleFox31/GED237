import { test } from '../../fixtures/auth.fixture';

/**
 * Lots V1.1 reouverts avant le gel (DEC-2026-002, GO PO du 10/11) : un scenario court par lot,
 * en fixme jusqu'a la PR du lot. Lever le fixme = remplacer le corps et supprimer test.fixme.
 * Matrice : gestion-projet/innovateur/matrice-recette.md section 6. Livre si fusionne le 19/11 18:00, sinon V1.1.
 *
 * Le projet Playwright `smoke` ne cite pas ce fichier : a ajouter au testMatch quand un lot est livre.
 */
test.describe('Feature: Lots V1.1 (SC-V11-01..05)', () => {
  test.fixme('SC-V11-01 - Given un doublon refuse a l\'upload ou a l\'import, When l\'admin ouvre le tableau de bord, Then le compteur de doublons detectes a augmente de 1', async () => {});

  test.fixme('SC-V11-02 - Given des regles actives, When l\'admin exporte puis importe le fichier sur une base vide, Then les memes regles (code, priorite, statut) sont presentes et un second import ne cree aucun doublon', async () => {});

  test.fixme('SC-V11-03 - Given un journal d\'audit avec des evenements, When l\'auditeur l\'exporte, Then le fichier contient les evenements du filtre ; Given 3 OTP errones, When un 4e essai, Then le compte est verrouille avec un message explicite', async () => {});

  test.fixme('SC-V11-04 - Given une regle "mots-cles dans le texte OCR" ou "date", When un document correspondant est importe, Then il est classe a la destination de la regle et la simulation le montre avant activation', async () => {});

  test.fixme('SC-V11-05 - Given un dossier surveille, When un fichier y est depose, Then il apparait importe/classe sans action de l\'utilisateur, et un fichier deja connu est refuse comme doublon', async () => {});
});
