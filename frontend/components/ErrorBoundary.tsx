// frontend/components/ErrorBoundary.tsx
//
// Filet de sécurité React : intercepte les exceptions de rendu pour empêcher
// l'écran blanc total. Distingue le détail technique (console dev) de
// l'écran de récupération montré à l'utilisateur final.
//
// Conformité :
// - Nielsen #9 (Help users recover) : action de récupération explicite (recharger).
// - WCAG 1.4.1 / 3.3.1 : message textuel + icône, pas de signal couleur seule.
// - OWASP API 2023 #7 : la stack n'est jamais rendue dans le DOM en prod.

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
      >
        <div className="w-full max-w-lg rounded-3xl bg-white ring-1 ring-rose-200 shadow-xl p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-700 mb-4">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">
              crisis_alert
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 mb-2">
            Une erreur est survenue
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            L'application n'a pas pu afficher cette page. Rechargez pour réessayer.
            Si le problème persiste, contactez votre administrateur.
          </p>
          {isDev && (
            <pre className="text-left text-[10px] bg-slate-900 text-slate-100 rounded-xl p-3 mb-6 overflow-x-auto whitespace-pre-wrap break-all">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
