// Zones cliquables qui ne sont pas des <button> natifs (cartes, zone de dépôt) :
// Entrée et Espace doivent les déclencher comme un clic.

export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

/** Gestionnaire onKeyDown : déclenche `action` sur Entrée ou Espace (sans faire défiler la page). */
export function onActivationKey(action: () => void) {
  return (event: { key: string; preventDefault: () => void; target: EventTarget | null; currentTarget: EventTarget | null }) => {
    // Une touche frappée dans un élément enfant (champ, bouton) garde son comportement propre.
    if (event.target !== event.currentTarget || !isActivationKey(event.key)) return;
    event.preventDefault();
    action();
  };
}

/** Fermeture par Échap, sauf si un dialogue enfant a déjà traité la touche. */
export function isCloseKey(event: { key: string; defaultPrevented: boolean }): boolean {
  return event.key === 'Escape' && !event.defaultPrevented;
}
