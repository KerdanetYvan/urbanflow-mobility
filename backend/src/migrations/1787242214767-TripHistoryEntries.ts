import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table trip_history_entries (issue #11, F2) : historique des recherches
 * d'itineraires effectuees par un utilisateur authentifie (voir
 * TripHistoryService#record). Coordonnees et libelles chiffres au repos au
 * niveau applicatif (createEncryptedColumnTransformer, colonnes "text" - pas
 * du type natif applicatif, voir docs/specs/rgpd-geolocalisation.md section
 * 2.2), d'ou le type "text" plutot que "double precision"/"varchar" ici.
 *
 * Note : les deux lignes `DROP/CREATE INDEX "IDX_gtfs_stops_location"`
 * generees automatiquement par `migration:generate` ont ete retirees - bruit
 * sans rapport avec cette migration (TypeORM ne suit pas correctement
 * l'index spatial GiST cree "a la main" par GtfsStops1786372294582, casse
 * different de casse GIST/gist), pas une consequence de trip_history_entries.
 */
export class TripHistoryEntries1787242214767 implements MigrationInterface {
  name = 'TripHistoryEntries1787242214767';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "trip_history_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "origin_lat" text NOT NULL, "origin_lon" text NOT NULL, "destination_lat" text NOT NULL, "destination_lon" text NOT NULL, "origin_label" text, "destination_label" text, "searched_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8973d1f1ce5c0e3f490e94cc164" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "trip_history_entries" ADD CONSTRAINT "FK_e11464ccdfd6058b36fed516682" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "trip_history_entries" DROP CONSTRAINT "FK_e11464ccdfd6058b36fed516682"`,
    );
    await queryRunner.query(`DROP TABLE "trip_history_entries"`);
  }
}
