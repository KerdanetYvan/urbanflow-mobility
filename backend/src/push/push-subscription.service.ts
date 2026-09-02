import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SubscribePushDto } from './dto/subscribe-push.dto';
import { PushSubscription } from './push-subscription.entity';

/**
 * Gere les abonnements Web Push d'un utilisateur (issue #18) - voir
 * PushSubscription pour le contrat RGPD (chiffrement au repos).
 */
@Injectable()
export class PushSubscriptionService {
  constructor(
    @InjectRepository(PushSubscription)
    private readonly repository: Repository<PushSubscription>,
  ) {}

  /**
   * Enregistre un abonnement (POST /push/subscriptions). Upsert par
   * `endpoint` decrypte plutot qu'une contrainte SQL UNIQUE (impossible sur
   * une colonne chiffree, voir PushSubscription) : charge les abonnements
   * existants de l'utilisateur, decrypte-compare en memoire - un
   * re-abonnement du meme appareil (endpoint deja connu, cles parfois
   * renouvelees par le navigateur) met a jour la ligne existante plutot que
   * d'en creer une seconde, qui recevrait sinon deux notifications
   * identiques au meme appareil.
   */
  async subscribe(
    userId: string,
    dto: SubscribePushDto,
  ): Promise<PushSubscription> {
    const existing = await this.repository.find({ where: { userId } });
    const match = existing.find((sub) => sub.endpoint === dto.endpoint);

    if (match) {
      match.p256dhKey = dto.keys.p256dh;
      match.authKey = dto.keys.auth;
      return this.repository.save(match);
    }

    return this.repository.save(
      this.repository.create({
        userId,
        endpoint: dto.endpoint,
        p256dhKey: dto.keys.p256dh,
        authKey: dto.keys.auth,
      }),
    );
  }

  /**
   * Retire un abonnement par endpoint (DELETE /push/subscriptions) - meme
   * raisonnement de comparaison en memoire que subscribe(). Idempotent :
   * aucune correspondance ne leve pas d'erreur (l'etat final voulu -
   * "cet endpoint n'est plus abonne" - est deja atteint).
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    const existing = await this.repository.find({ where: { userId } });
    const match = existing.find((sub) => sub.endpoint === endpoint);
    if (match) {
      await this.repository.remove(match);
    }
  }

  /** Tous les abonnements actifs d'un utilisateur (voir PushNotificationService#notifyUser). */
  findByUserId(userId: string): Promise<PushSubscription[]> {
    return this.repository.find({ where: { userId } });
  }

  /** Supprime un abonnement par id - utilise par PushNotificationService quand le service de push signale un endpoint perime (410 Gone/404). */
  removeById(id: string): Promise<void> {
    return this.repository.delete({ id }).then(() => undefined);
  }
}
