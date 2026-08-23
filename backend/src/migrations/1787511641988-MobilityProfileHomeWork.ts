import { MigrationInterface, QueryRunner } from 'typeorm';

export class MobilityProfileHomeWork1787511641988 implements MigrationInterface {
  name = 'MobilityProfileHomeWork1787511641988';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Issue #113 : adresses domicile/travail du profil de mobilite,
    // chiffrees au repos (createEncryptedColumnTransformer, meme mecanisme
    // que trip_history_entries - issue #22/#11, voir
    // docs/specs/rgpd-geolocalisation.md section 2.2) - donc typees "text"
    // cote Postgres et non "double precision"/"varchar", meme si la valeur
    // applicative est un nombre ou une chaine courte.
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "home_label" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "home_lat" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "home_lon" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "work_label" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "work_lat" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "work_lon" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "work_lon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "work_lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "work_label"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "home_lon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "home_lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "home_label"`,
    );
  }
}
