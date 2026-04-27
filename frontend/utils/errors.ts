export interface ApiErrorShape {
  message: string;
  status?: number;
  detail?: unknown;
  fields?: Record<string, string>;
}

export const parseApiError = (e: unknown, fallback = 'Une erreur est survenue'): ApiErrorShape => {
  if (!e) return { message: fallback };
  if (typeof e === 'string') return { message: e };
  if (e instanceof Error) {
    const anyE = e as Error & { status?: number; detail?: unknown; fields?: Record<string, string> };
    return {
      message: anyE.message || fallback,
      status: anyE.status,
      detail: anyE.detail,
      fields: anyE.fields,
    };
  }
  if (typeof e === 'object' && e !== null) {
    const obj = e as Record<string, any>;
    return {
      message: typeof obj.message === 'string' ? obj.message : fallback,
      status: typeof obj.status === 'number' ? obj.status : undefined,
      detail: obj.detail,
      fields: obj.fields,
    };
  }
  return { message: fallback };
};

export const errorMessage = (e: unknown, fallback?: string): string => parseApiError(e, fallback).message;
