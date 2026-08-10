import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Une ligne de `calendar.txt`. Les 7 colonnes jour ne valent que '0' ou '1'
 * (spec GTFS), et start_date/end_date sont au format YYYYMMDD (8 chiffres,
 * pas de tirets) - verifie ici par regex plutot que par une conversion en
 * Date, pour rester coherent avec le fait que toute la validation porte sur
 * des chaines de caracteres brutes issues du CSV.
 */
export class GtfsCalendarRowDto {
  @IsString()
  @IsNotEmpty()
  service_id: string;

  @IsIn(['0', '1'])
  monday: string;

  @IsIn(['0', '1'])
  tuesday: string;

  @IsIn(['0', '1'])
  wednesday: string;

  @IsIn(['0', '1'])
  thursday: string;

  @IsIn(['0', '1'])
  friday: string;

  @IsIn(['0', '1'])
  saturday: string;

  @IsIn(['0', '1'])
  sunday: string;

  @Matches(/^\d{8}$/)
  start_date: string;

  @Matches(/^\d{8}$/)
  end_date: string;
}
