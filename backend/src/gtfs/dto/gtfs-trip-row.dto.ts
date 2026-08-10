import { IsNotEmpty, IsString } from 'class-validator';

/** Une ligne de `trips.txt` - les 3 colonnes obligatoires du spec GTFS. */
export class GtfsTripRowDto {
  @IsString()
  @IsNotEmpty()
  route_id: string;

  @IsString()
  @IsNotEmpty()
  service_id: string;

  @IsString()
  @IsNotEmpty()
  trip_id: string;
}
