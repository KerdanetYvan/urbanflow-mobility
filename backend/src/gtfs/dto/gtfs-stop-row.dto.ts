import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';

/**
 * Une ligne de `stops.txt` (spec GTFS statique). Les noms de propriete
 * reprennent tels quels le vocabulaire GTFS (snake_case) plutot que le
 * camelCase habituel du projet : csv-parse mappe directement l'en-tete CSV
 * sur ces cles (`columns: true`), et rester au plus pres du nom de colonne
 * source evite toute erreur de correspondance silencieuse lors du parsing.
 *
 * Seules les colonnes obligatoires du spec GTFS pour un arret "simple" (pas
 * un `location_type` de type station/quai) sont validees ici - stop_code,
 * zone_id, etc. restent optionnelles et ne sont pas exploitees par ce
 * projet (voir GtfsImportService, qui n'importe que ces 4 colonnes).
 */
export class GtfsStopRowDto {
  @IsString()
  @IsNotEmpty()
  stop_id: string;

  @IsString()
  @IsNotEmpty()
  stop_name: string;

  // class-validator ne convertit pas les types : une valeur CSV reste une
  // chaine de caracteres a ce stade (la conversion en nombre se fait dans
  // GtfsImportService juste avant l'ecriture en base, une fois la ligne
  // validee).
  @IsNumberString()
  stop_lat: string;

  @IsNumberString()
  stop_lon: string;
}
