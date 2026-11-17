/**
 * Hôtes acceptés par le serveur Vite derrière nginx (#145), lus dans FRONTEND_ALLOWED_HOSTS :
 * noms séparés par des virgules, « .exemple.local » pour un domaine et ses sous-domaines.
 * Vide : défaut de Vite (localhost, *.localhost et adresses IP), comme avant.
 * Jamais « tous les hôtes » : `true`, `*`, un port ou une URL font échouer le démarrage.
 */
const HOST_ENTRY = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)*$/;

export function parseAllowedHosts(raw: string | undefined): string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '');
  // « true » a la forme d'un nom d'hôte mais signifie « tous les hôtes » pour Vite : refusé explicitement.
  const invalid = entries.filter((entry) => entry === 'true' || !HOST_ENTRY.test(entry));
  if (invalid.length > 0) {
    throw new Error(
      `FRONTEND_ALLOWED_HOSTS : entrée(s) refusée(s) ${invalid.join(', ')}. ` +
        'Attendu : des noms d’hôte sans port ni schéma (ex. poste-12,ged.local,.intra).',
    );
  }
  return entries;
}
