import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Une ligne de `routes.txt`. Le spec GTFS exige route_short_name **ou**
 * route_long_name (au moins un des deux, pas les deux obligatoirement) :
 * une regle "au moins un champ parmi deux" ne s'exprime pas proprement avec
 * un seul decorateur class-validator par propriete, donc les deux restent
 * `@IsOptional()` ici et la presence d'au moins un est verifiee separement
 * par GtfsImportService apres cette validation par champ.
 */
export class GtfsRouteRowDto {
  @IsString()
  @IsNotEmpty()
  route_id: string;

  @IsOptional()
  @IsString()
  route_short_name?: string;

  @IsOptional()
  @IsString()
  route_long_name?: string;

  @IsNumberString()
  route_type: string;
}
