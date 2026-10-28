# Dossier de décision OTP — GED237 — 2026-07-22

> Statut : Proposé — arbitrage Product Owner et commanditaire requis
> Agent coordinateur : Cursor
> Recherche : sous-agent spécialisé
> Référence PERT : T08
> Périmètre : canal MFA du pilote, sans implémentation

## 1. État constaté

Le flux actuel :

- vérifie institution, matricule et mot de passe ;
- génère un OTP numérique de six chiffres ;
- le stocke cinq minutes dans Redis ;
- le vérifie avant émission des JWT ;
- le renvoie dans la réponse HTTP en développement.

Aucun service ne distribue réellement l'OTP hors développement. Le message
serveur affirme pourtant que l'OTP a été envoyé et le frontend évoque un code
reçu sur mobile.

Preuves principales :

- `backend/app/services/auth_service.py`
- `backend/app/api/v1/endpoints/auth.py`
- `backend/app/services/email_service.py`
- `frontend/components/LoginPage.tsx`

## 2. Écarts à fermer avant pilote

- OTP conservé en clair dans Redis ;
- absence de compteur d'échecs cumulé par challenge/compte ;
- absence de renvoi et de sélection de canal ;
- absence d'audit envoi/échec/validation/refus ;
- aucun client SMS ;
- champ `mfa_secret` présent mais cycle TOTP absent ;
- service e-mail Resend existant, mais non utilisé pour l'OTP ;
- Compose racine orienté développement, donc non acceptable tel quel en pilote.

## 3. Options

### TOTP — application d'authentification

**Forces**

- aucun coût par connexion ;
- fonctionne sans réseau après enrôlement ;
- cohérent avec une exploitation on-site ;
- évite la transmission du numéro ou de l'e-mail à un fournisseur ;
- champ `mfa_secret` déjà présent dans le modèle.

**Faiblesses**

- smartphone et accompagnement nécessaires ;
- enrôlement, chiffrement du secret, révocation et récupération à construire ;
- reste vulnérable au phishing en temps réel.

### SMS via opérateur camerounais

**Forces**

- accessible depuis un téléphone basique ;
- canal familier ;
- offre locale Orange documentée avec API et accusés.

**Faiblesses**

- SIM swap, interception et phishing ;
- dépendance Internet/opérateur/crédit ;
- délivrabilité multi-opérateurs non mesurée ;
- contrat OTP transactionnel à confirmer.

Tarifs Orange publiés consultés : environ 11 FCFA on-net et 22 FCFA off-net par
SMS, à faire confirmer contractuellement.

### E-mail

**Forces**

- service Resend déjà amorcé ;
- coût et intégration initiale faibles.

**Faiblesses**

- dépendance Internet, DNS et réputation du domaine ;
- réception en boîte non synonyme de lecture en moins de cinq minutes ;
- transferts de données et sous-traitance à examiner ;
- NIST SP 800-63B-4 exclut l'e-mail comme méthode d'authentification hors bande.

Conclusion : notifications ou récupération contrôlée, pas facteur principal.

### Canal institutionnel

Le terme doit être précisé : messagerie ministérielle, SSO, Active Directory,
SMS d'entreprise ou appareil géré n'offrent pas les mêmes garanties.

Conclusion : option potentiellement souveraine, mais insuffisamment définie.

### SMS international

Twilio affiche un coût très supérieur pour le Cameroun et augmente la chaîne de
sous-traitance. Aucun avantage décisif n'est démontré pour le pilote.

## 4. Recommandation

### Pilote proposé

1. **TOTP standard RFC 6238 comme canal principal**.
2. **SMS local comme solution d'accessibilité**, après validation du contrat et
   essai réel Orange/MTN/autres réseaux représentés.
3. Codes de secours à usage unique et procédure helpdesk contrôlée.
4. E-mail limité aux notifications de sécurité et à une récupération ne
   constituant pas, seule, le second facteur.
