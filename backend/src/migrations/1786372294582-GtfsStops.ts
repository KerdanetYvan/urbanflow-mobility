import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table gtfs_stops (issue #12, F3) : sous-ensemble arrets geolocalises du
 * flux GTFS ingere par GtfsImportService (voir backend/src/gtfs/). La
 * colonne "postgis" du garde-fou CREATE EXTENSION ci-dessous est
 * normalement deja active par l'image docker postgis/postgis:16-3.4 des le
 * premier demarrage du conteneur postgres - IF NOT EXISTS la rend sans
 * effet dans ce cas, sans risque a rejouer.
 */
export class GtfsStops1786372294582 implements MigrationInterface {
  name = 'GtfsStops1786372294582';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(
      `CREATE TABLE "gtfs_stops" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gtfs_id" character varying NOT NULL, "name" character varying NOT NULL, "location" geometry(Point,4326) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_gtfs_stops_gtfs_id" UNIQUE ("gtfs_id"), CONSTRAINT "PK_gtfs_stops" PRIMARY KEY ("id"))`,
    );
    // Index spatial GiST : necessaire pour que de futures requetes de
    // proximite (ex. "arrets a moins de 500m d'un point") sur cette colonne
    // restent performantes - inutile pour l'ingestion elle-meme, mais
    // couteux a ajouter apres coup sur une table deja volumineuse.
    await queryRunner.query(
      `CREATE INDEX "IDX_gtfs_stops_location" ON "gtfs_stops" USING GIST ("location")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_gtfs_stops_location"`);
    await queryRunner.query(`DROP TABLE "gtfs_stops"`);
  }
}
