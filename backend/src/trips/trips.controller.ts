import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TripItinerary } from './dto/trip-itinerary.dto';
import { SearchTripsDto } from './dto/search-trips.dto';
import { TripsService } from './trips.service';

/**
 * Pas de garde d'authentification : la recherche d'itineraire est
 * utilisable sans compte (voir issue #64, la page /recherche du frontend
 * n'est pas un mur de connexion).
 */
@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @ApiOperation({
    summary: "Recherche d'itineraires multimodaux (F2)",
    description:
      "Delegue a OpenTripPlanner (issue #6). Tri natif OTP (duree croissante) pour l'instant, le scoring pondere (issue #16) changera l'ordre en Sprint 3.",
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
  search(@Query() dto: SearchTripsDto) {
    return this.tripsService.search(dto);
  }
}
