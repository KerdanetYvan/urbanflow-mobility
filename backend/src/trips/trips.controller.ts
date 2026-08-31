import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { TripSearchResult } from './dto/trip-itinerary.dto';
import { TripHistoryEntryDto } from './dto/trip-history-entry.dto';
import { SearchTripsDto } from './dto/search-trips.dto';
import { TripHistoryService } from './history/trip-history.service';
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
  constructor(
    private readonly tripsService: TripsService,
    private readonly tripHistoryService: TripHistoryService,
  ) {}

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
    type: TripSearchResult,
    description:
      "`itineraries` vide = aucun itineraire trouve, ce n'est pas une erreur. `fallback` present = repli a pied propose faute de transport en commun (issue #190).",
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

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Historique des trajets recemment recherches (issue #11)',
    description:
      'Necessite un compte (JwtAuthGuard obligatoire, contrairement a la recherche) - chaque recherche authentifiee via GET /trips est enregistree automatiquement cote serveur (TripHistoryService#record). Renvoie les couples origine/destination distincts les plus recents, deja deduplique et trie par recence.',
  })
  @ApiResponse({
    status: 200,
    type: TripHistoryEntryDto,
    isArray: true,
    description: 'Tableau vide = aucun trajet recherche pour le moment',
  })
  @ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expire' })
  findHistory(@CurrentUser() user: JwtPayload) {
    return this.tripHistoryService.findRecent(user.sub);
  }
}
