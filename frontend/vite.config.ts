import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// On importe defineConfig depuis 'vitest/config' plutot que 'vite' : c'est le
// meme objet de configuration Vite, mais avec en plus le typage de la cle
// "test" (sinon TypeScript ne connaitrait pas les options Vitest ci-dessous).
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Le service worker se met a jour tout seul (nouvelle version activee
      // au prochain chargement, sans invite a l'utilisateur) : coherent avec
      // le pipeline de deploiement continu du projet (voir docker/ci.yml) -
      // un merge sur main redeploie en continu, la PWA doit suivre sans
      // qu'un usager reste bloque sur une vieille version.
      registerType: 'autoUpdate',
      // Fichiers statiques a precacher en plus du build JS/CSS genere par
      // Vite (deja precache automatiquement par le plugin).
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'UrbanFlow Mobility',
        short_name: 'UrbanFlow',
        description:
          "Planification d'itineraires multimodaux, profils de mobilite personnalises et classement des trajets en temps reel.",
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Couleurs de la charte graphique (src/styles/tokens.css) : le
        // primaire ambre pour la barre de statut/navigateur, le fond clair
        // pour l'ecran de demarrage (splash screen) a l'installation.
        theme_color: '#f5a623',
        background_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            // "any maskable" sur la meme icone : le pin reste dans la zone
            // de securite maskable (voir le commentaire dans favicon.svg),
            // donc pas besoin d'un fichier distinct par purpose.
            purpose: 'any maskable',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Stratégies de cache runtime (éco-conception, issue #23, CLAUDE.md
        // "limiter les appels réseau superflus" + "mode dégradé"). En prod,
        // frontend et API sont servis par le même domaine (Caddy) : les
        // requêtes API sont donc same-origin et matchent par `url.pathname`.
        runtimeCaching: [
          {
            // Tuiles OpenStreetMap : le plus gros du trafic (10-30 PNG par
            // vue de carte). CacheFirst car une tuile à un (z, x, y) donné
            // ne change quasiment jamais - un pan/zoom, un changement
            // d'itinéraire ou une revisite les ressert du cache au lieu de
            // les retélécharger.
            urlPattern: ({ url }) => url.hostname.endsWith('.tile.openstreetmap.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 jours
                purgeOnQuotaError: true,
              },
              // 0 = réponses opaques (tuiles cross-origin sans CORS).
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Autocomplétion d'adresses (GET /places) : résultats très
            // stables (noms d'arrêts, adresses). CacheFirst avec un TTL
            // court élimine les appels répétés pour un même texte au cours
            // d'une session (ex. effacer puis retaper).
            urlPattern: ({ url }) => url.pathname.startsWith('/places'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'places-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 }, // 1h
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Trajets et profil (GET) : NetworkFirst - la fraîcheur prime
            // (horaires, perturbations, profil modifié), le cache ne sert
            // que de repli hors ligne (mode dégradé, cf. issue #10). TTL
            // court, aligné sur la contrainte RGPD de durée de vie du cache
            // local (dossier partie 10.2).
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/trips') ||
              url.pathname.startsWith('/profiles'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }, // 1j
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    // Simule un DOM navigateur (document, window...) necessaire pour
    // React Testing Library, puisque les tests tournent dans Node.js.
    environment: 'jsdom',
    // Fichier execute avant chaque fichier de test : ajoute les matchers
    // supplementaires de jest-dom (toBeInTheDocument(), etc.).
    setupFiles: './src/test/setup.ts',
    // Autorise describe/it/expect sans les importer explicitement dans
    // chaque fichier de test (comme le fait Jest cote backend).
    globals: true,
    // e2e/ contient les specs Playwright (issue #20, audit WCAG) : un tout
    // autre executeur de tests (vrai navigateur, pas jsdom), avec son propre
    // test.describe() incompatible avec celui de Vitest - exclu explicitement
    // pour que Vitest ne tente pas de les collecter en plus des siens.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
