import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { TripItinerary } from './dto/trip-itinerary.dto';
import { SearchTripsDto } from './dto/search-trips.dto';
import { TripsService } from './trips.service';

/**
 * Pas de garde d'authentification obligatoire : la recherche d'itineraire
 * est utilisable sans compte (voir issue #64, la page /recherche du
 * frontend n'est pas un mur de connexion). OptionalJwtAuthGuard sur
 * `search` (issue #16) peuple `user` si un token valide est fourni, sans
 * jamais renvoyer 401 - permet de personnaliser le classement des
 * itineraires selon le profil de mobilite sans exiger d'etre connecte.
 */
@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Recherche d'itineraires multimodaux (F2)",
    description:
      'Delegue a OpenTripPlanner (issue #6), puis classe le resultat par score pondere (issue #16 : duree, correspondances, et preferences du profil de mobilite si un token valide est fourni - jeton optionnel, jamais de 401).',
  })
  @ApiResponse({
    status: 200,
    type: TripItinerary,
    isArray: true,
    description:
      "Tableau vide = aucun itineraire trouve, ce n'est pas une erreur",
  })
  @ApiResponse({
    status: 400,
    description:
      'Parametres invalides, ou origine/destination hors de la zone couverte',
  })
  @ApiResponse({
    status: 503,
    description: "Moteur de calcul d'itineraires indisponible",
  })
  search(@Query() dto: SearchTripsDto, @CurrentUser() user?: JwtPayload) {
    return this.tripsService.search(dto, user?.sub);
  }
}
