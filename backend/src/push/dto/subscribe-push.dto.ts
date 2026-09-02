import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, ValidateNested } from 'class-validator';

/**
 * Cles de chiffrement d'un abonnement Web Push (issue #18) - forme exacte de
 * `PushSubscriptionJSON.keys` cote navigateur (spec W3C Push API), envoyee
 * telle quelle par le frontend apres `pushManager.subscribe()`.
 */
export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Cle publique de chiffrement du navigateur' })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({ description: "Secret d'authentification du navigateur" })
  @IsString()
  @IsNotEmpty()
  auth: string;
}

/**
 * Corps de POST /push/subscriptions (issue #18) - reprend directement
 * `JSON.stringify(subscription)` d'un `PushSubscription` navigateur, sans
 * transformation cote frontend (voir lib/push.ts). Premier DTO imbrique de
 * ce projet (@ValidateNested/@Type) : la forme W3C Push API est nativement
 * imbriquee (endpoint + keys.{p256dh,auth}), la reproduire telle quelle
 * evite au frontend de la re-aplatir sans raison.
 */
export class SubscribePushDto {
  @ApiProperty({
    description: 'URL du service de push du navigateur',
    example: 'https://fcm.googleapis.com/fcm/send/abc123',
  })
  @IsUrl({ require_tld: false })
  endpoint: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}
