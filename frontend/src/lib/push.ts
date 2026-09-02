import { apiGet, authDelete, authPost } from './api';

/** GET /push/vapid-public-key (public) - `null` si le backend n'a pas de config VAPID (notifications desactivees, voir PushNotificationService). */
export function getVapidPublicKey(): Promise<{ publicKey: string | null }> {
  return apiGet<{ publicKey: string | null }>('/push/vapid-public-key');
}

/** Forme exacte de `PushSubscriptionJSON` (spec W3C Push API) - voir backend/src/push/dto/subscribe-push.dto.ts. */
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Enregistre l'abonnement Web Push de cet appareil (issue #18). Necessite un compte. */
export function subscribeToPush(
  subscription: PushSubscriptionPayload,
): Promise<{ id: string }> {
  return authPost<{ id: string }>('/push/subscriptions', subscription);
}

/** Retire l'abonnement Web Push de cet appareil (idempotent cote backend). */
export function unsubscribeFromPush(endpoint: string): Promise<void> {
  return authDelete<void>(
    `/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
  );
}

/**
 * Convertit une cle publique VAPID (base64url, format renvoye par
 * GET /push/vapid-public-key) en Uint8Array - format attendu par
 * `PushManager.subscribe({ applicationServerKey })`. Boilerplate standard
 * de l'API Web Push (le padding '=' est ajoute manuellement, base64url
 * n'en porte jamais).
 */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  // Construit explicitement sur un ArrayBuffer simple (pas
  // Uint8Array.from, dont le type generique large ArrayBufferLike n'est pas
  // assignable a BufferSource pour applicationServerKey en TS strict).
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

/**
 * Abonne le service worker de cet appareil aux notifications push (issue
 * #18) : demande la permission Notification si pas deja tranchee, puis
 * `pushManager.subscribe()`. Renvoie `null` (jamais d'exception) si
 * l'API Push n'est pas supportee, si la permission est refusee, ou si le
 * backend n'a pas de cle VAPID configuree - a l'appelant (bouton "Suivre ce
 * trajet") de proposer le repli bannière `Alert` dans ces cas (voir
 * docs/specs/f3-scoring-perturbations.md section 3.4).
 */
export async function subscribeBrowserToPush(): Promise<PushSubscriptionPayload | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  return subscription.toJSON() as PushSubscriptionPayload;
}
