import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordResetToken1786104323401 implements MigrationInterface {
  name = 'PasswordResetToken1786104323401';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Issue #70 : nouvelle fonctionnalite, pas de remplacement de colonnes
    // existantes (contrairement a #66/#68) - pas de backfill necessaire.
    await queryRunner.query(
      `ALTER TABLE "users" ADD "reset_token_hash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "reset_token_expires_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "reset_token_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "reset_token_hash"`,
    );
  }
}
