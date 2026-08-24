import { defineConfig } from '@playwright/test';

/**
 * Configuration Playwright dediee a l'audit d'accessibilite WCAG 2.1 AA
 * (issue #20). Contrairement aux tests unitaires Vitest (jsdom, sans rendu
 * pixel reel), Playwright pilote un vrai navigateur : necessaire pour
 * verifier le contraste des couleurs et le comportement clavier reel, que
 * jsdom ne peut pas reproduire fidelement.
 *
 * `baseURL` cible le serveur de developpement (backend + Postgres + OTP +
 * frontend demarres via `docker compose up`, voir README) plutot qu'un
 * `webServer` demarre par Playwright lui-meme : coherent avec la pratique
 * deja suivie sur ce projet pour les verifications "en conditions reelles"
 * (issues #93, #107, #109, #112), avec de vraies donnees GTFS/OSM de Rennes
 * Metropole plutot que des mocks.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
});
