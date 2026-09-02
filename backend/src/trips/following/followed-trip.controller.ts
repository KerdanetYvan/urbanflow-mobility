import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { JwtPayload } from '../../auth/jwt-payload.interface';
import { StartFollowingTripDto } from './dto/start-following-trip.dto';
import { FollowedTrip } from './followed-trip.entity';
import { FollowedTripService } from './followed-trip.service';

/**
 * Le trajet actuellement suivi par l'utilisateur authentifie (issue #18) -
 * necessite un compte (docs/specs/f3-scoring-perturbations-suivi.md
 * section 3), meme garde que ProfilesController et n'agit jamais que sur le
 * suivi de l'utilisateur authentifie (`user.sub`, jamais d'id fourni par le
 * client) - meme raisonnement anti-IDOR.
 */
@ApiTags('trips')
@ApiBearerAuth('access-token')
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expire' })
@Controller('trips/current')
@UseGuards(JwtAuthGuard)
export class FollowedTripController {
  constructor(private readonly followedTripService: FollowedTripService) {}

  @Post()
  @ApiOperation({
    summary: "Demarre le suivi d'un itineraire (remplace un suivi existant)",
  })
  @ApiResponse({ status: 201, type: FollowedTrip })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartFollowingTripDto,
  ): Promise<FollowedTrip> {
    return this.followedTripService.startFollowing(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Le trajet actuellement suivi, si applicable' })
  @ApiResponse({ status: 200, type: FollowedTrip })
  @ApiResponse({ status: 404, description: 'Aucun trajet suivi actuellement' })
  async findCurrent(@CurrentUser() user: JwtPayload): Promise<FollowedTrip> {
    const followedTrip = await this.followedTripService.findCurrent(user.sub);
    if (!followedTrip) {
      throw new NotFoundException('Aucun trajet suivi actuellement');
    }
    return followedTrip;
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Arrete le suivi de trajet en cours' })
  @ApiResponse({ status: 204, description: 'Suivi arrete (ou deja absent)' })
  remove(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.followedTripService.stopFollowing(user.sub);
  }
}
