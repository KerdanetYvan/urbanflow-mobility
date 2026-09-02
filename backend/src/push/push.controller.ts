import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { PushNotificationService } from './push-notification.service';
import { PushSubscriptionService } from './push-subscription.service';

/**
 * Abonnements Web Push (issue #18) - suit le suivi de trajet (#18/#171 style
 * "suivre un trajet necessite un compte", voir
 * docs/specs/f3-scoring-perturbations-suivi.md section 3) : toutes les
 * routes de gestion d'abonnement exigent un compte, seule la cle publique
 * VAPID est accessible sans authentification (necessaire AVANT que le
 * frontend puisse meme demander la permission de notification).
 */
@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
    private readonly pushSubscriptionService: PushSubscriptionService,
  ) {}

  @Get('vapid-public-key')
  @ApiOperation({
    summary: 'Cle publique VAPID, necessaire avant pushManager.subscribe()',
  })
  @ApiResponse({
    status: 200,
    description:
      '`{ publicKey: string | null }` - `null` si la config VAPID est absente cote serveur',
  })
  getPublicKey(): { publicKey: string | null } {
    return { publicKey: this.pushNotificationService.getPublicKey() };
  }

  @Post('subscriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Enregistre l'abonnement Web Push de cet appareil",
  })
  @ApiResponse({
    status: 201,
    description: 'Abonnement enregistre (upsert par endpoint)',
  })
  @ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expire' })
  subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubscribePushDto,
  ): Promise<{ id: string }> {
    return this.pushSubscriptionService
      .subscribe(user.sub, dto)
      .then((subscription) => ({ id: subscription.id }));
  }

  @Delete('subscriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Retire l'abonnement Web Push de cet appareil" })
  @ApiResponse({
    status: 204,
    description: 'Abonnement retire (ou deja absent)',
  })
  @ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expire' })
  unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Query('endpoint') endpoint: string,
  ): Promise<void> {
    return this.pushSubscriptionService.unsubscribe(user.sub, endpoint);
  }
}
