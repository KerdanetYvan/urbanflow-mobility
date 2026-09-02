import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SharedMobilityStation } from './dto/shared-mobility-station.dto';
import { GbfsCacheService } from './gbfs-cache.service';

/**
 * Expose les stations/vehicules en libre-service (F3, issue #13) pour
 * affichage sur la carte (MapView, frontend). Pas de garde d'authentification
 * (meme raisonnement que PlacesController/TripsController) : la carte est
 * consultable sans compte.
 */
@ApiTags('shared-mobility')
@Controller('shared-mobility-stations')
export class GbfsController {
  constructor(private readonly gbfsCacheService: GbfsCacheService) {}

  @Get()
  @ApiOperation({
    summary:
      'Stations/vehicules en libre-service disponibles (velos, trottinettes)',
    description:
      "Cache rafraichi en arriere-plan (GbfsCacheService, toutes les minutes) - repond immediatement sans jamais interroger le flux GBFS de l'operateur a la volee.",
  })
  @ApiResponse({
    status: 200,
    type: SharedMobilityStation,
    isArray: true,
    description:
      "Tableau vide = aucune station connue (flux operateur pas encore charge ou en panne), ce n'est pas une erreur",
  })
  findAll(): SharedMobilityStation[] {
    return this.gbfsCacheService.getStations();
  }
}
