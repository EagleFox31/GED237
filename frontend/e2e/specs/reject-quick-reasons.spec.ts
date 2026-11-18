// Spec pur (npm run test:unit) : puces de motifs de rejet en 1 clic dans RejectReasonDialog.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test, expect } from '@playwright/test';
import {
  QUICK_REJECT_REASONS,
  RejectReasonDialog,
  applyQuickRejectReason,
} from '../../components/workflow/RejectReasonDialog';

interface PwJsxNode {
  __pw_type: unknown;
  type: string | React.ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
  key?: React.Key | null;
}

function isPwJsxNode(value: unknown): value is PwJsxNode {
  return typeof value === 'object' && value !== null && '__pw_type' in value;
}

function toReactNode(node: unknown): React.ReactNode {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map((child) => toReactNode(child));
  if (isPwJsxNode(node)) {
    const { children, ...rest } = node.props ?? {};
    if (typeof node.type === 'function') {
      const rendered = (node.type as (p: Record<string, unknown>) => unknown)(node.props ?? {});
      return toReactNode(rendered);
    }
    const reactChildren = Array.isArray(children)
      ? children.map((child) => toReactNode(child))
      : children !== undefined
        ? [toReactNode(children)]
        : [];
    return React.createElement(
      node.type,
      { ...rest, key: node.key ?? undefined },
      ...reactChildren,
    );
  }
  return node as React.ReactNode;
}

function renderDialog(initialReason = ''): string {
  let result: unknown = null;
  const Wrapper: React.FC = () => {
    result = RejectReasonDialog({
      documentTitle: 'Facture n° 42',
      initialReason,
      onConfirm: () => {},
      onCancel: () => {},
    });
    return null;
  };
  renderToStaticMarkup(React.createElement(Wrapper));
  return renderToStaticMarkup(React.createElement(React.Fragment, null, toReactNode(result)));
}

test.describe('Motifs de rejet en 1 clic', () => {
  test('expose les 4 motifs fréquents attendus', () => {
    expect(QUICK_REJECT_REASONS).toEqual([
      'Pièce manquante',
      'Erreur de saisie ou de montant',
      'Visa préalable manquant',
      'À reformuler',
    ]);
  });

  test('remplit le champ vide, complète un texte existant et reste idempotent', () => {
    const first = applyQuickRejectReason('', QUICK_REJECT_REASONS[0]);
    expect(first).toBe('Pièce manquante');

    const second = applyQuickRejectReason(first, QUICK_REJECT_REASONS[2]);
    expect(second).toBe('Pièce manquante · Visa préalable manquant');

    const duplicate = applyQuickRejectReason(second, QUICK_REJECT_REASONS[0]);
    expect(duplicate).toBe(second);
  });

  test('affiche les 4 puces accessibles au clavier et active la confirmation dès qu’un motif est choisi', () => {
    const emptyHtml = renderDialog('');
    for (const label of QUICK_REJECT_REASONS) {
      expect(emptyHtml).toContain(`type="button"`);
      expect(emptyHtml).toContain(`>${label}</button>`);
    }
    expect(emptyHtml).toMatch(/<button type="submit" disabled=""[^>]*>Confirmer le rejet<\/button>/);

    const afterChipClick = applyQuickRejectReason('', QUICK_REJECT_REASONS[0]);
    const filledHtml = renderDialog(afterChipClick);
    expect(filledHtml).toContain('>Pièce manquante</textarea>');
    expect(filledHtml).toMatch(/<button type="submit" class="[^"]*">Confirmer le rejet<\/button>/);
  });
});
