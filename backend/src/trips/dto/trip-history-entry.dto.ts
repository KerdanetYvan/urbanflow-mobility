import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Forme renvoyee par GET /trips/history (issue #11) - une entree
 * dedupliquee de l'historique de recherche de l'utilisateur authentifie
 * (voir TripHistoryService#findRecent). `id` correspond a l'entree la plus
 * recente representant ce couple origine/destination, `lastSearchedAt` a sa
 * date de recherche.
 */
export class TripHistoryEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  originLat: number;

  @ApiProperty()
  originLon: number;

  @ApiPropertyOptional({
    description:
      "Libelle d'adresse d'origine si fourni a la recherche, absent sinon",
  })
  originLabel?: string;

  @ApiProperty()
  destinationLat: number;

  @ApiProperty()
  destinationLon: number;

  @ApiPropertyOptional({
    description:
      "Libelle d'adresse de destination si fourni a la recherche, absent sinon",
  })
  destinationLabel?: string;

  @ApiProperty({
    description:
      'Date/heure (ISO 8601) de la recherche la plus recente pour ce couple origine/destination',
  })
  lastSearchedAt: string;
}
