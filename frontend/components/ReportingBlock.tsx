import React, { useEffect, useState } from 'react';

import { api } from '../services/api';
import {
  chainEntries,
  errorStatus,
  hierarchyErrorMessage,
  teamCountLabel,
  type HierarchyPerson,
} from '../lib/hierarchy';

interface ReportingBlockProps {
  userId: string;
  /** `self` : « Mon équipe » de la personne connectée ; `agent` : fiche d'un agent (écran Utilisateurs). */
  variant: 'self' | 'agent';
  /** Fourni seulement si l'écran peut ouvrir la fiche d'une personne ; sinon les noms sont du texte. */
  onOpenUser?: (id: string) => void;
  /** Change après un enregistrement de la fiche : le bloc se recharge. */
  reloadKey?: number;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; chain: HierarchyPerson[]; team: HierarchyPerson[] };

const LABELS = {
  self: { chain: 'Je rends compte à', team: 'Mon équipe' },
  agent: { chain: 'Rend compte à', team: 'Son équipe' },
} as const;

const PersonName: React.FC<{ person: HierarchyPerson; onOpenUser?: (id: string) => void }> = ({ person, onOpenUser }) =>
  onOpenUser ? (
    <button
      type="button"
      onClick={() => onOpenUser(person.id)}
      className="font-semibold text-rdpc-blue hover:underline"
    >
      {person.full_name}
    </button>
  ) : (
    <span className="font-semibold text-slate-800">{person.full_name}</span>
  );

/** Bloc « Rattachement » : chaîne des chefs et équipe directe (N-1 seulement). */
export const ReportingBlock: React.FC<ReportingBlockProps> = ({ userId, variant, onOpenUser, reloadKey = 0 }) => {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    setExpanded(false);
    Promise.all([api.getHierarchyUp(userId), api.getHierarchyDown(userId)])
      .then(([chain, team]) => {
        if (!cancelled) setState({ kind: 'ready', chain, team });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: hierarchyErrorMessage(errorStatus(error), variant) });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  if (state.kind === 'loading') {
    return <p className="text-sm text-slate-500" role="status">Chargement…</p>;
  }
  if (state.kind === 'error') {
    return <p className="text-sm text-amber-700" role="alert">{state.message}</p>;
  }

  const { chain, team } = state;
  const labels = LABELS[variant];

  if (variant === 'self' && chain.length === 0 && team.length === 0) {
    return (
      <p className="text-sm text-slate-600" data-testid="reporting-empty">
        Vous n'êtes rattaché à personne pour le moment. Contactez votre administrateur.
      </p>
    );
  }

  const showChain = variant === 'agent' || chain.length > 0;
  const showTeam = variant === 'agent' || team.length > 0;

  return (
    <div className="space-y-5" data-testid="reporting-block">
      {showChain && (
        <section aria-label={labels.chain}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{labels.chain}</h3>
          {chain.length === 0 ? (
            <p className="text-sm text-slate-600">Ne rend compte à personne.</p>
          ) : (
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="reporting-chain">
              {chainEntries(chain, expanded).map((entry, index) => (
                <li key={entry.kind === 'person' ? entry.person.id : 'more'} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true" className="text-slate-400">›</span>}
                  {entry.kind === 'person' ? (
                    <span>
                      <PersonName person={entry.person} onOpenUser={onOpenUser} />{' '}
                      <span className="text-slate-500">(N+{entry.level})</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      aria-label={`Afficher ${entry.count} chefs intermédiaires`}
                      className="px-1.5 rounded-md text-slate-600 hover:bg-slate-100"
                    >
                      …
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {showTeam && (
        <section aria-label={labels.team}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
            {labels.team}
            {team.length > 0 && <span className="ml-2 normal-case tracking-normal font-semibold">{teamCountLabel(team.length)}</span>}
          </h3>
          {team.length === 0 ? (
            <p className="text-sm text-slate-600">Personne ne lui rend compte.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm" data-testid="reporting-team">
              {team.map((person) => (
                <li key={person.id} className="py-2 flex flex-wrap items-baseline gap-x-3">
                  <PersonName person={person} onOpenUser={onOpenUser} />
                  <span className="text-slate-500">{person.matricule}</span>
                  {person.role_label && <span className="text-slate-500">{person.role_label}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default ReportingBlock;