5. Étudier WebAuthn/FIDO pour les profils sensibles dans une phase ultérieure.

### Pourquoi

TOTP offre le meilleur compromis souveraineté, coût et fonctionnement hors
réseau. Le SMS local couvre les utilisateurs sans application d'authentification.
La solution définitive dépend néanmoins de l'équipement réel des agents.

## 5. Décisions commanditaire requises

- Le pilote doit-il fonctionner sans Internet sortant ?
- Les téléphones personnels sont-ils autorisés ?
- Combien d'agents disposent d'un smartphone compatible ?
- Quels opérateurs et quelles zones sont représentés ?
- Existe-t-il un SSO ou canal institutionnel documenté ?
- Quelle procédure de récupération d'identité est autorisée ?
- La résidence camerounaise des données est-elle obligatoire ?
- Quels volume, budget et disponibilité sont attendus ?

## 6. Critères d'acceptation proposés pour l'implémentation

### Sécurité

- aucun OTP/secret dans les réponses, logs ou outils analytiques du pilote ;
- OTP transmis lié au compte, à la session et à l'usage login ;
- expiration maximale cinq minutes et consommation atomique unique ;
- OTP protégé dans Redis ;
- cinq échecs invalident le challenge ;
- limites par compte, session, tenant et IP ;
- secret TOTP aléatoire, unique et chiffré au repos ;
- code TOTP accepté non rejouable ;
- changement de canal réauthentifié et audité.

### Fonctionnel et accessibilité

- enrôlement, confirmation, connexion, révocation et récupération couverts ;
- destination masquée et canal indiqué ;
- collage, `autocomplete="one-time-code"`, clavier et lecteur d'écran ;
- alternative pour téléphone interdit, partagé, perdu ou sans couverture.

### Délivrabilité SMS

- essai réel sur chaque opérateur du pilote ;
- objectif proposé : 95 % livrés en moins de 60 secondes et 99 % en moins de
  180 secondes, à valider par le commanditaire ;
- statut, opérateur et latence mesurés sans conserver le code ;
- autorisation contractuelle d'envoyer des OTP confirmée.

### Exploitation

- horloge serveur synchronisée et surveillée ;
- secrets fournisseurs hors dépôt ;
- métriques d'envoi, validation, échec, expiration, blocage, latence et coût ;
- runbooks Redis, opérateur, perte téléphone et compromission ;
- tests unitaires, Redis réel, contrat fournisseur et E2E non mocké.

## 7. Protection des données

- minimiser numéros, e-mails et métadonnées ;
- documenter les durées de conservation ;
- valider sous-traitance et transferts internationaux ;
- effectuer une revue juridique de la loi camerounaise n° 2024/017 ;
- ne jamais inclure de donnée métier sensible dans le message.

## 8. Sources primaires consultées

- NIST SP 800-63B-4 : https://pages.nist.gov/800-63-4/sp800-63b.html
- RFC 6238 TOTP : https://www.rfc-editor.org/info/rfc6238/
- CISA MFA : https://www.cisa.gov/MFA
- Loi camerounaise n° 2024/017 :
  https://prc.cm/fr/multimedia/documents/10258-loi-n-2024-017-du-23-12-2024-web
- Orange Business Cameroun API SMS :
  https://business.orange.cm/fr/apis-orange/api-sms.html
- MTN Cameroon Pro SMS : https://mtn.cm/businesssolutions/mtn-pro-sms/
- Resend pricing : https://resend.com/pricing
- Twilio Cameroun : https://www.twilio.com/en-us/sms/pricing/cm

Consultation : 2026-07-22.

## 9. Handoff

- **PO** : valide le canal principal, le secours et les contraintes RH.
- **Gemini** : complète la recherche institutionnelle et opérateurs.
- **Claude** : chiffre l'implémentation après décision et construit T15.

T08 reste **Proposé** tant que les décisions du §5 ne sont pas obtenues.
