// Copie de texte dans le presse-papiers, avec repli pour les navigateurs anciens.
//
// `navigator.clipboard` manque sur les navigateurs anciens et sur toute page servie en HTTP
// simple (contexte non sécurisé), même avec un navigateur récent : c'est le cas d'un serveur
// de labo joint par son adresse IP. On tente donc aussi l'ancienne commande « copy » du document.
// Le résultat est un booléen : à `false`, l'appelant invite l'utilisateur à copier à la main.
//
// Les deux tentatives partent dans le geste de clic, avant tout `await` : Firefox n'autorise
// `execCommand('copy')` qu'avec une activation utilisateur récente, qu'une attente peut faire perdre.
// D'où l'ordre : commande synchrone d'abord, API asynchrone ensuite si la première échoue.

export interface ClipboardEnv {
  writeText?: (text: string) => Promise<void>;
  legacyCopy?: (text: string) => boolean;
}

export const MANUAL_COPY_HINT = 'Copie automatique impossible : sélectionnez le texte, puis Ctrl+C.';
// Quand le texte à copier est affiché déjà sélectionné (dialogue de copie manuelle).
export const MANUAL_COPY_SELECTED_HINT = 'Copie automatique impossible : le texte ci-dessous est sélectionné, appuyez sur Ctrl+C.';

function browserLegacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';
  document.body.appendChild(area);
  const previous = document.activeElement as HTMLElement | null;
  try {
    area.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
    previous?.focus?.();
  }
}

function browserEnv(): ClipboardEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const writeText = nav?.clipboard?.writeText ? (text: string) => nav.clipboard.writeText(text) : undefined;
  return { writeText, legacyCopy: browserLegacyCopy };
}

// Volontairement non `async` : tout ce qui précède le `return` s'exécute dans le geste de clic.
export function copyText(text: string, env: ClipboardEnv = browserEnv()): Promise<boolean> {
  let copied = false;
  try {
    copied = env.legacyCopy ? env.legacyCopy(text) : false;
  } catch {
    copied = false;
  }
  if (copied) return Promise.resolve(true);
  if (!env.writeText) return Promise.resolve(false);
  try {
    return env.writeText(text).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}
