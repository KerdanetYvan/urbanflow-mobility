import AdmZip from 'adm-zip';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GtfsValidationError, parseGtfsFeed } from './gtfs-parser';

/**
 * Construit un zip GTFS minimal en memoire a partir d'un jeu de fichiers
 * CSV, avec des valeurs par defaut valides pour chaque fichier requis -
 * chaque test ne surcharge que le fichier qu'il veut rendre invalide,
 * plutot que de reecrire un feed complet a chaque fois.
 */
function buildGtfsZip(overrides: Partial<Record<string, string>>): Buffer {
  const files: Record<string, string> = {
    'stops.txt':
      'stop_id,stop_name,stop_lat,stop_lon\nA,Place Test,48.11,-1.68\n',
    'routes.txt':
      'route_id,route_short_name,route_long_name,route_type\nT1,T1,Ligne Test,3\n',
    'trips.txt': 'route_id,service_id,trip_id\nT1,everyday,T1_0800\n',
    'calendar.txt':
      'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\neveryday,1,1,1,1,1,1,1,20260101,20271231\n',
    ...overrides,
  };

  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, 'utf-8'));
  }
  return zip.toBuffer();
}

describe('parseGtfsFeed', () => {
  it('parse les arrets, et compte routes/trips/calendar, a partir du jeu de test reel', () => {
    // Jeu de donnees reel du projet (routing-engine/test-fixtures/), pas un
    // fixture recree a la main : garantit que le parseur reste compatible
    // avec le format effectivement utilise pour les tests OTP.
    const zipBuffer = readFileSync(
      join(__dirname, '../../../routing-engine/test-fixtures/gtfs-test.zip'),
    );

    const feed = parseGtfsFeed(zipBuffer);

    expect(feed.stops).toEqual([
      { gtfsId: 'A', name: 'Place Centrale', lat: 48.111, lon: -1.682 },
      { gtfsId: 'B', name: 'Gare Test', lat: 48.119, lon: -1.674 },
      { gtfsId: 'C', name: 'Universite', lat: 48.127, lon: -1.682 },
      { gtfsId: 'D', name: 'Hopital', lat: 48.119, lon: -1.69 },
    ]);
    expect(feed.routesCount).toBe(1);
    expect(feed.tripsCount).toBe(3);
    expect(feed.calendarCount).toBe(1);
  });

  it('leve GtfsValidationError si un fichier obligatoire est absent du zip', () => {
    const zip = new AdmZip();
    zip.addFile(
      'stops.txt',
      Buffer.from('stop_id,stop_name,stop_lat,stop_lon\nA,Test,48.11,-1.68\n'),
    );
    // routes.txt, trips.txt, calendar.txt volontairement absents.

    expect(() => parseGtfsFeed(zip.toBuffer())).toThrow(GtfsValidationError);
    expect(() => parseGtfsFeed(zip.toBuffer())).toThrow(/routes\.txt/);
  });

  it('leve GtfsValidationError si une latitude de stops.txt est invalide', () => {
    const zipBuffer = buildGtfsZip({
      'stops.txt':
        'stop_id,stop_name,stop_lat,stop_lon\nA,Place Test,PAS_UN_NOMBRE,-1.68\n',
    });

    expect(() => parseGtfsFeed(zipBuffer)).toThrow(GtfsValidationError);
    expect(() => parseGtfsFeed(zipBuffer)).toThrow(/stop_lat/);
  });

  it("leve GtfsValidationError si une route n'a ni nom court ni nom long", () => {
    const zipBuffer = buildGtfsZip({
      'routes.txt': 'route_id,route_type\nT1,3\n',
    });

    expect(() => parseGtfsFeed(zipBuffer)).toThrow(GtfsValidationError);
    expect(() => parseGtfsFeed(zipBuffer)).toThrow(
      /route_short_name|route_long_name/,
    );
  });
});
