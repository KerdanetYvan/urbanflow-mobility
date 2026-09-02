import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { createEncryptedColumnTransformer } from '../common/encryption/encrypted-column.transformer';
import { User } from '../users/user.entity';

/**
 * Un abonnement Web Push d'un utilisateur (issue #18) - un navigateur/appareil
 * enregistre pour recevoir des notifications de perturbation sur son trajet
 * suivi (voir FollowedTrip, PushNotificationService). Plusieurs abonnements
 * possibles par utilisateur (un par appareil/navigateur, ex. telephone +
 * ordinateur) - contrairement a FollowedTrip (un seul suivi actif),
 * `ManyToOne` plutot que `OneToOne`.
 *
 * `endpoint`/`p256dh`/`auth` chiffres au repos (createEncryptedColumnTransformer,
 * meme mecanisme que TripHistoryEntry - RGPD, docs/specs/f3-scoring-perturbations-suivi.md
 * section 6) : l'endpoint identifie un appareil de facon quasi unique, donnee
 * personnelle au meme titre qu'une adresse IP. Consequence directe (voir
 * PushSubscriptionService) : impossible de faire un `WHERE endpoint = ...`
 * en SQL (chaque chiffrement genere un IV aleatoire, deux ecritures du meme
 * endpoint ne sont jamais identiques en base) - la deduplication au
 * (ré)abonnement se fait en memoire, apres dechiffrement, meme motif que
 * TripHistoryEntry#findRecent.
 */
@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** URL du service de push du navigateur (ex. https://fcm.googleapis.com/fcm/send/...) - voir PushSubscriptionJSON.endpoint cote navigateur. */
  @Column({
    name: 'endpoint',
    type: 'text',
    transformer: createEncryptedColumnTransformer<string>(),
  })
  endpoint: string;

  /** Cle publique de chiffrement du navigateur (PushSubscriptionJSON.keys.p256dh), necessaire pour chiffrer le payload envoye (web-push). */
  @Column({
    name: 'p256dh_key',
    type: 'text',
    transformer: createEncryptedColumnTransformer<string>(),
  })
  p256dhKey: string;

  /** Secret d'authentification du navigateur (PushSubscriptionJSON.keys.auth), meme usage que p256dhKey. */
  @Column({
    name: 'auth_key',
    type: 'text',
    transformer: createEncryptedColumnTransformer<string>(),
  })
  authKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
