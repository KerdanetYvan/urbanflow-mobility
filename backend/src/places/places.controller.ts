import { Controller, Get, Query } from '@nestjs/common';
import { SearchPlacesDto } from './dto/search-places.dto';
import { PlacesService } from './places.service';

/**
 * Pas de garde d'authentification : l'autocompletion origine/destination
 * doit fonctionner pour un usager non connecte (recherche utilisable sans
 * compte, voir issue #64).
 */
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  search(@Query() dto: SearchPlacesDto) {
    return this.placesService.search(dto);
  }
}
