import { test, expect } from '@playwright/test';
import { createSingleFlight } from '../../lib/singleFlight';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Une seule action à la fois', () => {
  test('double clic : la seconde demande est ignorée tant que la première court', async () => {
    const flight = createSingleFlight();
    let calls = 0;
    let release!: () => void;
    const action = () => {
      calls += 1;
      return new Promise<void>((resolve) => { release = resolve; });
    };
    const first = flight.run(action);
    const second = flight.run(action);
    expect(flight.busy).toBe(true);
    expect(await second).toBe(false);
    release();
    expect(await first).toBe(true);
    expect(calls).toBe(1);
    expect(flight.busy).toBe(false);
  });

  test('après un échec, le verrou est rendu et l’erreur remonte', async () => {
    const flight = createSingleFlight();
    await expect(flight.run(() => Promise.reject(new Error('refusé')))).rejects.toThrow('refusé');
    expect(flight.busy).toBe(false);
    await expect(flight.run(() => { throw new Error('synchrone'); })).rejects.toThrow('synchrone');
    expect(flight.busy).toBe(false);
    expect(await flight.run(async () => {})).toBe(true);
  });
});
