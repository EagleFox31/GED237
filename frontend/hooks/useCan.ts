import { useEffect, useState } from 'react';

import { api } from '../services/api';
import type { PermissionKey } from '../services/resources/authz.api';

/**
 * Droits de l'utilisateur courant, évalués par le serveur (GET /authz/me/permissions).
 * Jamais déduits d'un rôle codé en dur. Tant que la réponse n'est pas arrivée, ou si
 * l'appel échoue, chaque droit vaut `false` : l'action reste masquée.
 */
export function useCan<K extends PermissionKey>(...checks: K[]): Record<K, boolean> {
  const key = checks.join(',');
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const keys = key.split(',').filter(Boolean) as PermissionKey[];
    if (keys.length === 0) return undefined;
    api
      .getMyPermissions(keys)
      .then((result) => {
        if (!cancelled) setGranted(result);
      })
      .catch(() => {
        if (!cancelled) setGranted({});
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return Object.fromEntries(checks.map((c) => [c, granted[c] === true])) as Record<K, boolean>;
}
