import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccessibilityPreferences1786033404958 implements MigrationInterface {
  name = 'AccessibilityPreferences1786033404958';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Issue #68 : reduced_mobility/max_walking_distance_meters/max_transfers
    // remplaces par un tableau de preferences cochees/decochees (voir
    // AccessibilityPreference), pensees pour alimenter le futur service de
    // scoring comme des poids plutot que comme des seuils eliminatoires.
    // Colonne ajoutee AVANT les DROP pour pouvoir backfiller les donnees
    // existantes a partir des anciennes colonnes.
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "accessibility_preferences" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `UPDATE "mobility_profiles" SET "accessibility_preferences" = "accessibility_preferences" || '{wheelchair_accessible}' WHERE "reduced_mobility" = true`,
    );
    await queryRunner.query(
      `UPDATE "mobility_profiles" SET "accessibility_preferences" = "accessibility_preferences" || '{limit_walking_distance}' WHERE "max_walking_distance_meters" IS NOT NULL`,
    );
    await queryRunner.query(
      `UPDATE "mobility_profiles" SET "accessibility_preferences" = "accessibility_preferences" || '{limit_transfers}' WHERE "max_transfers" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "reduced_mobility"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "max_walking_distance_meters"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "max_transfers"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "max_transfers" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "max_walking_distance_meters" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD "reduced_mobility" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "mobility_profiles" SET "reduced_mobility" = true WHERE 'wheelchair_accessible' = ANY("accessibility_preferences")`,
    );
    await queryRunner.query(
      `UPDATE "mobility_profiles" SET "max_walking_distance_meters" = 0 WHERE 'limit_walking_distance' = ANY("accessibility_preferences")`,
    );
    await queryRunner.query(
      `UPDATE "mobility_profiles" SET "max_transfers" = 0 WHERE 'limit_transfers' = ANY("accessibility_preferences")`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP COLUMN "accessibility_preferences"`,
    );
  }
}
