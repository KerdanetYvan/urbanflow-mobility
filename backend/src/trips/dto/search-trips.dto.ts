import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
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
  @Type(() => Number)
  @IsLatitude()
  originLat: number;

  @Type(() => Number)
  @IsLongitude()
  originLon: number;

  @Type(() => Number)
  @IsLatitude()
  destinationLat: number;

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
  @IsOptional()
  @IsISO8601()
  departureTime?: string;
}
