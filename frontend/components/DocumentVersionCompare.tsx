import React from 'react';
import {
  compareMetadata, contentSummary, orderVersions, type VersionInfo,
} from '../lib/versionCompare';

interface Props {
  first: VersionInfo;
  second: VersionInfo;
  onClose: () => void;
}

/** Ce qui a changé entre deux versions : le résultat d'abord, le détail ensuite. */
const DocumentVersionCompare: React.FC<Props> = ({ first, second, onClose }) => {
  const [before, after] = orderVersions(first, second);
  const rows = compareMetadata(before, after);
  const fileChanged = !!before.checksum_sha256 && !!after.checksum_sha256 && before.checksum_sha256 !== after.checksum_sha256;

  return (
    <section data-testid="version-compare" aria-label="Comparaison de deux versions" className="glass p-5 rounded-3xl border border-blue-200 bg-blue-50/40 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-800">Version {before.version_number} → Version {after.version_number}</h4>
          <p data-testid="version-compare-summary" className={`text-sm font-semibold mt-1 ${fileChanged ? 'text-amber-700' : 'text-slate-600'}`}>
            {contentSummary(before, after)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la comparaison"
          className="p-1 text-slate-400 hover:text-slate-700"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
        </button>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 uppercase tracking-tighter">
            <th scope="col" className="py-1 pr-3 font-black">Quoi</th>
            <th scope="col" className="py-1 pr-3 font-black">Version {before.version_number}</th>
            <th scope="col" className="py-1 font-black">Version {after.version_number}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-testid={`version-compare-${row.key}`} data-changed={row.changed} className="border-t border-slate-200/60 align-top">
              <th scope="row" className="py-2 pr-3 text-left font-semibold text-slate-600">{row.label}</th>
              <td className={`py-2 pr-3 break-words ${row.changed ? 'text-red-700' : 'text-slate-500'}`}>{row.before}</td>
              <td className={`py-2 break-words ${row.changed ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                {row.after}
                {!row.changed && <span className="sr-only"> (inchangé)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export default DocumentVersionCompare;
