// frontend/lib/demoProfilesFlag.ts
export function areDemoProfilesEnabled(
  envValue: string | boolean | undefined = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: Record<string, string | boolean | undefined> }).env?.VITE_DEMO_PROFILES
    : undefined,
): boolean {
  if (typeof envValue === 'boolean') return envValue;
  const normalized = (envValue ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}
