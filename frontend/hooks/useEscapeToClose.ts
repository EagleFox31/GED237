import { useEffect, useRef } from 'react';
import { isCloseKey } from '../lib/keyboardActivation';

/**
 * Ferme une fenêtre sur Échap. `enabled` à false quand un dialogue enfant est ouvert
 * (il gère alors Échap lui-même) ou quand la fermeture est interdite (envoi en cours).
 * La dernière version de `onClose` est lue via une ref : un parent qui passe une
 * fonction fléchée ne réabonne pas l'écouteur à chaque rendu.
 */
export function useEscapeToClose(onClose: () => void, enabled = true): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (isCloseKey(event)) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
