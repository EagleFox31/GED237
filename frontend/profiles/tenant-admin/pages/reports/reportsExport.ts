import type { ReportsSeriesKey } from '../../../../services/resources/reports.api';
import type { ReportsTableRow, ReportsViewMode } from './reportsViewModel';

const VIEW_LABELS: Record<ReportsViewMode, string> = {
  synthese: 'vue-generale',
  documents: 'activite-documentaire',
  workflows: 'traitement-delais',
  services: 'services',
};

const SERIES_LABELS: Record<ReportsSeriesKey, string> = {
  documents_created: 'documents-crees',
  documents_auto_classified: 'classement-automatique',
  documents_needing_review: 'documents-a-revoir',
};

const STATUS_LABELS: Record<ReportsTableRow['status'], string> = {
  stable: 'Stable',
  attention: 'Attention',
  positive: 'Maîtrisé',
  info: 'À surveiller',
};

export type ReportsGeneratedReportType = 'monthly_activity' | 'delays' | 'by_service' | 'workflows';
export type ReportsGeneratedReportFormat = 'excel' | 'csv' | 'pdf';
export type ReportsReportDetailLevel = 'synthese' | 'standard' | 'detaille';

interface ReportsDocumentGenerationParams {
  reportType: ReportsGeneratedReportType;
  format: ReportsGeneratedReportFormat;
  detailLevel: ReportsReportDetailLevel;
  periodLabel: string;
  scopeLabel: string;
  rows: ReportsTableRow[];
  seriesTitle?: string;
  seriesPoints?: Array<{ label: string; value: number }>;
}

const REPORT_TYPE_LABELS: Record<ReportsGeneratedReportType, string> = {
  monthly_activity: 'rapport-activite-documentaire',
  delays: 'rapport-retards',
  by_service: 'rapport-par-service',
  workflows: 'rapport-traitement',
};

const REPORT_TYPE_TITLES: Record<ReportsGeneratedReportType, string> = {
  monthly_activity: "Rapport d'activité documentaire",
  delays: 'Rapport des retards',
  by_service: 'Rapport par service',
  workflows: 'Rapport du traitement',
};

const DETAIL_LEVEL_LABELS: Record<ReportsReportDetailLevel, string> = {
  synthese: 'Synthétique',
  standard: 'Standard',
  detaille: 'Détaillé',
};

const formatTimestamp = (value = new Date()) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);

const getBaseFilename = (reportType: ReportsGeneratedReportType) =>
  `${REPORT_TYPE_LABELS[reportType]}-${new Date().toISOString().slice(0, 10)}`;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const selectRowColumns = (detailLevel: ReportsReportDetailLevel) => {
  if (detailLevel === 'synthese') {
    return ['Rubrique', 'Indicateur', 'Valeur', 'État'] as const;
  }
  if (detailLevel === 'standard') {
    return ['Rubrique', 'Indicateur', 'Valeur', 'État', 'Détail'] as const;
  }
  return ['Rubrique', 'Indicateur', 'Valeur', 'État', 'Détail', 'Suite à donner'] as const;
};

const mapRowsForDetail = (rows: ReportsTableRow[], detailLevel: ReportsReportDetailLevel) => {
  const columns = selectRowColumns(detailLevel);
  return rows.map((row) => {
    const mapped = {
      Rubrique: row.family,
      Indicateur: row.indicator,
      Valeur: row.value,
      'État': STATUS_LABELS[row.status],
      Détail: row.detail,
      'Suite à donner': row.actionHint,
    };

    return Object.fromEntries(columns.map((column) => [column, mapped[column]]));
  });
};

export const exportReportsRowsCsv = (rows: ReportsTableRow[], viewMode: ReportsViewMode) => {
  const header = ['Rubrique', 'Indicateur', 'Valeur', 'Explication', 'État', 'Suite à donner'];
  const lines = [
    header,
    ...rows.map((row) => [
      row.family,
      row.indicator,
      row.value,
      row.detail,
      STATUS_LABELS[row.status],
      row.actionHint,
    ]),
  ];
  const csv = lines
    .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `rapports-${VIEW_LABELS[viewMode]}-${new Date().toISOString().slice(0, 10)}.csv`);
};

