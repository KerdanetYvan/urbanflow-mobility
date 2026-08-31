import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TransportMode } from '../../profiles/transport-mode.enum';

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

  /**
   * Modes de transport préférés à privilégier pour cette recherche (issue
   * #87), alignés sur l'enum TransportMode (profiles/transport-mode.enum.ts).
   *
   * Accepté sous deux formes en query string, normalisées en tableau par le
   * @Transform ci-dessous :
   *   - paramètre répété : `?transportModes=bus&transportModes=tram`
   *   - liste séparée par des virgules : `?transportModes=bus,tram`
   *
   * Absent ou vide = aucun filtre, tous les modes considérés (comportement
   * historique, docs/specs/filtre-modes-transport.md section 6). Les modes
   * pas encore routables par OTP (vélo/trottinette GBFS, covoiturage) sont
   * acceptés ici mais ignorés au calcul d'itinéraire (voir otp-modes.ts).
   */
  @ApiPropertyOptional({
    enum: TransportMode,
    isArray: true,
    example: [TransportMode.BUS, TransportMode.TRAM],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((mode) => mode.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsEnum(TransportMode, { each: true })
  transportModes?: TransportMode[];
}
