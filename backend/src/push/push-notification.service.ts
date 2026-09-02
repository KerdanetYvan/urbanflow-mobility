import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';
import { PushSubscriptionService } from './push-subscription.service';

/** Contenu minimal d'une notification de perturbation (issue #18, docs/specs/f3-scoring-perturbations.md section 3.2) - jamais de jargon technique ni de valeur de score. */
export interface DisruptionNotificationPayload {
  title: string;
  body: string;
}

/**
 * Envoi de notifications Web Push (issue #18) - fine couche au-dessus de la
 * bibliotheque `web-push` (implementation standard du protocole Web Push,
 * cles VAPID). Configuree une seule fois au demarrage (onModuleInit)
 * plutot qu'a chaque envoi.
 */
@Injectable()
export class PushNotificationService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationService.name);
  private configured = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly pushSubscriptionService: PushSubscriptionService,
  ) {}

  onModuleInit(): void {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT');

    if (!publicKey || !privateKey || !subject) {
      // Degradation plutot qu'un crash au demarrage (meme esprit que
      // NominatimClientService#search sans NOMINATIM_URL) : l'app entiere ne
      // doit pas refuser de demarrer pour une fonctionnalite optionnelle
      // (suivi de trajet, issue #18) mal configuree en dev.
      this.logger.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT manquant(s) - notifications push desactivees',
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  /** Cle publique VAPID, servie par GET /push/vapid-public-key (le frontend en a besoin AVANT pushManager.subscribe()). `null` si la config VAPID est absente. */
  getPublicKey(): string | null {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }

  /**
   * Notifie tous les abonnements (appareils) connus de cet utilisateur.
   * Envoie a chacun independamment (Promise.allSettled) : l'echec d'un
   * appareil (navigateur ferme, abonnement expire) ne doit jamais empecher
   * la notification des autres appareils de la meme personne. Un endpoint
   * signale perime par le service de push (404/410) est retire
   * automatiquement (PushSubscriptionService#removeById) - inutile de
   * reessayer un appareil qui ne recevra plus jamais rien.
   */
  async notifyUser(
    userId: string,
    payload: DisruptionNotificationPayload,
  ): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        `Notification push ignoree (VAPID non configure) pour l'utilisateur ${userId}`,
      );
      return;
    }

    const subscriptions =
      await this.pushSubscriptionService.findByUserId(userId);
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dhKey,
                auth: subscription.authKey,
              },
            },
            body,
          );
        } catch (error) {
          if (
            error instanceof WebPushError &&
            (error.statusCode === 404 || error.statusCode === 410)
          ) {
            this.logger.log(
              `Abonnement push perime (${error.statusCode}) - suppression`,
            );
            await this.pushSubscriptionService.removeById(subscription.id);
            return;
          }
          this.logger.warn(
            `Echec d'envoi push a un abonnement de l'utilisateur ${userId} : ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );
  }
}
