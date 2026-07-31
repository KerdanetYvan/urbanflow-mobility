import { Controller, Get, Query } from '@nestjs/common';
import { SearchTripsDto } from './dto/search-trips.dto';
import { TripsService } from './trips.service';

/**
 * Pas de garde d'authentification : la recherche d'itineraire est
 * utilisable sans compte (voir issue #64, la page /recherche du frontend
 * n'est pas un mur de connexion).
 */
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  search(@Query() dto: SearchTripsDto) {
    return this.tripsService.search(dto);
  }
}
