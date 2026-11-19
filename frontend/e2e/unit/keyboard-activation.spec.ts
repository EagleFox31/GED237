import { test, expect } from '@playwright/test';
import { isActivationKey, isCloseKey, onActivationKey } from '../../lib/keyboardActivation';

function keyEvent(key: string, onSelf = true) {
  const self = {} as EventTarget;
  let prevented = false;
  return {
    event: {
      key,
      target: onSelf ? self : ({} as EventTarget),
      currentTarget: self,
      preventDefault: () => { prevented = true; },
    },
    wasPrevented: () => prevented,
  };
}

test.describe('activation au clavier', () => {
  test('Entrée et Espace activent, les autres touches non', () => {
    expect(isActivationKey('Enter')).toBe(true);
    expect(isActivationKey(' ')).toBe(true);
    for (const key of ['Tab', 'Escape', 'a', 'Spacebar', 'ArrowDown']) expect(isActivationKey(key)).toBe(false);
  });

  test('Entrée sur la zone : action lancée, défilement de page empêché', () => {
    let calls = 0;
    const { event, wasPrevented } = keyEvent('Enter');
    onActivationKey(() => { calls += 1; })(event);
    expect(calls).toBe(1);
    expect(wasPrevented()).toBe(true);
  });

  test('touche frappée dans un élément enfant : comportement propre conservé', () => {
    let calls = 0;
    const { event, wasPrevented } = keyEvent(' ', false);
    onActivationKey(() => { calls += 1; })(event);
    expect(calls).toBe(0);
    expect(wasPrevented()).toBe(false);
  });

  test('Échap ferme, sauf si un dialogue enfant a déjà traité la touche', () => {
    expect(isCloseKey({ key: 'Escape', defaultPrevented: false })).toBe(true);
    expect(isCloseKey({ key: 'Escape', defaultPrevented: true })).toBe(false);
    expect(isCloseKey({ key: 'Enter', defaultPrevented: false })).toBe(false);
  });
});
