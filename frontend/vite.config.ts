import { defineConfig } from 'vitest/config'
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
        // Strategie de cache runtime pour les appels a l'API backend :
        // NetworkFirst essaie toujours le reseau en premier (donnees
        // fraiches en priorite - un itineraire recalcule ne doit pas servir
        // une reponse perimee), et ne retombe sur le cache que si le reseau
        // echoue (connectivite variable en mobilite, cf. contrainte
        // transverse "Performances" du projet). Regle generique (prefixe
        // /api/, pas un pattern par endpoint) qui suffit pour ce qui existe
        // aujourd'hui (auth, profil) - a REVOIR au cas par cas quand les
        // endpoints F2/F3 arriveront (recherche d'itineraires, GTFS-RT...),
        // chacun n'ayant pas forcement besoin de la meme strategie ni de la
        // meme duree de cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                // 1 jour : les donnees de trajet (horaires, perturbations)
                // se perinent vite, pas la peine de les garder plus
                // longtemps en cache (voir aussi la contrainte RGPD sur la
                // duree de vie du cache local, dossier partie 10.2).
                maxAgeSeconds: 60 * 60 * 24,
              },
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
  },
})
