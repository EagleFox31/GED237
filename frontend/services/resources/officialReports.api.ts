// frontend/services/resources/officialReports.api.ts
//
// Copies officielles numérotées (#161) et rapports programmés (#180). Les refus du serveur
// (nom court manquant, programmation désactivée…) remontent tels quels par le bus d'erreurs.

import { API_URL } from '../../constants';
import { apiCall, apiCallVoid, fetchWithRefresh, getHeaders } from '../http/client';
import { buildApiError } from '../http/errorAdapter';

export type OfficialReportKind = 'evolution' | 'document-activity' | 'workflow-activity' | 'service-activity';
/** `pdf` arrive avec #197 (fusionnée avant celle-ci). */
export type OfficialReportFormat = 'csv' | 'html' | 'pdf';
export type ReportFrequency = 'weekly' | 'monthly';

export interface OfficialReportRequest {
  kind: OfficialReportKind;
  format: OfficialReportFormat;
  /** `evolution` seulement. */
  date_from?: string;
  date_to?: string;
}

export interface OfficialReportIssue {
  id: string;
  number: string;
  year: number;
  sequence: number;
  kind: OfficialReportKind;
  format: OfficialReportFormat;
  filters: Record<string, unknown>;
  file_sha256: string;
  issued_by?: string | null;
  issued_at: string;
}

export interface OfficialReportSchedule {
  id: string;
  name: string;
  frequency: ReportFrequency;
  request: Partial<OfficialReportRequest>;
  is_active: boolean;
  created_at: string;
}

export interface OfficialCopy {
  blob: Blob;
  filename: string;
  /** Numéro lisible, ex. « N° 0001/2026/SIGLE ». */
  number: string;
}

const filenameFrom = (disposition: string | null, fallback: string) =>
  /filename="([^"]+)"/.exec(disposition ?? '')?.[1] ?? fallback;

const decodeNumber = (raw: string | null) => {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const readCopy = async (response: Response, fallback: string): Promise<OfficialCopy> => {
  if (!response.ok) throw await buildApiError(response, fallback);
  return {
    blob: await response.blob(),
    filename: filenameFrom(response.headers.get('Content-Disposition'), 'rapport-officiel'),
    number: decodeNumber(response.headers.get('X-Report-Number')),
  };
};

export const officialReportsApi = {
  /** Émet une copie numérotée et inscrite au registre. */
  issue: async (request: OfficialReportRequest): Promise<OfficialCopy> => {
    const response = await fetchWithRefresh(`${API_URL}/reports/official`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify(request),
    });
    return readCopy(response, 'Émission de la copie officielle impossible');
  },

  listIssues: async (skip = 0, limit = 20): Promise<{ items: OfficialReportIssue[]; total: number }> => {
    const query = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    const response = await fetchWithRefresh(`${API_URL}/reports/official/issues?${query.toString()}`, {
      headers: getHeaders(false),
    });
    // 403 : le modal affiche lui-même « Vous n'avez pas accès au registre. » (pas de toast en double).
    if (!response.ok) throw await buildApiError(response, 'Lecture du registre impossible', { handledStatuses: [403] });
    const items = (await response.json()) as OfficialReportIssue[];
    const total = Number(response.headers.get('X-Total-Count'));
    return { items, total: Number.isInteger(total) && total >= 0 ? total : items.length };
  },

  /** Le fichier remis à l'émission, même numéro. */
  reprint: async (issueId: string): Promise<OfficialCopy> => {
    const response = await fetchWithRefresh(`${API_URL}/reports/official/issues/${issueId}/file`, {
      headers: getHeaders(false),
    });
    return readCopy(response, 'Réimpression impossible');
  },

  /** Programmations actives, et l'en-tête `X-Scheduled-Reports-Enabled` tel que reçu (lu par le modal). */
  listSchedules: async (): Promise<{ items: OfficialReportSchedule[]; enabledHeader: string | null }> => {
    const response = await fetchWithRefresh(`${API_URL}/reports/official/schedules`, {
      headers: getHeaders(false),
    });
    // Onglet secondaire lu à l'ouverture du modal : un refus (403) ou une panne (5xx) le masquent
    // simplement, sans toast d'erreur sur l'émission qui, elle, fonctionne.
    if (response.status === 403 || response.status >= 500) return { items: [], enabledHeader: null };
    if (!response.ok) throw await buildApiError(response, 'Lecture des rapports programmés impossible');
    return {
      items: (await response.json()) as OfficialReportSchedule[],
      enabledHeader: response.headers.get('X-Scheduled-Reports-Enabled'),
    };
  },

  createSchedule: (name: string, frequency: ReportFrequency, report: OfficialReportRequest): Promise<OfficialReportSchedule> =>
    apiCall(
      '/reports/official/schedules',
      { method: 'POST', body: JSON.stringify({ name, frequency, report }) },
      'Programmation impossible',
    ),

  stopSchedule: (scheduleId: string): Promise<void> =>
    apiCallVoid(`/reports/official/schedules/${scheduleId}`, { method: 'DELETE' }, 'Arrêt impossible'),
};
