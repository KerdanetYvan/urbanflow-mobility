// Gestion des notifications push (issue #18) - script separe importe dans
// le service worker genere par Workbox (voir ../vite.config.ts,
// workbox.importScripts) : la strategie generateSW deja en place pour la
// PWA (issue #19) ne permet pas d'injecter du code personnalise directement
// dans le fichier genere - importScripts() est le mecanisme officiel de
// Workbox pour completer son comportement sans passer en mode
// injectManifest (qui changerait toute la strategie de precache actuelle).
//
// Contenu volontairement minimal (docs/specs/f3-scoring-perturbations.md
// section 3.2) : le payload envoye par PushNotificationService (backend)
// n'est que { title, body }, jamais de detail de score ni de jargon
// technique.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload.title || 'Perturbation sur votre trajet';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      // Consomme par notificationclick ci-dessous - toujours l'ecran de
      // resultats (section 3.3 : "jamais un retour a l'ecran de
      // recherche"), RecherchePage detecte le suivi actif au montage et
      // relance la recherche/affiche l'alerte "Perturbation en cours".
      data: { url: '/recherche' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/recherche';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
  );
});
