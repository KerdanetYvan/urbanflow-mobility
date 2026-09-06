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
 * Resultat detaille de subscribeBrowserToPush (issue #277). Auparavant la
 * fonction renvoyait `PushSubscriptionPayload | null` : un `null` recouvrait
 * indistinctement "navigateur sans API Push", "serveur sans cle VAPID",
 * "refus deja memorise", "refus a l'instant" et "demande fermee sans
 * reponse", ce qui rendait impossible d'afficher un message adapte. Chaque
 * cause a maintenant son `status`.
 */
export type PushSubscribeOutcome =
  /** Abonnement cree, `subscription` prete a envoyer a POST /push/subscriptions. */
  | { status: 'subscribed'; subscription: PushSubscriptionPayload }
  /** Le navigateur ne fournit pas l'API Push / Notification (ex. iOS hors PWA installee). */
  | { status: 'unsupported' }
  /** GET /push/vapid-public-key renvoie `null` : le backend n'a pas de config VAPID (voir PushNotificationService). */
  | { status: 'server-unconfigured' }
  /**
   * `Notification.permission` valait deja `'denied'` : le navigateur a
   * memorise un refus anterieur et ne reaffichera plus jamais la demande
   * systeme. Seule issue pour l'utilisateur : reautoriser dans les reglages
   * du navigateur.
   */
  | { status: 'permission-blocked' }
  /** L'utilisateur vient de choisir "Bloquer" dans la demande systeme affichee a l'instant. */
  | { status: 'permission-denied' }
  /** Demande systeme affichee puis fermee sans choix (`'default'`) - une nouvelle tentative la reaffichera. */
  | { status: 'permission-dismissed' }
  /** Echec inattendu de `pushManager.subscribe()` malgre une permission accordee. */
  | { status: 'error' };

/**
 * Abonne le service worker de cet appareil aux notifications push (issue
 * #18) : verifie le support navigateur, recupere la cle VAPID du backend,
 * demande la permission Notification si elle n'est pas deja tranchee, puis
 * `pushManager.subscribe()`.
 *
 * Ne leve jamais : tout echec est traduit en un `status` explicite (voir
 * PushSubscribeOutcome) pour que l'appelant - le bouton "Suivre ce trajet",
 * TripFollowButton - affiche un message de repli adapte a la cause (issue
 * #277) plutot qu'un unique "Notifications desactivees" pour tous les cas.
 *
 * @returns un `PushSubscribeOutcome` : `{ status: 'subscribed', subscription }`
 *   en cas de succes, sinon un `status` decrivant precisement l'echec.
 */
export async function subscribeBrowserToPush(): Promise<PushSubscribeOutcome> {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return { status: 'unsupported' };
  }

  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) return { status: 'server-unconfigured' };

  // Distinction cle de #277 : un `'denied'` DEJA en place signifie que
  // `requestPermission()` va resoudre immediatement sans reafficher la
  // demande systeme - c'est un refus memorise, pas un choix a l'instant.
  if (Notification.permission === 'denied') {
    return { status: 'permission-blocked' };
  }

  const permission = await Notification.requestPermission();
  if (permission === 'denied') return { status: 'permission-denied' };
  // `'default'` = demande fermee (echap, clic hors du popup) sans trancher.
  if (permission !== 'granted') return { status: 'permission-dismissed' };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    return {
      status: 'subscribed',
      subscription: subscription.toJSON() as PushSubscriptionPayload,
    };
  } catch {
    return { status: 'error' };
  }
}
