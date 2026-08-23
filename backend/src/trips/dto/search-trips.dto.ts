import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Parametres de GET /trips (issue #7).
 *
 * Origine/destination en coordonnees uniquement (pas de texte libre) :
 * decision de scope prise en session - transformer une adresse tapee par
 * l'utilisateur en coordonnees (autocompletion) est un probleme a part
 * entiere, non couvert par ce ticket (voir issue #81, geocodage).
 */
export class SearchTripsDto {
  @ApiProperty({ example: 48.111 })
  @Type(() => Number)
  @IsLatitude()
  originLat: number;

  @ApiProperty({ example: -1.682 })
  @Type(() => Number)
  @IsLongitude()
  originLon: number;

  @ApiProperty({ example: 48.127 })
  @Type(() => Number)
  @IsLatitude()
  destinationLat: number;

  @ApiProperty({ example: -1.682 })
  @Type(() => Number)
  @IsLongitude()
  destinationLon: number;

  /**
   * Date/heure de depart souhaitee (ISO 8601). Absente = "maintenant"
   * (comportement par defaut de l'ecran de recherche, voir
   * docs/specs/f2-ecrans-planification.md section 2.1). Pas encore de
   * support "arriver avant" (arriveBy) : OTP le permet nativement, a
   * ajouter si besoin quand l'ecran de recherche (#35) l'exposera.
   */
  @ApiPropertyOptional({
    example: '2026-08-01T06:00:00.000Z',
    description: 'ISO 8601. Absent = maintenant.',
  })
  @IsOptional()
  @IsISO8601()
  departureTime?: string;

  /**
   * Libelle d'adresse d'origine (ex. "Part-Dieu"), envoye uniquement par le
   * frontend quand l'utilisateur est authentifie (voir RecherchePage.tsx) -
   * sert uniquement a l'historique des trajets (issue #11,
   * TripHistoryService#record) pour afficher un libelle lisible plutot que
   * des coordonnees brutes ; jamais transmis a OpenTripPlanner. Absent =
   * pas de libellé disponible (ex. position geolocalisee).
   */
  @ApiPropertyOptional({ example: 'Part-Dieu' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originLabel?: string;

  @ApiPropertyOptional({ example: 'Bellecour' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destinationLabel?: string;
}
