// Garde contre la redirection ouverte : seul un chemin interne à l'application est accepté.

const BACKSLASH = String.fromCharCode(92);

/** Vrai si `path` est un chemin relatif à l'application (« /x », sans schéma ni hôte). */
export const isSafeInternalPath = (path: unknown): path is string => {
    if (typeof path !== 'string' || !path.startsWith('/')) return false;
    // « // » et « /<antislash> » sont interprétés comme un hôte par les navigateurs.
    if (path.startsWith('//') || path.startsWith(`/${BACKSLASH}`)) return false;
    // Caractères de contrôle refusés.
    for (let i = 0; i < path.length; i += 1) {
        if (path.charCodeAt(i) < 32) return false;
    }
    return true;
};
