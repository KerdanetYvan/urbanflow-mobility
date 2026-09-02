import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushNotificationService } from './push-notification.service';
import { PushSubscription } from './push-subscription.entity';
import { PushSubscriptionService } from './push-subscription.service';
import { PushController } from './push.controller';

/**
 * Abonnements et envoi de notifications Web Push (issue #18). Independant
 * du suivi de trajet lui-meme (FollowedTrip, trips/following/) : un
 * abonnement push est lie a un appareil, pas a un trajet - reutilisable si
 * une autre fonctionnalite du produit avait un jour besoin de notifications
 * push.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription])],
  controllers: [PushController],
  providers: [PushSubscriptionService, PushNotificationService],
  exports: [PushSubscriptionService, PushNotificationService],
})
export class PushModule {}
