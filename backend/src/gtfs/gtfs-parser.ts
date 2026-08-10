import AdmZip from 'adm-zip';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { parse } from 'csv-parse/sync';
import { GtfsCalendarRowDto } from './dto/gtfs-calendar-row.dto';
import { GtfsRouteRowDto } from './dto/gtfs-route-row.dto';
import { GtfsStopRowDto } from './dto/gtfs-stop-row.dto';
import { GtfsTripRowDto } from './dto/gtfs-trip-row.dto';

/**
 * Regroupe tous les problemes de format detectes dans un flux GTFS en une
 * seule erreur (critere d'acceptation "Validation du format" de l'issue
 * #12) : un import echoue entierement plutot que partiellement, avec un
 * message qui liste tout ce qu'il faut corriger en une seule passe.
 */
export class GtfsValidationError extends Error {
  constructor(issues: string[]) {
    super(`Flux GTFS invalide :\n- ${issues.join('\n- ')}`);
    this.name = 'GtfsValidationError';
  }
}

export interface ParsedGtfsStop {
  gtfsId: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * Resultat du parsing d'un flux GTFS statique. Seuls les arrets sont
 * conserves en detail (voir GtfsStop, portee PostGIS volontairement
 * limitee decidee en session) - routes/trips/calendar ne servent qu'a etre
 * valides, leur compte permet de logger un resume comprehensible.
 */
export interface ParsedGtfsFeed {
  stops: ParsedGtfsStop[];
  routesCount: number;
  tripsCount: number;
  calendarCount: number;
}

const REQUIRED_FILES = [
  'stops.txt',
  'routes.txt',
  'trips.txt',
  'calendar.txt',
] as const;

/**
 * Parse et valide les 4 fichiers GTFS obligatoires pour ce projet a partir
 * d'un zip en memoire. Leve GtfsValidationError (issues agregees) si un
 * fichier requis est absent ou si une ligne ne respecte pas le spec GTFS -
 * jamais d'import partiel d'un flux invalide.
 */
export function parseGtfsFeed(zipBuffer: Buffer): ParsedGtfsFeed {
  const zip = new AdmZip(zipBuffer);
  const issues: string[] = [];

  for (const fileName of REQUIRED_FILES) {
    if (!zip.getEntry(fileName)) {
      issues.push(`${fileName} est absent du flux GTFS`);
    }
  }
  // On s'arrete ici si un fichier manque : pas la peine de tenter de
  // parser/valider le contenu d'un flux structurellement incomplet.
  if (issues.length > 0) {
    throw new GtfsValidationError(issues);
  }

  const stopRows = parseRows(zip, 'stops.txt', GtfsStopRowDto, issues);
  const routeRows = parseRows(zip, 'routes.txt', GtfsRouteRowDto, issues);
  const tripRows = parseRows(zip, 'trips.txt', GtfsTripRowDto, issues);
  const calendarRows = parseRows(
    zip,
    'calendar.txt',
    GtfsCalendarRowDto,
    issues,
  );

  // Regle GTFS "au moins un nom parmi route_short_name/route_long_name",
  // impossible a exprimer avec un seul decorateur class-validator par
  // propriete (voir GtfsRouteRowDto) - verifiee ici, une fois chaque ligne
  // individuellement validee.
  for (const route of routeRows) {
    if (!route.route_short_name && !route.route_long_name) {
      issues.push(
        `routes.txt : la ligne route_id="${route.route_id}" n'a ni route_short_name ni route_long_name (au moins un des deux est requis)`,
      );
    }
  }

  if (issues.length > 0) {
    throw new GtfsValidationError(issues);
  }

  return {
    stops: stopRows.map((row) => ({
      gtfsId: row.stop_id,
      name: row.stop_name,
      lat: Number(row.stop_lat),
      lon: Number(row.stop_lon),
    })),
    routesCount: routeRows.length,
    tripsCount: tripRows.length,
    calendarCount: calendarRows.length,
  };
}

/**
 * Parse un fichier CSV du zip en instances du DTO donne, valide chaque
 * ligne (class-validator) et pousse un message par ligne invalide dans
 * `issues` (mutee) plutot que de lever immediatement - permet d'accumuler
 * TOUS les problemes du flux avant de les rapporter d'un coup.
 */
function parseRows<T extends object>(
  zip: AdmZip,
  fileName: string,
  DtoClass: new () => T,
  issues: string[],
): T[] {
  const entry = zip.getEntry(fileName);
  if (!entry) {
    // Ne devrait pas arriver (verifie par l'appelant avant), garde-fou
    // pour que le typage de parseRows n'ait pas besoin d'un entry optionnel.
    throw new GtfsValidationError([`${fileName} est absent du flux GTFS`]);
  }

  const rawRows = parse(zip.readAsText(entry), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const validRows: T[] = [];
  rawRows.forEach((raw, index) => {
    const instance = plainToInstance(DtoClass, raw);
    const errors = validateSync(instance);
    if (errors.length > 0) {
      // +1 pour la ligne d'en-tete, +1 pour l'index base 0 : numero de
      // ligne tel qu'on le verrait en ouvrant le CSV dans un editeur.
      const lineNumber = index + 2;
      const details = errors
        .map(
          (error) =>
            `${error.property} (${Object.values(error.constraints ?? {}).join(', ')})`,
        )
        .join('; ');
      issues.push(`${fileName} ligne ${lineNumber} : ${details}`);
      return;
    }
    validRows.push(instance);
  });

  return validRows;
}
