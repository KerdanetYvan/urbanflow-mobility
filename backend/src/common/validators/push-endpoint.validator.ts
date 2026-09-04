import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Hebergeurs connus de service Web Push (audit securite OWASP #262, API7 -
 * SSRF). Un `PushSubscription.endpoint` genere par un vrai navigateur
 * (`pushManager.subscribe()`) provient TOUJOURS d'un de ces services : le
 * navigateur choisit l'URL, jamais l'utilisateur. `@IsUrl` seul acceptait
 * n'importe quelle URL "bien formee", y compris une IP privee/localhost -
 * or `TripDisruptionMonitorService` envoie automatiquement une requete
 * serveur->endpoint des qu'une perturbation touche un trajet suivi, sans
 * jamais renvoyer la reponse a l'appelant (SSRF aveugle vers le reseau
 * interne si l'endpoint est falsifie).
 *
 * Liste volontairement limitee aux navigateurs majeurs plutot qu'une
 * detection generique d'IP privee : plus simple, plus robuste (pas de
 * contournement par DNS rebinding), quitte a devoir l'etendre si un
 * nouveau moteur de navigateur est supporte.
 */
const ALLOWED_PUSH_ENDPOINT_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge, Opera, Brave (Firebase Cloud Messaging)
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com', // Safari
];

/**
 * Vrai si `value` est une URL https dont l'hote correspond exactement a un
 * service de push autorise (ou a un sous-domaine direct) - jamais par
 * simple inclusion de chaine, qui serait contournable
 * (ex: "fcm.googleapis.com.attacker.test").
 */
function isAllowedPushEndpoint(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;

  return ALLOWED_PUSH_ENDPOINT_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

/**
 * Decorateur class-validator : remplace `@IsUrl` sur
 * `SubscribePushDto.endpoint` pour restreindre les valeurs acceptees a la
 * liste `ALLOWED_PUSH_ENDPOINT_HOSTS` ci-dessus plutot qu'a n'importe quelle
 * URL syntaxiquement valide.
 */
export function IsPushEndpoint(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPushEndpoint',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isAllowedPushEndpoint(value);
        },
        defaultMessage() {
          return "URL de service de push non reconnue (doit provenir d'un navigateur standard : Chrome, Firefox, Safari, Edge...)";
        },
      },
    });
  };
}
