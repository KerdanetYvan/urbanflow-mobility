import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Audit d'accessibilite WCAG 2.1 AA (issue #20).
 *
 * Verifie les 7 ecrans cles identifies dans docs/specs/plan-tests-transverse.md
 * section 2.2, contre un vrai navigateur (Chromium) et de vraies donnees
 * GTFS/OSM de Rennes Metropole - pas de mock, dans la continuite des
 * verifications "en conditions reelles" deja pratiquees sur ce projet
 * (issues #93, #107, #109, #112).
 *
 * Chaque test echoue si axe-core remonte une violation : le but n'est pas
 * seulement de produire un rapport, mais de forcer la correction avant que
 * l'audit soit considere termine (critere d'acceptation "rapport d'audit
 * sans erreur bloquante").
 */

/** Compte de test dedie a l'audit, cree une seule fois avant les tests (voir README pour la procedure). */
const AUDIT_EMAIL = 'audit-wcag@test.local';
const AUDIT_PASSWORD = 'AuditWcag123!';

/**
 * Lance axe-core sur la page courante et echoue le test en listant les
 * violations trouvees (regle, impact, nombre d'elements concernes) plutot
 * qu'un message generique - necessaire pour corriger efficacement.
 */
async function expectNoAxeViolations(page: Page) {
  // Les ecrans hors /recherche sont charges a la demande (React.lazy, issue
  // #23) : tant que le chunk n'est pas resolu, seule la doublure de
  // <Suspense> (un Skeleton, sans <main> ni <h1>) est dans le DOM. Attendre
  // le <h1> de l'ecran garantit qu'on lance axe sur la vraie page et non sur
  // cet etat de chargement transitoire (meme precaution que le test
  // "Recherche avec resultats" qui attend une card avant d'auditer).
  await page.locator('h1').first().waitFor({ state: 'attached', timeout: 15_000 });

  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations
    .map(
      (v) =>
        `- [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} element(s))\n` +
        v.nodes.map((n) => `    ${n.target.join(' ')}`).join('\n'),
    )
    .join('\n');
  expect(results.violations, summary).toEqual([]);
}

/** Connexion via le formulaire reel (pas d'injection de jeton en storage) - coherent avec le reste du parcours audite. */
async function login(page: Page) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse email').fill(AUDIT_EMAIL);
  await page.getByLabel('Mot de passe').fill(AUDIT_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(recherche|profil)/);
}

test.describe('Écrans publics', () => {
  const publicPages: Array<[string, string]> = [
    ['Connexion', '/connexion'],
    ['Recherche (sans résultats)', '/recherche'],
    ['Mot de passe oublié', '/mot-de-passe-oublie'],
    ['Réinitialiser le mot de passe', '/reset-password?token=audit-dummy-token'],
  ];

  for (const [name, url] of publicPages) {
    test(name, async ({ page }) => {
      await page.goto(url);
      await expectNoAxeViolations(page);
    });
  }
});

test.describe('Écrans authentifiés', () => {
  test('Profil', async ({ page }) => {
    await login(page);
    await page.goto('/profil');
    await expectNoAxeViolations(page);
  });

  test('Historique', async ({ page }) => {
    await login(page);
    await page.goto('/historique');
    await expectNoAxeViolations(page);
  });
});

test.describe('Recherche avec résultats', () => {
  test('Résultats de recherche affichés', async ({ page }) => {
    await page.goto('/recherche');

    await page.getByLabel('Origine', { exact: true }).fill('Gares');
    await page.getByRole('button', { name: /Gares/ }).first().click();

    await page.getByLabel('Destination', { exact: true }).fill('République');
    await page.getByRole('button', { name: /République/ }).first().click();

    await page.getByRole('button', { name: 'Rechercher' }).click();
    // Un itineraire affiche confirme que les resultats sont bien rendus
    // (pas seulement un etat de chargement) avant de lancer axe.
    await page.locator('.resultats-card, .resultats-empty, .alert-error').first().waitFor({ timeout: 15_000 });

    await expectNoAxeViolations(page);
  });
});

test.describe('Navigation clavier', () => {
  test('Popover "Modes de transport" : ouverture/fermeture au clavier', async ({ page }) => {
    await page.goto('/recherche');

    const trigger = page.getByRole('button', { name: /Modes de transport/ });
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#recherche-modes-panel')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Le focus doit revenir explicitement au declencheur a la fermeture
    // (spec docs/specs/filtre-modes-transport.md section 3).
    await expect(trigger).toBeFocused();
  });

  test('Formulaire de recherche : parcours complet au clavier sans piège', async ({ page }) => {
    await page.goto('/recherche');

    // Tabule depuis le premier champ jusqu'au bouton "Rechercher" et verifie
    // qu'aucune etape ne bloque (chaque Tab doit deplacer le focus vers un
    // element different de celui d'avant).
    await page.getByLabel('Origine', { exact: true }).focus();
    let previous = await page.evaluate(() => document.activeElement?.outerHTML ?? '');
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      const current = await page.evaluate(() => document.activeElement?.outerHTML ?? '');
      expect(current, `Le focus n'a pas bouge a l'etape ${i}`).not.toEqual(previous);
      previous = current;
    }
  });
});

test.describe('Mise en page mobile', () => {
  test(
    "Le CTA de l'onboarding n'est jamais recouvert par la nav fixe (issue #251)",
    async ({ page }) => {
      // Viewport mobile explicite (390x844, iPhone 12/13 - le reste de la
      // suite tourne au viewport desktop par defaut de playwright.config.ts,
      // ce bug n'existant qu'en dessous de 768px ou la nav passe en
      // `position: fixed` bas d'ecran, voir AppLayout.css).
      await page.setViewportSize({ width: 390, height: 844 });

      // Compte volontairement sans profil (voir backend/src/seed/seed.ts)
      // pour atterrir sur l'onboarding plutot que le formulaire d'edition -
      // etape 1 (modes de transport, la plus longue) est celle ou le
      // chevauchement etait mesure.
      await page.goto('/connexion');
      await page.getByLabel('Adresse email').fill('sans-profil@urbanflow.test');
      await page.getByLabel('Mot de passe').fill('SansProfil123!');
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await page.waitForURL(/\/profil/);

      const nav = page.locator('.app-nav');
      const actions = page.locator('.onboarding-actions');
      await expect(actions).toBeVisible();

      const navBox = await nav.boundingBox();
      const actionsBox = await actions.boundingBox();
      expect(navBox).not.toBeNull();
      expect(actionsBox).not.toBeNull();

      // Chevauchement = combien le bas du CTA depasse le haut de la nav.
      // <= 0 signifie aucun chevauchement (le CTA s'arrete au-dessus, ou
      // exactement a la limite, de la zone occupee par la nav).
      const overlap = actionsBox!.y + actionsBox!.height - navBox!.y;
      expect(overlap, 'Le CTA "Passer"/"Continuer" chevauche la nav fixe').toBeLessThanOrEqual(0);
    },
  );
});
