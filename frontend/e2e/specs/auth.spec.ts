import { test, expect, TEST_USERS } from '../fixtures/auth.fixture';

test.describe('Feature: Authentification 2FA', () => {

  /**
   * SCENARIO 1: La page de connexion s'affiche correctement
   *
   *   GIVEN  un utilisateur non connecté
   *   WHEN   il accède à l'application
   *   THEN   le formulaire de connexion s'affiche avec institution, matricule, mot de passe
   *   AND    la section démo est visible
   */
  test('Given non connecté, When accès app, Then formulaire login visible', async ({ loginPage }) => {
    // GIVEN & WHEN
    await loginPage.goto();

    // THEN
    await loginPage.expectLoginPageVisible();

    // AND
    await expect(loginPage.demoSection).toBeVisible();
  });

  /**
   * SCENARIO 2: Login réussi → étape OTP
   *
   *   GIVEN  un utilisateur sur la page de connexion
   *   WHEN   il saisit institution + matricule + mot de passe valides
   *   AND    il soumet le formulaire
   *   THEN   l'étape OTP s'affiche avec 6 champs
   *   AND    le code OTP est pré-rempli (mode dev)
   */
  test('Given credentials valides, When login, Then étape OTP affichée et pré-remplie', async ({ loginPage }) => {
    // GIVEN
    await loginPage.goto();
    const creds = TEST_USERS.tenant_admin;

    // WHEN
    await loginPage.fillCredentials(creds.institution, creds.matricule, creds.password);

    // AND
    await loginPage.submitLogin();

    // THEN
    await loginPage.waitForOtpStep();
    await expect(loginPage.otpInputs).toHaveCount(6);

    // AND — en dev mode l'OTP est auto-rempli
    await loginPage.expectOtpPreFilled();
  });

  /**
   * SCENARIO 3: Login complet → arrivée sur le dashboard
   *
   *   GIVEN  un utilisateur qui a passé l'étape credentials
   *   AND    l'OTP est pré-rempli (dev mode)
   *   WHEN   il confirme l'OTP
   *   THEN   il est redirigé vers /dashboard
   */
  test('Given OTP pré-rempli, When confirmer, Then redirect dashboard', async ({ loginAs }) => {
    // GIVEN + WHEN + THEN — la fixture loginAs fait tout le flow
    await loginAs('tenant_admin');
  });

  /**
   * SCENARIO 4: Login échoué avec mauvais mot de passe
   *
   *   GIVEN  un utilisateur sur la page de connexion
   *   WHEN   il saisit un matricule valide mais un mauvais mot de passe
   *   AND    il soumet le formulaire
   *   THEN   un message d'erreur s'affiche
   *   AND    il reste sur la page de connexion
   */
  test('Given mauvais password, When login, Then erreur affichée', async ({ loginPage }) => {
    // GIVEN
    await loginPage.goto();

    // WHEN
    await loginPage.fillCredentials(
      'Ministère des Finances (MINFI)',
      'MINFI001',
      'WrongPassword123'
    );

    // AND
    await loginPage.submitLogin();

    // THEN
    await loginPage.expectErrorVisible();

    // AND
    await loginPage.expectLoginPageVisible();
  });

  /**
   * SCENARIO 5: Formulaire vide ne soumet pas
   *
   *   GIVEN  un utilisateur sur la page de connexion
   *   WHEN   il clique sur soumettre sans remplir les champs
   *   THEN   il reste sur la page de connexion (validation HTML5)
   */
  test('Given champs vides, When submit, Then reste sur login', async ({ loginPage }) => {
    // GIVEN
    await loginPage.goto();

    // WHEN
    await loginPage.submitLogin();

    // THEN — HTML5 required validation prevents submission
    await loginPage.expectLoginPageVisible();
  });

  /**
   * SCENARIO 6: Retour de l'étape OTP vers login
   *
   *   GIVEN  un utilisateur sur l'étape OTP
   *   WHEN   il clique "Utiliser une autre méthode"
   *   THEN   il revient sur le formulaire de connexion
   */
  test('Given étape OTP, When clic retour, Then retour au login', async ({ loginPage }) => {
    // GIVEN — atteindre l'étape OTP
    await loginPage.goto();
    const creds = TEST_USERS.tenant_admin;
    await loginPage.fillCredentials(creds.institution, creds.matricule, creds.password);
    await loginPage.submitLogin();
    await loginPage.waitForOtpStep();

    // WHEN
    await loginPage.goBackToLogin();

    // THEN
    await loginPage.expectLoginPageVisible();
  });
});

test.describe('Feature: Profils démo', () => {

  /**
   * SCENARIO 7: Sélection d'un profil démo pré-remplit le formulaire
   *
   *   GIVEN  un utilisateur sur la page de connexion
   *   WHEN   il clique sur "Admin Tenant" dans la section démo
   *   THEN   les champs institution, matricule et mot de passe sont pré-remplis
   */
  test('Given page login, When clic profil démo, Then champs pré-remplis', async ({ loginPage }) => {
    // GIVEN
    await loginPage.goto();

    // WHEN
    await loginPage.selectDemoProfile('Admin Tenant');

    // THEN
    await loginPage.expectFieldsPreFilled();
    await expect(loginPage.matriculeInput).toHaveValue('MINFI001');
  });

  /**
   * SCENARIO 8: Chaque profil démo peut se connecter
   *
   *   GIVEN  les 7 profils démo existent
   *   WHEN   on sélectionne un profil et on soumet
   *   THEN   l'étape OTP s'affiche (prouve que les credentials sont valides)
   */
  test('Given profil Super Admin, When login via démo, Then OTP atteint', async ({ loginPage }) => {
    // GIVEN
    await loginPage.goto();

    // WHEN
    await loginPage.selectDemoProfile('Super Admin');
    await loginPage.submitLogin();

    // THEN
    await loginPage.waitForOtpStep();
  });
});

test.describe('Feature: Protection des routes', () => {

  /**
   * SCENARIO 9: Accès non-authentifié → page login
   *
   *   GIVEN  aucun token en session
   *   WHEN   accès direct à /dashboard
   *   THEN   la page de connexion s'affiche
   */
  test('Given non-authentifié, When accès /dashboard, Then login affiché', async ({ loginPage }) => {
    // GIVEN — pas de session

    // WHEN
    await loginPage.page.goto('dashboard');

    // THEN
    await loginPage.expectLoginPageVisible();
  });
});
