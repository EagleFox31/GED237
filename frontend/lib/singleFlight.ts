// Une seule action à la fois : un double clic ou une touche Entrée répétée ne relance pas l'envoi.
// Le verrou est pris de façon synchrone, avant le premier `await` : un second appel lancé dans le
// même geste le trouve déjà pris. Un état React (`disabled`) ne suffit pas, il n'est appliqué
// qu'au rendu suivant.

export interface SingleFlight {
  readonly busy: boolean;
  /** Lance `action` si rien n'est en cours ; sinon ne fait rien et renvoie `false`. */
  run(action: () => Promise<void>): Promise<boolean>;
}

export const createSingleFlight = (): SingleFlight => {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    run(action) {
      if (busy) return Promise.resolve(false);
      busy = true;
      let pending: Promise<void>;
      try {
        pending = action();
      } catch (error) {
        busy = false;
        return Promise.reject(error);
      }
      return pending.then(
        () => {
          busy = false;
          return true;
        },
        (error: unknown) => {
          busy = false;
          throw error;
        },
      );
    },
  };
};
