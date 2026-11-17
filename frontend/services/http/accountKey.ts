/**
 * Identité du compte nominatif (tenant + matricule). `profile.id` ne convient pas : c'est l'id du
 * profil de rôle, partagé par tous les comptes de même rôle. Sans matricule : pas de clé, pas de reprise.
 * Module pur (sans accès navigateur) pour rester testable hors du navigateur.
 */
export const accountKeyOf = (profile: { matricule?: string; tenantId?: string } | null | undefined): string | undefined =>
    profile?.matricule ? `${profile.tenantId ?? ''}:${profile.matricule}` : undefined;
