import { test, expect } from '@playwright/test';
import {
  AUDIT_PAGE_SIZE,
  auditPageQuery,
  auditServerFilters,
  hasNextAuditPage,
  hasPageOnlyFilter,
} from '../../lib/auditPagination';

test.describe('auditPagination', () => {
  test('la taille de page respecte la limite du serveur (≤ 500)', () => {
    expect(AUDIT_PAGE_SIZE).toBeGreaterThan(0);
    expect(AUDIT_PAGE_SIZE).toBeLessThanOrEqual(500);
  });
  test('skip/limit par page', () => {
    expect(auditPageQuery(0)).toEqual({ skip: 0, limit: AUDIT_PAGE_SIZE });
    expect(auditPageQuery(2, 50)).toEqual({ skip: 100, limit: 50 });
  });
  test('page invalide → première page', () => {
    expect(auditPageQuery(-1, 50)).toEqual({ skip: 0, limit: 50 });
    expect(auditPageQuery(1.5, 50)).toEqual({ skip: 0, limit: 50 });
  });
  test('« Suivant » seulement si la page est pleine', () => {
    expect(hasNextAuditPage(50, 50)).toBe(true);
    expect(hasNextAuditPage(49, 50)).toBe(false);
    expect(hasNextAuditPage(0, 50)).toBe(false);
  });
  test('une seule valeur par colonne part au serveur, plusieurs restent sur la page', () => {
    expect(auditServerFilters({})).toEqual({});
    expect(auditServerFilters({ action: ['dup_detected'] })).toEqual({ action: 'dup_detected' });
    expect(auditServerFilters({ table_name: ['documents'], action: ['upload', 'delete'] })).toEqual({
      table_name: 'documents',
    });
    expect(auditServerFilters({ actor: ['Système'] })).toEqual({});
  });
  test('filtre limité à la page : plusieurs valeurs ou agent', () => {
    expect(hasPageOnlyFilter({})).toBe(false);
    expect(hasPageOnlyFilter({ action: ['upload'], table_name: [] })).toBe(false);
    expect(hasPageOnlyFilter({ action: ['upload', 'delete'] })).toBe(true);
    expect(hasPageOnlyFilter({ actor: ['Système'] })).toBe(true);
  });
});
