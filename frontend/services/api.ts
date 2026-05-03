// frontend/services/api.ts
//
// Façade rétrocompatible. Les consommateurs existants importent toujours
// depuis '../services/api' — ce module se contente de re-exporter les
// symboles depuis la nouvelle structure modulaire (http/ + resources/).
//
// Aucun consommateur n'a besoin de bouger. À terme, on peut migrer
// progressivement les imports vers '../services' (le barrel) puis supprimer
// ce fichier ; rien ne presse.

export { api } from './index';

// Transport / session — réexports pour stores et intercepteurs ad hoc.
export {
    fetchWithRefresh,
    clearAuthSession,
    persistAuthTokens,
} from './index';

// Types DTO publics historiquement exposés depuis api.ts.
export type {
    LoginPayload,
    OTPVerifyPayload,
    LoginResponse,
    BackendUser,
    AuthSession,
} from './resources/auth.api';

export type { SpaceTreeNode } from './resources/spaces.api';

export type {
    ClassificationDomainPayload,
    ClassificationActivityPayload,
    ClassificationRulePayload,
} from './resources/classification.api';