export const exportReportsRowsExcel = async (rows: ReportsTableRow[], viewMode: ReportsViewMode) => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Rubrique: row.family,
      Indicateur: row.indicator,
      Valeur: row.value,
      'État': STATUS_LABELS[row.status],
      Détail: row.detail,
      'Suite à donner': row.actionHint,
    })),
  );

  XLSX.utils.book_append_sheet(workbook, sheet, 'Indicateurs');
  XLSX.writeFile(workbook, `rapports-${VIEW_LABELS[viewMode]}-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportReportsSeriesCsv = (
  points: Array<{ label: string; value: number }>,
  seriesKey: ReportsSeriesKey,
) => {
  const header = ['Période', 'Valeur'];
  const lines = [
    header,
    ...points.map((point) => [point.label, point.value]),
  ];
  const csv = lines
    .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `rapports-${SERIES_LABELS[seriesKey]}-${new Date().toISOString().slice(0, 10)}.csv`);
};

const exportGeneratedReportCsv = ({
  reportType,
  detailLevel,
  periodLabel,
  scopeLabel,
  rows,
  seriesTitle,
  seriesPoints = [],
}: ReportsDocumentGenerationParams) => {
  const rowLines = mapRowsForDetail(rows, detailLevel);
  const firstRow = rowLines[0];
  const rowHeaders = firstRow ? Object.keys(firstRow) : ['Rubrique', 'Indicateur', 'Valeur', 'État'];
  const lines: string[][] = [
    ['Rapport', REPORT_TYPE_TITLES[reportType]],
    ['Période', periodLabel],
    ['Périmètre', scopeLabel],
    ['Niveau de détail', DETAIL_LEVEL_LABELS[detailLevel]],
    ['Généré le', formatTimestamp()],
    [],
    rowHeaders,
    ...rowLines.map((row) => rowHeaders.map((header) => String(row[header as keyof typeof row] ?? ''))),
  ];

  if (seriesPoints.length > 0) {
    lines.push([], [seriesTitle ?? 'Évolution', 'Valeur']);
    seriesPoints.forEach((point) => {
      lines.push([point.label, String(point.value)]);
    });
  }

  const csv = lines
    .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `${getBaseFilename(reportType)}.csv`,
  );
};

const exportGeneratedReportExcel = async ({
  reportType,
  detailLevel,
  periodLabel,
  scopeLabel,
  rows,
  seriesTitle,
  seriesPoints = [],
}: ReportsDocumentGenerationParams) => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const coverSheet = XLSX.utils.aoa_to_sheet([
    ['Rapport', REPORT_TYPE_TITLES[reportType]],
    ['Période', periodLabel],
    ['Périmètre', scopeLabel],
    ['Niveau de détail', DETAIL_LEVEL_LABELS[detailLevel]],
    ['Généré le', formatTimestamp()],
    ['Nombre de lignes', rows.length],
  ]);
  XLSX.utils.book_append_sheet(workbook, coverSheet, 'Paramètres');

  const rowSheet = XLSX.utils.json_to_sheet(mapRowsForDetail(rows, detailLevel));
  XLSX.utils.book_append_sheet(workbook, rowSheet, 'Indicateurs');

  if (seriesPoints.length > 0) {
    const evolutionSheet = XLSX.utils.json_to_sheet(
      seriesPoints.map((point) => ({
        Période: point.label,
        Valeur: point.value,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, evolutionSheet, seriesTitle ? 'Évolution' : 'Tendance');
  }

  XLSX.writeFile(workbook, `${getBaseFilename(reportType)}.xlsx`);
};

const exportGeneratedReportPdf = ({
  reportType,
  detailLevel,
  periodLabel,
  scopeLabel,
  rows,
  seriesTitle,
  seriesPoints = [],
}: ReportsDocumentGenerationParams) => {
  const printableWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printableWindow) return;

  const columns = selectRowColumns(detailLevel);
  const rowHtml = rows
    .map((row) => {
      const mapped = {
        Rubrique: row.family,
        Indicateur: row.indicator,
        Valeur: row.value,
        'État': STATUS_LABELS[row.status],
        Détail: row.detail,
        'Suite à donner': row.actionHint,
      };

      return `<tr>${columns.map((column) => `<td>${String(mapped[column]).replace(/</g, '&lt;')}</td>`).join('')}</tr>`;
    })
    .join('');

  const seriesHtml = seriesPoints.length > 0
    ? `
      <h2>${seriesTitle ?? 'Évolution dans le temps'}</h2>
      <table>
        <thead><tr><th>Période</th><th>Valeur</th></tr></thead>
        <tbody>
          ${seriesPoints.map((point) => `<tr><td>${point.label}</td><td>${point.value}</td></tr>`).join('')}
        </tbody>
      </table>
    `
    : '';

  printableWindow.document.write(`
    <html lang="fr">
      <head>
        <title>${REPORT_TYPE_TITLES[reportType]}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
          h1 { margin: 0 0 16px; font-size: 28px; }
          h2 { margin: 28px 0 12px; font-size: 18px; }
          p { margin: 6px 0; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 12px; }
          th { background: #f8fafc; }
          .meta { display: grid; grid-template-columns: 180px 1fr; gap: 6px 12px; margin-top: 16px; }
          .meta strong { color: #334155; }
        </style>
      </head>
      <body>
        <h1>${REPORT_TYPE_TITLES[reportType]}</h1>
        <div class="meta">
          <strong>Période</strong><span>${periodLabel}</span>
          <strong>Périmètre</strong><span>${scopeLabel}</span>
          <strong>Niveau de détail</strong><span>${DETAIL_LEVEL_LABELS[detailLevel]}</span>
          <strong>Généré le</strong><span>${formatTimestamp()}</span>
        </div>

        <h2>Indicateurs</h2>
        <table>
          <thead>
            <tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
        ${seriesHtml}
      </body>
    </html>
  `);
  printableWindow.document.close();
  printableWindow.focus();
  printableWindow.print();
};

export const generateReportsDocument = async (params: ReportsDocumentGenerationParams) => {
  if (params.format === 'excel') {
    await exportGeneratedReportExcel(params);
    return;
  }
  if (params.format === 'pdf') {
    exportGeneratedReportPdf(params);
    return;
  }
  exportGeneratedReportCsv(params);
};
