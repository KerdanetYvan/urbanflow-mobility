import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PlaceSuggestion } from './dto/place-suggestion.dto';
import { SearchPlacesDto } from './dto/search-places.dto';
import { PlacesService } from './places.service';

/**
 * Pas de garde d'authentification : l'autocompletion origine/destination
 * doit fonctionner pour un usager non connecte (recherche utilisable sans
 * compte, voir issue #64).
 *
 * ThrottlerGuard (audit securite OWASP #262, API4) : chaque frappe delegue
 * a l'instance Nominatim auto-hebergee de la metropole - sans limite, un
 * flood anonyme peut la faire bannir ou la saturer pour tous les usagers.
 * Limite plus large que TripsController (60 vs 30/min) : le debounce cote
 * frontend (300ms, voir useAddressSuggestions.ts) genere naturellement
 * plus de requetes par minute qu'une recherche d'itineraire lors d'une
 * saisie active sur les deux champs origine/destination.
 */
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseGuards(ThrottlerGuard)
@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  @ApiOperation({
    summary: 'Autocompletion origine/destination par texte (F2)',
    description:
      "Delegue au geocodeur integre a OpenTripPlanner (issue #81) - indexe les noms d'arrets/rues deja charges dans le graphe.",
  })
  @ApiResponse({
    status: 200,
    type: PlaceSuggestion,
    isArray: true,
    description:
      "Tableau vide = aucune correspondance, ce n'est pas une erreur",
  })
  @ApiResponse({ status: 400, description: 'Parametre query manquant ou vide' })
  @ApiResponse({
    status: 503,
    description: "Moteur de calcul d'itineraires indisponible",
  })
  search(@Query() dto: SearchPlacesDto) {
    return this.placesService.search(dto);
  }
}
