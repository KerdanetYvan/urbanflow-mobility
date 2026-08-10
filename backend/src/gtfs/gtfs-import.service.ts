import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { dirname } from 'path';
import { Repository } from 'typeorm';
import { GtfsStop } from './gtfs-stop.entity';
import { parseGtfsFeed } from './gtfs-parser';

const DEFAULT_GTFS_SOURCE_URL =
  'https://eu.ftp.opendatasoft.com/star/gtfs/GTFS_STAR_BUS_METRO_EN_COURS.zip';
const DEFAULT_OTP_OUTPUT_PATH = '/app/routing-engine/data/gtfs-metropole.zip';

export interface GtfsImportSummary {
  stopsUpserted: number;
  routesValidated: number;
  tripsValidated: number;
  calendarValidated: number;
}

/**
 * Ingestion du flux GTFS statique de la metropole (issue #12, F3) :
 * recupere le flux (telechargement ou fichier local), le valide
 * (GtfsParser), upsert les arrets dans PostGIS et depose le zip valide
 * dans le dossier scanne par OpenTripPlanner au prochain `--build`
 * (voir docker-compose.yml, routing-engine/README.md).
 *
 * Lance via `npm run import:gtfs` (backend/src/gtfs/import-gtfs.ts), pas
 * expose en HTTP - un import GTFS est une operation d'exploitation
 * ponctuelle, pas une action utilisateur.
 */
@Injectable()
export class GtfsImportService {
  private readonly logger = new Logger(GtfsImportService.name);

  constructor(
    @InjectRepository(GtfsStop)
    private readonly stopsRepository: Repository<GtfsStop>,
    private readonly configService: ConfigService,
  ) {}

  async run(): Promise<GtfsImportSummary> {
    const zipBuffer = await this.loadSource();

    // Valide AVANT toute ecriture (base ou disque) : un flux invalide ne
    // doit laisser aucune trace partielle, voir GtfsValidationError.
    const feed = parseGtfsFeed(zipBuffer);

    await this.upsertStops(feed);
    await this.writeForOtp(zipBuffer);

    const summary: GtfsImportSummary = {
      stopsUpserted: feed.stops.length,
      routesValidated: feed.routesCount,
      tripsValidated: feed.tripsCount,
      calendarValidated: feed.calendarCount,
    };
    this.logger.log(`Import GTFS termine : ${JSON.stringify(summary)}`);
    return summary;
  }

  /**
   * GTFS_LOCAL_PATH (non vide) prime sur GTFS_SOURCE_URL : utile en dev/CI
   * hors ligne, en pointant par exemple vers
   * routing-engine/test-fixtures/gtfs-test.zip (voir backend/README.md).
   */
  private async loadSource(): Promise<Buffer> {
    const localPath = this.configService.get<string>('GTFS_LOCAL_PATH', '');
    if (localPath) {
      this.logger.log(`Lecture du flux GTFS local : ${localPath}`);
      return fs.readFile(localPath);
    }

    const sourceUrl = this.configService.get<string>(
      'GTFS_SOURCE_URL',
      DEFAULT_GTFS_SOURCE_URL,
    );
    this.logger.log(`Telechargement du flux GTFS : ${sourceUrl}`);
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(
        `Echec du telechargement du flux GTFS (${response.status}) : ${sourceUrl}`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * `upsert` (une seule requete, cle de conflit gtfs_id) plutot qu'une
   * boucle find+save : plus simple et plus efficace pour un flux qui peut
   * contenir plusieurs centaines d'arrets sur un vrai reseau de metropole,
   * et rend le reimport idempotent par construction (contrainte UNIQUE sur
   * gtfs_id, voir la migration GtfsStops).
   */
  private async upsertStops(
    feed: ReturnType<typeof parseGtfsFeed>,
  ): Promise<void> {
    if (feed.stops.length === 0) {
      return;
    }

    const rows = feed.stops.map((stop) => ({
      gtfsId: stop.gtfsId,
      name: stop.name,
      location: {
        type: 'Point' as const,
        // Ordre GeoJSON [longitude, latitude], voir GtfsStop.location.
        coordinates: [stop.lon, stop.lat] as [number, number],
      },
    }));

    await this.stopsRepository.upsert(rows, ['gtfsId']);
  }

  /**
   * Depose le zip valide a l'endroit scanne par le conteneur OTP au
   * prochain `--build` (docker-compose.yml) : c'est l'"injection OTP" du
   * critere d'acceptation de l'issue #12, effective au redemarrage du
   * conteneur, pas immediatement (OTP ne recharge pas son graphe a chaud).
   */
  private async writeForOtp(zipBuffer: Buffer): Promise<void> {
    const outputPath = this.configService.get<string>(
      'GTFS_OTP_OUTPUT_PATH',
      DEFAULT_OTP_OUTPUT_PATH,
    );
    await fs.mkdir(dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, zipBuffer);
    this.logger.log(`Flux GTFS ecrit pour OpenTripPlanner : ${outputPath}`);
  }
}
